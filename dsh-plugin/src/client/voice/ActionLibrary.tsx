import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { bridgeBase } from '../bridge.ts'
import { ownsVoiceOutput } from './output-owner.ts'
import { conversationAction } from './action-policy.ts'

type Manifest = { actions: Record<string, {file: string; label: string}>, unavailable: Record<string, string> }
const mediaStyle = {position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'contain', pointerEvents:'none', transition:'opacity 220ms ease'} as const

// All clips are muted, cached independently, and yield immediately to speech.
export function ActionLibrary({avatar, speaking, preparing, visible, speechVideo}: {avatar:string; speaking:boolean; preparing:boolean; visible:boolean; speechVideo?: {current:HTMLVideoElement|null}}) {
  const [manifest, setManifest] = useState<Manifest | null>(null)
  const [urls, setUrls] = useState<Record<string,string>>({})
  const [active, setActive] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [idleReady, setIdleReady] = useState(false)
  const [hint, setHint] = useState('')
  const video = useRef<HTMLVideoElement>(null)
  const idle = useRef<HTMLVideoElement>(null)
  const state = useRef({speaking, preparing, visible, active, manifest, urls})
  state.current = {speaking, preparing, visible, active, manifest, urls}
  const wasSpeaking = useRef(false)
  const restPhase = useRef(0)
  const eligible = Boolean(avatar)
  const hasActionLibrary = avatar === 'moon_bai.mp4'
  useEffect(() => {
    setManifest(null);setUrls({});setActive(null);setReady(false);setIdleReady(false);setHint('')
    if(!eligible)return
    if(!hasActionLibrary){
      // Other avatars use their exact DUIX template, so composition and pose agree.
      setUrls({idle:bridgeBase()+'/media/avatars/'+encodeURIComponent(avatar)})
      return
    }
    const abort = new AbortController(), blobs:string[]=[]
    void (async()=>{
      const base=bridgeBase()+'/media/actions/moon-bai/'
      const response=await fetch(base+'manifest.json',{signal:abort.signal})
      if(!response.ok)throw new Error('No action library')
      const data:Manifest=await response.json()
      if(abort.signal.aborted)return
      setManifest(data)
      // Sequential background loading avoids competing with speech downloads.
      for(const [id,clip] of Object.entries(data.actions)){
        const r=await fetch(base+clip.file,{signal:abort.signal})
        if(!r.ok)continue
        const blob=await r.blob();if(abort.signal.aborted)return
        const url=URL.createObjectURL(blob);blobs.push(url)
        setUrls(old=>({...old,[id]:url}))
      }
    })().catch(()=>{})
    return()=>{abort.abort();blobs.forEach(url=>URL.revokeObjectURL(url))}
  },[eligible,avatar,hasActionLibrary])
  useEffect(()=>{
    if(!hasActionLibrary)return
    let pending: {id:string; at:number; heard:boolean; explicit:boolean} | null=null
    let lastSpeech=0, lastGesture=0, hintTimer:ReturnType<typeof setTimeout>
    const onPrompt=(event:Event)=>{
      const request=conversationAction(String((event as CustomEvent).detail?.text||''))
      // A newer turn replaces the pending gesture; never build an animation queue.
      pending=request?{...request,at:Date.now(),heard:state.current.speaking}:null
      if(request?.id==='watermelon'&&!state.current.urls.watermelon){
        setHint('吃西瓜动作尚未就绪');clearTimeout(hintTimer);hintTimer=setTimeout(()=>setHint(''),3200);pending=null
      }
    }
    window.addEventListener('dsh-voice:submitted',onPrompt)
    const timer=setInterval(()=>{
      const s=state.current,now=Date.now()
      if(s.speaking){lastSpeech=now;if(pending)pending.heard=true;return}
      if(!pending)return
      if(now-pending.at>90000||!s.visible||!ownsVoiceOutput()){pending=null;return}
      // Let the answer finish. With text-only output, use a quiet fallback window.
      const settled=pending.heard?now-lastSpeech>=450:now-pending.at>=12000
      if(!settled||s.preparing||s.active)return
      const request=pending;pending=null
      if(!s.urls[request.id]||(!request.explicit&&now-lastGesture<30000))return
      lastGesture=now;setReady(false);setActive(request.id)
    },100)
    return()=>{clearInterval(timer);clearTimeout(hintTimer);window.removeEventListener('dsh-voice:submitted',onPrompt)}
  },[hasActionLibrary])
  useLayoutEffect(()=>{
    if(speaking||!visible){video.current?.pause();setActive(null);setReady(false)}
    const v=idle.current
    if(v&&urls.idle){
      if(speaking){
        v.pause()
        restPhase.current=speechVideo?.current?.currentTime||0
      }else if(visible){
        if(wasSpeaking.current&&Number.isFinite(v.duration)&&v.duration>0){
          // DUIX is driven by this same source: resume at the corresponding pose.
          const phase=(speechVideo?.current?.currentTime||restPhase.current)%v.duration
          setIdleReady(false);v.currentTime=phase
        }
        void v.play().catch(()=>{})
      }else v.pause()
    }
    wasSpeaking.current=speaking
  },[speaking,visible,urls.idle,speechVideo])
  useEffect(()=>{
    const v=idle.current
    if(!v)return
    if(active&&ready){v.pause();v.currentTime=.5}
    else if(!active&&!speaking&&visible)void v.play().catch(()=>{})
  },[active,ready,speaking,visible])
  if(!eligible)return null
  return <>
    {urls.idle&&<video data-action-idle data-rest-avatar={avatar} ref={idle} src={urls.idle} muted playsInline loop preload="auto" draggable={false}
      onCanPlay={()=>setIdleReady(true)} onSeeked={()=>setIdleReady(true)} onError={()=>setIdleReady(false)}
      style={{...mediaStyle,opacity:idleReady&&!speaking&&visible?1:0,zIndex:2,transition:'opacity 180ms ease'}} />}
    {active&&<video data-action-playing={active} key={active} ref={video} src={urls[active]} muted playsInline preload="auto" draggable={false}
      style={{...mediaStyle,opacity:ready&&!speaking&&visible?1:0,zIndex:3,transition:'opacity 180ms ease'}}
      onCanPlay={()=>{if(state.current.speaking)return;void video.current?.play().then(()=>setReady(true)).catch(()=>setActive(null))}}
      onTimeUpdate={()=>{const v=video.current;if(v&&v.duration-v.currentTime<.25)setReady(false)}}
      onEnded={()=>{setActive(null);setReady(false)}} onError={()=>{setActive(null);setReady(false)}} />}
    {hint&&<div data-scene-warning role="status" style={{position:'absolute',bottom:100,left:20,right:20,textAlign:'center',fontSize:12,color:'#eedec6',zIndex:30}}>{hint}</div>}
  </>
}
