"""Check a running local bridge; optionally exercise real STT and TTS models."""
import argparse
import json
from pathlib import Path

import httpx


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base', default='http://127.0.0.1:8765')
    parser.add_argument('--audio', type=Path, help='WAV file for real speech recognition')
    parser.add_argument('--text', help='Text to synthesize with the configured voice')
    parser.add_argument('--output', type=Path, default=Path('tts_out.wav'))
    args = parser.parse_args()
    with httpx.Client(base_url=args.base, timeout=300, trust_env=False) as client:
        for route in ['/api/health', '/api/media/bg-images', '/api/persona/list', '/api/dh/status']:
            response = client.get(route)
            response.raise_for_status()
            print(route, json.dumps(response.json(), ensure_ascii=False))
        if args.audio:
            response = client.post('/api/stt', content=args.audio.read_bytes(), headers={'Content-Type': 'audio/wav'})
            response.raise_for_status()
            print('STT:', json.dumps(response.json(), ensure_ascii=False))
        if args.text:
            response = client.post('/api/tts', json={'text': args.text})
            response.raise_for_status()
            if not response.content.startswith(b'RIFF') or len(response.content) <= 44:
                raise RuntimeError('TTS did not return a nonempty WAV file')
            args.output.write_bytes(response.content)
            print('TTS WAV:', args.output.resolve(), 'bytes:', len(response.content))


if __name__ == '__main__':
    main()
