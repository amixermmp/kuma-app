// LINE Messaging API — push message helpers

export type LineMessage =
  | { type: 'text'; text: string }
  | { type: 'image'; originalContentUrl: string; previewImageUrl: string }

export function textMessage(text: string): LineMessage {
  return { type: 'text', text }
}

export function imageMessage(url: string): LineMessage {
  return { type: 'image', originalContentUrl: url, previewImageUrl: url }
}

/** ส่งข้อความหา user/group (to = userId 'U...' หรือ groupId 'C...') */
export async function linePush(token: string, to: string, messages: LineMessage[]): Promise<boolean> {
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ to, messages }),
  })
  if (!res.ok) {
    console.error('LINE push failed:', res.status, await res.text())
    return false
  }
  return true
}
