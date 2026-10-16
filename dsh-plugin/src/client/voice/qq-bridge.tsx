/** One owning conversation handles correlated QQ requests, never chat history. */
import { memo, useEffect, useRef, useState } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import type { AssistantChatData } from '@deepseek-ai/dsh-client-ui-chat/client'
import { bridgeBase } from '../bridge.ts'
import type { VoiceInjected } from '../contract.ts'
import { readQqPush } from '../QqPushToggle.tsx'
import { cleanReplyText } from './clean.ts'
import { chatNodes } from './chat-nodes.ts'

export type QQBridgeProps = PropsRuntime<'conversation.input.left'> & PropsLocale<'voice'> & VoiceInjected
type Pending = { request_id: string; text: string; baseline: number; sent: boolean }

export const QQBridge = memo(function QQBridge({ useSession, useChat, sendText }: QQBridgeProps) {
  const wsRef = useRef<WebSocket | null>(null)
  const sendRef = useRef(sendText)
  sendRef.current = sendText
  const [pending, setPending] = useState<Pending | null>(null)
  const pendingRef = useRef<Pending | null>(null)
  const chat = useChat((s: never) => s)
  const snapshot = useSession(s => s)
  const latestAnchor = useRef(0)
  latestAnchor.current = Math.max(0, ...chatNodes(chat).map(n => n.anchorSeq))
  const clear = (): void => { pendingRef.current = null; setPending(null) }

  useEffect(() => {
    let closed = false
    let ws: WebSocket | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    const connect = (): void => {
      if (closed) return
      const role = navigator.userAgent.includes('DSHDesktop/') ? 'desktop' : 'browser'
      ws = new WebSocket(bridgeBase().replace(/^http/, 'ws') + '/api/qq/ws?role=' + role)
      const socket = ws
      socket.onopen = () => { wsRef.current = socket }
      socket.onmessage = event => {
        try {
          const msg = JSON.parse(String(event.data))
          if (msg.type !== 'qq_message' || typeof msg.request_id !== 'string' || typeof msg.text !== 'string') return
          if (!readQqPush() || pendingRef.current) {
            socket.send(JSON.stringify({ type: 'error', request_id: msg.request_id, message: 'QQ linkage disabled or busy' }))
            return
          }
          const next = { request_id: msg.request_id, text: msg.text, baseline: latestAnchor.current, sent: false }
          pendingRef.current = next
          setPending(next)
        } catch { /* malformed event */ }
      }
      socket.onclose = () => {
        if (wsRef.current === socket) wsRef.current = null
        clear()
        if (!closed) timer = setTimeout(connect, 5000)
      }
    }
    connect()
    return () => { closed = true; clearTimeout(timer); ws?.close() }
  }, [])

  // Wait for any local turn to finish instead of interrupting it.
  useEffect(() => {
    const item = pendingRef.current
    if (!item || item.sent || snapshot.running) return
    item.sent = true
    item.baseline = latestAnchor.current
    void sendRef.current(item.text).catch(error => {
      wsRef.current?.send(JSON.stringify({ type: 'error', request_id: item.request_id, message: String(error) }))
      clear()
    })
  }, [pending, snapshot.running])

  useEffect(() => {
    const item = pendingRef.current
    const ws = wsRef.current
    if (!item?.sent || snapshot.running || !ws || ws.readyState !== WebSocket.OPEN) return
    let latest: { anchor: number; text: string } | null = null
    for (const node of chatNodes(chat)) {
      if (node.kind !== 'assistant-step' || node.anchorSeq <= item.baseline) continue
      const data = node.data as AssistantChatData
      if (data.status !== 'settled') continue
      const text = cleanReplyText(data.blocks.filter(b => b.kind === 'text').map(b => b.text).join('\n'), 2000).trim()
      if (text && (!latest || node.anchorSeq > latest.anchor)) latest = { anchor: node.anchorSeq, text }
    }
    if (!latest) return
    ws.send(JSON.stringify({ type: 'reply', request_id: item.request_id, text: latest.text }))
    clear()
  }, [chat, snapshot.running, pending])
  return null
})
