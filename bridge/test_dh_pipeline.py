"""Model-free regression tests for reuse and publication of pipelined segments."""
import asyncio
import builtins
from pathlib import Path
import unittest
from unittest.mock import patch

# Tests load the public example, never a user's private API configuration.
real_open = builtins.open
def test_config_open(file, *args, **kwargs):
    if Path(file).name == 'bridge-config.json':
        file = Path(__file__).with_name('bridge-config.example.json')
    return real_open(file, *args, **kwargs)

with patch('builtins.open', test_config_open):
    import voice_bridge as bridge


class PipelineTests(unittest.IsolatedAsyncioTestCase):
    async def test_prefetched_segments_are_synthesized_once_and_published_early(self):
        calls, rendered, published = [], [], []
        finish_second = asyncio.Event()

        async def synth(text):
            calls.append(text)
            if text == 'second':
                await finish_second.wait()
            return Path(text + '.wav')

        async def render(client, code, wav, reply_code, text):
            await asyncio.sleep(0)
            rendered.append(wav.name)
            return code + '-r.mp4'

        def record(code, filename, text):
            published.append(text)
            if text == 'first':
                self.assertFalse(finish_second.is_set())
                self.assertIn('second', calls)  # overlapped with first render
                finish_second.set()

        with patch.multiple(bridge,
            _split_segments=lambda *args: ['first', 'second', 'third'],
            _dh_synth_segment=synth, _dh_submit_and_wait=render,
            _dh_record_history=record, _dh_prune_videos=lambda: None,
            _dh_has_newer_pending=lambda: False, _dh_discarded=set(),
            _dh_state={'videos': []}):
            await asyncio.wait_for(bridge._dh_run({'code': 'test', 'text': 'reply'}), 2)
            self.assertEqual(calls, ['first', 'second', 'third'])
            self.assertEqual(rendered, ['first.wav', 'second.wav', 'third.wav'])
            self.assertEqual(published, ['first', 'second', 'third'])
            self.assertEqual(bridge._dh_state['state'], 'done')

    async def test_failed_render_drains_prefetch_without_starting_another_segment(self):
        calls = []
        async def synth(text):
            calls.append(text)
            await asyncio.sleep(0)
            return Path(text)
        async def render(*args):
            await asyncio.sleep(0)
            return None
        with patch.multiple(bridge,
            _split_segments=lambda *args: ['first', 'second', 'third'],
            _dh_synth_segment=synth, _dh_submit_and_wait=render,
            _dh_has_newer_pending=lambda: False, _dh_discarded=set(),
            _dh_state={'videos': []}):
            await bridge._dh_run({'code': 'test', 'text': 'reply'})
            self.assertEqual(calls, ['first', 'second'])


if __name__ == '__main__':
    unittest.main()
