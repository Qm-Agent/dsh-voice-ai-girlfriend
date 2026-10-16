"""Validated OneBot message parsing and Docker-compatible voice retrieval."""
import base64
import html
import re


def allowed_message(body, config):
    try:
        target = int(config.get('target_qq') or 0)
        sender = int(body.get('user_id') or 0)
        own = int(body.get('self_id') or 0)
    except (ValueError, TypeError):
        return False
    return (config.get('enabled') is True and target > 0 and sender == target
            and sender != own and (not config.get('bot_qq') or own == int(config['bot_qq']))
            and body.get('post_type') == 'message'
            and body.get('message_type') == 'private')


def segments(body):
    message = body.get('message')
    if isinstance(message, list):
        return [s for s in message if isinstance(s, dict) and isinstance(s.get('data'), dict)]
    raw = str(body.get('raw_message') or message or '')
    result, end = [], 0
    for match in re.finditer(r'\[CQ:([^,\]]+)((?:,[^\]]*)?)\]', raw):
        if match.start() > end:
            result.append({'type': 'text', 'data': {'text': html.unescape(raw[end:match.start()])}})
        data = dict(part.split('=', 1) for part in match.group(2).split(',')[1:] if '=' in part)
        result.append({'type': match.group(1), 'data': {k: html.unescape(v) for k, v in data.items()}})
        end = match.end()
    if end < len(raw):
        result.append({'type': 'text', 'data': {'text': html.unescape(raw[end:])}})
    return result


def record_wav(config, file_id):
    from qq_bridge import _call
    response = _call(config['napcat_base'], config.get('napcat_token', ''), 'get_record',
                     {'file': file_id, 'out_format': 'wav'})
    encoded = response.get('data', {}).get('base64', '')
    if not isinstance(encoded, str) or not encoded or len(encoded) > 12_000_000:
        raise ValueError('NapCat returned missing or oversized voice data')
    data = base64.b64decode(encoded, validate=True)
    if not data.startswith(b'RIFF'):
        raise ValueError('NapCat voice conversion did not return WAV')
    return data
