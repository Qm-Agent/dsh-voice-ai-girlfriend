"""Apply local QQ account IDs without placing credentials in Git or arguments."""
import argparse
import json
from pathlib import Path

root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--bot-qq',type=int,required=True)
parser.add_argument('--target-qq',type=int,required=True)
args=parser.parse_args()
if args.bot_qq < 10000 or args.target_qq < 10000 or args.bot_qq == args.target_qq:
    parser.error('Use two different QQ accounts: a bot and a test recipient.')
config_dir=root/'.local/napcat/config'
one=json.loads((config_dir/'onebot11.json').read_text(encoding='utf-8-sig'))
(config_dir/f'onebot11_{args.bot_qq}.json').write_text(json.dumps(one,ensure_ascii=False,indent=2),encoding='utf-8')
path=root/'bridge/bridge-config.json'
config=json.loads(path.read_text(encoding='utf-8-sig'))
config['qq'].update(enabled=True,bot_qq=args.bot_qq,target_qq=args.target_qq,
    napcat_base='http://127.0.0.1:3000',napcat_ws='ws://127.0.0.1:3001',
    napcat_token=one['network']['httpServers'][0]['token'])
path.write_text(json.dumps(config,ensure_ascii=False,indent=2),encoding='utf-8')
print('QQ accounts configured locally. Restart NapCat and the voice bridge to apply.')
