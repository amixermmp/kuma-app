// รูปสำหรับ "เลขา" — หาแหล่งรูปของรถ/ลูกค้า และเตรียมส่งเข้าไลน์ (อ่านอย่างเดียว)
// รูปทุกใบอ้างด้วยรหัส "[รูป:bucket/path]" (ดู photoHandle ใน secretaryTools) แล้วเซ็นลิงก์สดใหม่ตอนส่ง ไม่พึ่งลิงก์เก่าที่อาจหมดอายุ

import { cleanRow, normPlate, photoHandle } from '@/lib/secretaryTools'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = any

export const MAX_PHOTOS_PER_REPLY = 12

const KEY_LABEL: Record<string, string> = {
  id_card: 'บัตรประชาชน', selfie: 'เซลฟี่ลูกค้า', with_bike: 'ถ่ายคู่รถ', payment: 'หลักฐานชำระเงิน',
  damage: 'รอยตำหนิรถ', student_id_card: 'บัตรนักศึกษา', accommodation_proof: 'หลักฐานที่พัก',
}
const keyLabel = (k: string) => KEY_LABEL[k] ?? k

type Photo = { handle: string; label: string }

// ดึงรูป (เฉพาะรูปในที่เก็บไฟล์ของระบบ) จากค่าคอลัมน์ได้หลายรูปแบบ: ลิงก์เดียว / {ชื่อ: ลิงก์} / [ลิงก์] / [{url,label}]
function collectPhotos(value: any, label: string, out: Photo[]) {
  if (!value) return
  if (typeof value === 'string') {
    const h = photoHandle(value)
    if (h) out.push({ handle: h, label })
    return
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => {
      if (v && typeof v === 'object' && typeof v.url === 'string') collectPhotos(v.url, `${label} — ${keyLabel(String(v.label ?? i + 1))}`, out)
      else collectPhotos(v, `${label} ${i + 1}`, out)
    })
    return
  }
  if (typeof value === 'object') for (const [k, v] of Object.entries(value)) collectPhotos(v, `${label} — ${keyLabel(k)}`, out)
}

const fmtDay = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: '2-digit' }) : '')

