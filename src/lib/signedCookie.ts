// คุกกี้สิทธิ์พนักงานแบบมีลายเซ็น (HMAC-SHA256) — กันปลอมคุกกี้เข้าระบบ
// เดิมคุกกี้เก็บรหัสพนักงานเปล่าๆ แล้วเช็คแค่ "มีคุกกี้ไหม" → ใส่ค่ามั่วก็เข้าหน้าพนักงานได้ทุกสาขา
// รูปแบบค่า: `${value}.${exp}.${sig}` — exp = วินาที unix, sig ผูกชื่อคุกกี้ + ค่า + exp (ย้ายข้ามคุกกี้/ต่ออายุเองไม่ได้)
// ใช้ Web Crypto ล้วน รันได้ทั้ง middleware (edge) และ route handler (node)
// กุญแจ derive จาก SUPABASE_SERVICE_ROLE_KEY (ความลับฝั่งเซิร์ฟเวอร์ที่มีอยู่แล้ว) — ไม่ต้องตั้ง env ใหม่

export const SIGNED_COOKIES = ['kuma_staff_id', 'kuma_owner_pass', 'kuma_checkin_date', 'kuma_schedule_view'] as const

const enc = new TextEncoder()
let keyPromise: Promise<CryptoKey> | null = null

function getKey(): Promise<CryptoKey> {
  if (!keyPromise) {
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!secret) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing — cannot sign cookies')
    keyPromise = crypto.subtle.importKey('raw', enc.encode(`kuma-cookie-v1|${secret}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  }
  return keyPromise
}

function b64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function mac(name: string, value: string, exp: number): Promise<string> {
  return b64url(await crypto.subtle.sign('HMAC', await getKey(), enc.encode(`${name}|${value}|${exp}`)))
}

/** ค่าคุกกี้ที่เซ็นแล้ว — maxAgeSec ควรเท่ากับ maxAge ของคุกกี้ */
export async function signCookieValue(name: string, value: string, maxAgeSec: number): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + maxAgeSec
  return `${value}.${exp}.${await mac(name, value, exp)}`
}

/** คืนค่าเดิมถ้าลายเซ็นถูกและยังไม่หมดอายุ ไม่งั้น null (รวมคุกกี้รูปแบบเก่าที่ไม่มีลายเซ็น) */
export async function verifyCookieValue(name: string, raw: string | undefined): Promise<string | null> {
  if (!raw) return null
  const i2 = raw.lastIndexOf('.')
  const i1 = raw.lastIndexOf('.', i2 - 1)
  if (i1 <= 0 || i2 <= i1) return null
  const value = raw.slice(0, i1)
  const exp = Number(raw.slice(i1 + 1, i2))
  const sig = raw.slice(i2 + 1)
  if (!Number.isFinite(exp) || exp < Date.now() / 1000) return null
  const expected = await mac(name, value, exp)
  // เทียบแบบเวลาคงที่
  if (expected.length !== sig.length) return null
  let diff = 0
  for (let i = 0; i < sig.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i)
  return diff === 0 ? value : null
}
