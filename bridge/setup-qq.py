"""Prepare private NapCat config without enabling or sending QQ messages."""
import json
import secrets
from pathlib import Path
root=Path(__file__).resolve().parents[1]
config_dir=root/'.local/napcat/config'
for path in (config_dir,root/'.local/napcat/qq',root/'.local/napcat/plugins'):
    path.mkdir(parents=True,exist_ok=True)
web=config_dir/'webui.json'
if not web.exists():
    web.write_text(json.dumps({'host':'0.0.0.0','port':6099,'token':secrets.token_urlsafe(32),'loginRate':3}),encoding='utf-8')
one=config_dir/'onebot11.json'
if not one.exists():
    common={'enable':True,'host':'0.0.0.0','messagePostFormat':'array','token':secrets.token_urlsafe(32),'debug':False}
    network={'httpServers':[dict(common,name='dsh-http',port=3000,enableCors=False,enableWebsocket=False)],
             'websocketServers':[dict(common,name='dsh-events',port=3001,reportSelfMessage=False,enableForcePushEvent=True,heartInterval=30000)],
             'httpSseServers':[],'httpClients':[],'websocketClients':[],'plugins':[]}
    one.write_text(json.dumps({'network':network,'musicSignUrl':'','enableLocalFile2Url':False,'parseMultMsg':False,'imageDownloadProxy':''},indent=2),encoding='utf-8')
path=root/'bridge/bridge-config.json'
config=json.loads(path.read_text(encoding='utf-8-sig'))
config.setdefault('qq',{'enabled':False,'target_qq':0})
config['qq'].update(napcat_base='http://127.0.0.1:3000',napcat_ws='ws://127.0.0.1:3001',
                    napcat_token=json.loads(one.read_text())['network']['httpServers'][0]['token'])
path.write_text(json.dumps(config,ensure_ascii=False,indent=2),encoding='utf-8')
print('Private NapCat configuration prepared; no account login or message sent.')
