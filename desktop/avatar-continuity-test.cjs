// Opt-in integration test against the user's running local voice service.
module.exports=async function({win,view,root,bridge,show}){
  const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const folder=path.join(root,'.local','desktop');
  const result={ok:false,avatars:[],at:new Date().toISOString()};
  const save=()=>fs.writeFileSync(path.join(folder,'all-avatar-continuity-test.json'),JSON.stringify(result,null,2));
  const list=await (await fetch(bridge+'/api/persona/list')).json();
  const select=async name=>{
    const response=await fetch(bridge+'/api/persona/set',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({avatar:name})});
    assert(response.ok);
    await view.webContents.executeJavaScript(`localStorage.setItem('s2s.voice.persona.avatar',${JSON.stringify(name)});window.dispatchEvent(new CustomEvent('dsh-voice:persona',{detail:{kind:'avatar',name:${JSON.stringify(name)}}}));`);
  };
  await wait(3000);await show('pet');save();
  try{
    for(const avatar of list.avatars){
      await select(avatar.name);
      let resting;
      for(let n=0;n<80;n++){
        await wait(100);
        resting=await view.webContents.executeJavaScript("(()=>{const i=document.querySelector('[data-rest-avatar]');return {name:i?.dataset.restAvatar,ready:i?.readyState,time:i?.currentTime,opacity:i?.style.opacity}})()");
        if(resting.name===avatar.name&&resting.ready>=2&&resting.time>0)break;
      }
      assert(resting.name===avatar.name&&resting.ready>=2,'Selected avatar must be ready: '+avatar.name);
      await view.webContents.executeJavaScript(`window.__avatarFrames=[];window.__avatarTimer=setInterval(()=>{
        const d=[...document.querySelectorAll('[data-desktop-companion] video')].find(v=>v.currentSrc.includes('/media/dh/'));
        const i=document.querySelector('[data-rest-avatar]');
        window.__avatarFrames.push({at:Date.now(),speech:!!d&&!d.paused&&d.currentTime>0&&!d.ended,time:d?.currentTime,ready:d?.readyState,ended:d?.ended,source:d?.currentSrc,name:i?.dataset.restAvatar,idleTime:i?.currentTime,idleDuration:i?.duration,idleOpacity:i?.style.opacity});
      },40)`);
      const started=Date.now();
      const sent=await (await fetch(bridge+'/api/dh/speak',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'你好，我在这里陪你。'})})).json();
      assert(sent.code,'Speech request accepted');
      let frames=[],status;
      for(let n=0;n<600;n++){
        await wait(200);
        status=await (await fetch(bridge+'/api/dh/status')).json();
        if(status.code===sent.code&&status.state==='error')throw Error(avatar.name+': '+status.message);
        frames=await view.webContents.executeJavaScript('window.__avatarFrames');
        if(frames.some(f=>f.source?.includes(sent.code)&&f.speech)&&frames.at(-1)?.ended)break;
      }
      await wait(450);
      frames=await view.webContents.executeJavaScript('window.__avatarFrames');
      await view.webContents.executeJavaScript('clearInterval(window.__avatarTimer)');
      const current=frames.filter(f=>f.source?.includes(sent.code)),voiced=current.filter(f=>f.speech),back=current.at(-1);
      fs.writeFileSync(path.join(folder,'continuity-'+avatar.name+'.json'),JSON.stringify(frames));
      assert(voiced.length>3,'Real speech played: '+avatar.name);
      assert(voiced.every(f=>f.ready>=2),'Speech is decoded before presentation');
      assert(!current.some(f=>f.ready<2&&f.idleOpacity==='0'),'Resting layer covers decoder startup');
      assert(back.ended&&back.idleOpacity==='1'&&back.name===avatar.name,'Returns to the same avatar');
      const phase=back.time%back.idleDuration;
      const drift=(back.idleTime-phase+back.idleDuration)%back.idleDuration;
      assert(drift<1.2,'Rest resumes near matching source pose');
      result.avatars.push({name:avatar.name,firstSpeechMs:voiced[0].at-started,speechFrames:voiced.length,returnPhaseDrift:drift,ended:true,coveredStartup:true});save();
    }
    result.ok=true;save();
  }finally{
    await view.webContents.executeJavaScript('clearInterval(window.__avatarTimer)').catch(()=>{});
    await select(list.current.avatar);await show('pet');
  }
};