// ค้นรูปจาก ทะเบียน (รถ + เอกสารรถ + รูปตอนรับ/คืนในสัญญาล่าสุด + รูปซ่อม) หรือ ชื่อ/เบอร์ลูกค้า (รูปในสัญญาล่าสุดของลูกค้า)
export async function findPhotos(db: Db, query: string) {
  const raw = String(query ?? '').trim()
  if (!raw) return { error: 'ไม่ได้ระบุทะเบียน หรือชื่อ/เบอร์ลูกค้า' }
  const photos: Photo[] = []
  const notes: string[] = []

  const q = normPlate(raw)
  const { data: bikes } = await db.from('bikes').select('id, license_plate, brand, model, photo_url')
  const bikeMatches = (bikes ?? []).filter((b: any) => q.length >= 3 && normPlate(b.license_plate).includes(q))

  if (bikeMatches.length > 4) return { found: bikeMatches.length, message: 'ตรงหลายคัน ให้ระบุทะเบียนให้ชัดขึ้น', plates: bikeMatches.slice(0, 15).map((b: any) => b.license_plate) }

  if (bikeMatches.length > 0) {
    for (const b of bikeMatches) {
      const tag = `${b.license_plate} ${b.brand} ${b.model}`
      collectPhotos(b.photo_url, `รถ ${tag}`, photos)
      const [{ data: docs }, { data: rentals }, { data: monthly }, { data: repairs }] = await Promise.all([
        db.from('bike_documents').select('doc_type, doc_photo_url, expiry_date').eq('bike_id', b.id),
        db.from('rentals').select('start_datetime, send_photos, return_photos, customers(name)').eq('bike_id', b.id).order('start_datetime', { ascending: false }).limit(3),
        db.from('monthly_rentals').select('start_date, send_photos, return_photos, customers(name)').eq('bike_id', b.id).order('start_date', { ascending: false }).limit(2),
        db.from('repairs').select('title, created_at, repair_photos').eq('bike_id', b.id).order('created_at', { ascending: false }).limit(3),
      ])
      for (const d of docs ?? []) collectPhotos(d.doc_photo_url, `เอกสารรถ ${tag} — ${d.doc_type}${d.expiry_date ? ` (หมดอายุ ${d.expiry_date})` : ''}`, photos)
      for (const r of rentals ?? []) {
        const who = Array.isArray(r.customers) ? r.customers[0]?.name : r.customers?.name
        collectPhotos(r.send_photos, `ตอนรับรถ ${tag} — ${who ?? ''} ${fmtDay(r.start_datetime)}`, photos)
        collectPhotos(r.return_photos, `ตอนคืนรถ ${tag} — ${who ?? ''} ${fmtDay(r.start_datetime)}`, photos)
      }
      for (const r of monthly ?? []) {
        const who = Array.isArray(r.customers) ? r.customers[0]?.name : r.customers?.name
        collectPhotos(r.send_photos, `รายเดือน ตอนรับ ${tag} — ${who ?? ''} ${fmtDay(r.start_date)}`, photos)
        collectPhotos(r.return_photos, `รายเดือน ตอนคืน ${tag} — ${who ?? ''} ${fmtDay(r.start_date)}`, photos)
      }
      for (const r of repairs ?? []) collectPhotos(r.repair_photos, `ซ่อม ${tag} — ${r.title ?? ''} ${fmtDay(r.created_at)}`, photos)
    }
  } else {
    const digits = raw.replace(/\D/g, '')
    let req = db.from('customers').select('id, name, phone').limit(4)
    req = digits.length >= 4 ? req.or(`phone.ilike.%${digits}%,name.ilike.%${raw}%`) : req.ilike('name', `%${raw}%`)
    const { data: customers } = await req
    if (!customers?.length) return { found: 0, message: `ไม่พบรถหรือลูกค้าที่ตรงกับ "${raw}"` }
    if (customers.length > 3) return { found: customers.length, message: 'ตรงหลายคน ให้ระบุชื่อเต็มหรือเบอร์', customers: customers.map((c: any) => `${c.name} ${c.phone ?? ''}`) }
    for (const c of customers) {
      const [{ data: rentals }, { data: monthly }] = await Promise.all([
        db.from('rentals').select('start_datetime, send_photos, return_photos, bikes(license_plate)').eq('customer_id', c.id).order('start_datetime', { ascending: false }).limit(3),
        db.from('monthly_rentals').select('start_date, send_photos, return_photos, bikes(license_plate)').eq('customer_id', c.id).order('start_date', { ascending: false }).limit(2),
      ])
      for (const r of rentals ?? []) {
        const plate = Array.isArray(r.bikes) ? r.bikes[0]?.license_plate : r.bikes?.license_plate
        collectPhotos(r.send_photos, `${c.name} — ตอนรับรถ ${plate ?? ''} ${fmtDay(r.start_datetime)}`, photos)
        collectPhotos(r.return_photos, `${c.name} — ตอนคืนรถ ${plate ?? ''} ${fmtDay(r.start_datetime)}`, photos)
      }
      for (const r of monthly ?? []) {
        const plate = Array.isArray(r.bikes) ? r.bikes[0]?.license_plate : r.bikes?.license_plate
        collectPhotos(r.send_photos, `${c.name} — รายเดือน ตอนรับ ${plate ?? ''} ${fmtDay(r.start_date)}`, photos)
        collectPhotos(r.return_photos, `${c.name} — รายเดือน ตอนคืน ${plate ?? ''} ${fmtDay(r.start_date)}`, photos)
      }
    }
    notes.push('ลายเซ็นลูกค้าเก็บเป็นข้อมูลฝังในสัญญา ส่งเป็นรูปในไลน์ไม่ได้')
  }

  const seen = new Set<string>()
  const unique = photos.filter(p => (seen.has(p.handle) ? false : (seen.add(p.handle), true)))
  if (unique.length === 0) return { found: 0, message: 'ไม่พบรูปที่เกี่ยวข้อง', notes }
  return cleanRow({ count: unique.length, photos: unique.slice(0, 40), notes, how_to_send: 'เลือกรหัส handle ที่ต้องการแล้วเรียก send_photos (ส่งได้ไม่เกิน ' + MAX_PHOTOS_PER_REPLY + ' รูปต่อคำตอบ)' })
}

export type ResolvedPhoto = { handle: string; url: string | null; sendable: boolean }

// เซ็นลิงก์สดใหม่ (อายุ 1 ชั่วโมง) ให้รหัสรูปแต่ละใบ — ไลน์ส่งรูปได้เฉพาะ JPEG/PNG ที่เหลือส่งเป็นลิงก์ข้อความ
export async function resolvePhotos(db: Db, handles: string[]): Promise<ResolvedPhoto[]> {
  const out: ResolvedPhoto[] = []
  for (const handle of handles.slice(0, MAX_PHOTOS_PER_REPLY)) {
    const m = /^\[รูป:([^/\]]+)\/(.+)\]$/.exec(String(handle).trim())
    if (!m) { out.push({ handle, url: null, sendable: false }); continue }
    const { data, error } = await db.storage.from(m[1]).createSignedUrl(m[2], 3600)
    if (error || !data?.signedUrl) { out.push({ handle, url: null, sendable: false }); continue }
    out.push({ handle, url: data.signedUrl, sendable: /\.(jpe?g|png)$/i.test(m[2]) && data.signedUrl.length <= 1900 })
  }
  return out
}
