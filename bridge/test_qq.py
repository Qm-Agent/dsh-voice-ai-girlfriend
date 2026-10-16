"""No real QQ traffic: regression tests use a fake OneBot transport."""
import asyncio
import base64
import unittest
from unittest.mock import patch, AsyncMock
from test_dh_pipeline import bridge
from qq_inbound import allowed_message, segments, record_wav
import qq_bridge

CONFIG = {'enabled': True, 'target_qq': 12345, 'napcat_base': 'http://127.0.0.1:3000', 'napcat_token': 'test'}
EVENT = {'post_type': 'message', 'message_type': 'private', 'user_id': 12345, 'self_id': 67890,
         'message_id': 1, 'message': [{'type': 'text', 'data': {'text': '你好'}}]}

class InboundTests(unittest.TestCase):
    def test_only_configured_private_sender(self):
        self.assertTrue(allowed_message(EVENT, CONFIG))
        for update in ({'user_id': 99999}, {'self_id': 12345}, {'message_type': 'group'}, {'post_type': 'message_sent'}):
            self.assertFalse(allowed_message(dict(EVENT, **update), CONFIG))
        self.assertFalse(allowed_message(EVENT, dict(CONFIG, enabled=False)))
        self.assertFalse(allowed_message(EVENT, dict(CONFIG, target_qq=0)))

    def test_array_and_cq_voice(self):
        self.assertEqual(segments(EVENT)[0]['data']['text'], '你好')
        result=segments({'raw_message': '你好[CQ:record,file=voice&#44;1]呀'})
        self.assertEqual([s['type'] for s in result], ['text','record','text'])
        self.assertEqual(result[1]['data']['file'], 'voice,1')

    def test_voice_uses_napcat_wav_base64_not_container_path(self):
        wav=b'RIFFtest'
        with patch.object(qq_bridge, '_call', return_value={'data':{'file':'/app/private.wav','base64':base64.b64encode(wav).decode()}}) as call:
            self.assertEqual(record_wav(CONFIG, 'record-id'), wav)
            self.assertEqual(call.call_args.args[3], {'file':'record-id','out_format':'wav'})
        with patch.object(qq_bridge, '_call', return_value={'data':{'base64':base64.b64encode(b'not wav').decode()}}):
            with self.assertRaises(ValueError): record_wav(CONFIG, 'id')

    def test_voice_send_is_portable_base64(self):
        with patch.object(qq_bridge, '_call', return_value={'status':'ok'}) as call:
            qq_bridge.send_voice('http://127.0.0.1:3000','test',12345,b'\x00\x00'*1600)
            file=call.call_args.args[3]['message'][0]['data']['file']
            self.assertTrue(file.startswith('base64://'))
            self.assertGreater(len(base64.b64decode(file[9:])), 10)

class QueueTests(unittest.IsolatedAsyncioTestCase):
    async def test_duplicate_event_is_not_queued_twice(self):
        with patch.multiple(bridge, CONFIG={'qq':CONFIG}, _qq_queue=asyncio.Queue(maxsize=20), _qq_seen={}):
            self.assertTrue(await bridge._qq_accept_event(EVENT))
            self.assertFalse(await bridge._qq_accept_event(EVENT))
            self.assertFalse(await bridge._qq_accept_event(dict(EVENT,user_id=99999,message_id=2)))
            self.assertEqual(bridge._qq_queue.qsize(),1)

    async def test_one_correlated_reply_sends_text_then_voice(self):
        class Client:
            async def send_json(self, item):
                self.request=item
                bridge._qq_reply_future.set_result('你好，我在这里。')
        client=Client()
        queue=asyncio.Queue(maxsize=20)
        await queue.put(EVENT)
        with patch.multiple(bridge, CONFIG={'qq':CONFIG}, _qq_queue=queue, _qq_ws_conn=client,
                            _qq_active=None, _qq_reply_future=None), patch.object(bridge,'qq_send',new_callable=AsyncMock) as send:
            worker=asyncio.create_task(bridge._qq_worker())
            await asyncio.wait_for(queue.join(),2)
            worker.cancel()
            await asyncio.gather(worker,return_exceptions=True)
            self.assertEqual(client.request['text'],'你好')
            self.assertTrue(client.request['request_id'])
            self.assertEqual([c.args[0].voice for c in send.call_args_list],[False,True])
            self.assertIsNone(bridge._qq_active)

    async def test_voice_transcription_uses_shared_model_lock(self):
        import io, wave
        buffer=io.BytesIO()
        with wave.open(buffer,'wb') as wav:
            wav.setnchannels(1); wav.setsampwidth(2); wav.setframerate(16000); wav.writeframes(b'\x00\x00'*1600)
        event=dict(EVENT,message=[{'type':'record','data':{'file':'record-id'}}])
        with patch.object(bridge,'_qq_record_wav',return_value=buffer.getvalue()), patch.object(bridge.models,'ensure_stt',new_callable=AsyncMock), patch.object(bridge,'_transcribe',return_value=('语音测试','zh')):
            self.assertEqual(await bridge._qq_message_text(event),'语音测试')

if __name__ == '__main__': unittest.main()
