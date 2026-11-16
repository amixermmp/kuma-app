import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { webApiGuard, isUuid } from '@/lib/webApiAuth'
import { loadZones, startingPrices, FREE_DELIVERY_MIN_DAYS } from '@/lib/webQuote'

export const dynamic = 'force-dynamic'

// รายการรุ่นที่ขายบนเว็บ + ราคาเริ่มต้น + โซนค่าส่ง — ไม่มีข้อมูลรถว่าง/ไม่ว่าง ไม่มีข้อมูลลูกค้า
export async function GET(request: Request) {
  const denied = webApiGuard(request)
  if (denied) return denied

  const branchId = new URL(request.url).searchParams.get('branch_id')
  if (!isUuid(branchId)) return NextResponse.json({ error: 'invalid_branch' }, { status: 400 })

  const admin = createAdminClient()
  const [branchRes, settingsRes, bikesRes, pricingRes, webRes, zones] = await Promise.all([
    admin.from('branches').select('id, name').eq('id', branchId).maybeSingle(),
    admin.from('branch_settings').select('line_id, receipt_phone').eq('branch_id', branchId).maybeSingle(),
    admin.from('bikes').select('brand, model, photo_url, status').eq('branch_id', branchId),
    admin.from('branch_model_pricing').select('brand, model, daily_rate, monthly_rate, promo_pay_days').eq('branch_id', branchId),
    admin.from('web_model_settings').select('brand, model, visible, photo_url, sort_order').eq('branch_id', branchId),
    loadZones(admin, branchId),
  ])
  if (!branchRes.data) return NextResponse.json({ error: 'invalid_branch' }, { status: 404 })

  const key = (brand: string, model: string) => `${brand}__${model}`
  const pricing = new Map((pricingRes.data ?? []).map(p => [key(p.brand, p.model), p]))
  const web = new Map((webRes.data ?? []).map(w => [key(w.brand, w.model), w]))

  // รวมรถเป็นรุ่น — ไม่นับรถปลดระวาง/ปิดใช้งาน เก็บรูปแรกที่มีไว้เป็นรูปสำรอง
  const models = new Map<string, { brand: string; model: string; fallbackPhoto: string | null }>()
  for (const b of bikesRes.data ?? []) {
    if (b.status === 'retired' || b.status === 'inactive') continue
    const k = key(b.brand, b.model)
    const cur = models.get(k)
    if (!cur) models.set(k, { brand: b.brand, model: b.model, fallbackPhoto: b.photo_url ?? null })
    else if (!cur.fallbackPhoto && b.photo_url) cur.fallbackPhoto = b.photo_url
  }

  const items = []
  for (const [k, m] of Array.from(models)) {
    const p = pricing.get(k)
    const w = web.get(k)
    if (w && w.visible === false) continue
    if (!p || p.daily_rate == null || Number(p.daily_rate) <= 0) continue
    const daily = Number(p.daily_rate)
    const monthly = p.monthly_rate != null && Number(p.monthly_rate) > 0 ? Number(p.monthly_rate) : daily * 30
    items.push({
      brand: m.brand,
      model: m.model,
      photo_url: w?.photo_url || m.fallbackPhoto,
      sort_order: w?.sort_order ?? 0,
      price: startingPrices({ daily, monthly, payDays: p.promo_pay_days ?? 5 }),
    })
  }
  items.sort((a, b) => a.sort_order - b.sort_order || a.price.daily - b.price.daily || a.model.localeCompare(b.model))

  return NextResponse.json({
    branch: { id: branchRes.data.id, line_id: settingsRes.data?.line_id ?? null, phone: settingsRes.data?.receipt_phone ?? null },
    free_delivery_min_days: FREE_DELIVERY_MIN_DAYS,
    zones,
    models: items.map(({ sort_order, ...rest }) => { void sort_order; return rest }),
  })
}
