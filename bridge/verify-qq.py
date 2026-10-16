"""Read-only QQ connectivity check; never sends a message."""
import json
from pathlib import Path
import urllib.request
from qq_bridge import _call
config=json.loads(Path(__file__).with_name('bridge-config.json').read_text(encoding='utf-8-sig'))['qq']
for action in ('get_login_info','get_status'):
    try:
        result=_call(config['napcat_base'],config.get('napcat_token',''),action,{})
        data=result.get('data',{})
        if action=='get_login_info':
            print('bot_account_matches:', bool(config.get('bot_qq')) and str(data.get('user_id'))==str(config['bot_qq']))
        else: print('NapCat:',json.dumps(data,ensure_ascii=False))
    except Exception as exc: print(action,'unavailable:',type(exc).__name__)
try:
    with urllib.request.build_opener(urllib.request.ProxyHandler({})).open('http://127.0.0.1:8765/api/qq/status',timeout=5) as r:
        print('Bridge:',r.read().decode())
except Exception as exc: print('Bridge unavailable:',type(exc).__name__)
