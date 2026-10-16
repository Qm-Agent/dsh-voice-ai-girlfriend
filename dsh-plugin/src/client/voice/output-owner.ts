import { useEffect, useState } from 'react'

// A browser origin has one voice output owner, even with several chat tabs.
// Components in the same tab share this coordinator and the same Web Lock.
let owned = false
let acquiring = false
let release: (() => void) | undefined
const listeners = new Set<(value: boolean) => void>()
let channel: BroadcastChannel | undefined
let yieldUntil = 0

function preferThisTab(): void {
  yieldUntil = 0
  channel?.postMessage('claim')
  acquire()
}

export function ownsVoiceOutput(): boolean {
  return owned && document.visibilityState === 'visible'
}

function publish(value: boolean): void {
  owned = value
  for (const listener of listeners) listener(value)
}

function acquire(): void {
  if (document.visibilityState !== 'visible') {
    release?.()
    publish(false)
    return
  }
  if (owned || acquiring || listeners.size === 0 || Date.now() < yieldUntil) return
  if (!navigator.locks) {
    // Older browsers only support foreground-tab suppression.
    publish(true)
    return
  }
  acquiring = true
  void navigator.locks.request('dsh-voice-output', { ifAvailable: true }, async lock => {
    if (!lock || document.visibilityState !== 'visible' || listeners.size === 0) return
    await new Promise<void>(resolve => {
      release = resolve
      publish(true)
    })
    release = undefined
    publish(false)
  }).finally(() => { acquiring = false })
}

export function useVoiceOutputOwner(): boolean {
  const [value, setValue] = useState(ownsVoiceOutput)
  useEffect(() => {
    if (!channel && typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel('dsh-voice-output-owner')
      channel.onmessage = () => {
        // Two windows can both be visible: the most recently used one wins.
        yieldUntil = Date.now() + 2000
        release?.()
        publish(false)
      }
    }
    listeners.add(setValue)
    acquire()
    const timer = window.setInterval(acquire, 500)
    document.addEventListener('visibilitychange', acquire)
    window.addEventListener('focus', preferThisTab)
    window.addEventListener('pointerdown', preferThisTab)
    window.addEventListener('keydown', preferThisTab)
    return () => {
      listeners.delete(setValue)
      window.clearInterval(timer)
      if (listeners.size === 0) {
        document.removeEventListener('visibilitychange', acquire)
        window.removeEventListener('focus', preferThisTab)
        window.removeEventListener('pointerdown', preferThisTab)
        window.removeEventListener('keydown', preferThisTab)
        release?.()
        channel?.close()
        channel = undefined
      }
    }
  }, [])
  return value
}
