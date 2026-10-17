export type ActionId = 'hair' | 'smile' | 'cute' | 'watermelon'

// Local classification never waits for the model and avoids negated requests.
export function requestedAction(text: string): ActionId | null {
  if (/(不要|别|不用|不许|不想|别再)/.test(text)) return null
  if (/(吃|尝|啃).{0,8}西瓜|西瓜.{0,8}(吃|尝)/.test(text)) return 'watermelon'
  if (/(拨|撩|整理|摸).{0,5}(头发|秀发)/.test(text)) return 'hair'
  if (/卖萌|撒娇|可爱一点|萌一个/.test(text)) return 'cute'
  if (/微笑|笑一个|笑一下|笑一笑/.test(text)) return 'smile'
  return null
}

export function conversationAction(text: string): {id: ActionId; explicit: boolean} | null {
  const explicit=requestedAction(text)
  if(explicit)return {id:explicit,explicit:true}
  if (/(不要|别|不用|不许|不想|别再)/.test(text))return null
  if(/你好|早上好|晚上好|谢谢|感谢|很开心|真棒/.test(text))return {id:'smile',explicit:false}
  return null
}
