import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { imageUrl } = await req.json()
    if (!imageUrl) return NextResponse.json({ error: 'No image URL' }, { status: 400 })

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 })

    const imgRes = await fetch(imageUrl)
    if (!imgRes.ok) return NextResponse.json({ error: 'Cannot fetch image' }, { status: 400 })

    const imgBuffer = await imgRes.arrayBuffer()
    const base64 = Buffer.from(imgBuffer).toString('base64')
    const mimeType = imgRes.headers.get('content-type') || 'image/jpeg'

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: `นี่คือรูปถ่ายรถมอเตอร์ไซค์ อาจมีป้ายทะเบียนมากกว่า 1 คันในรูปเดียว
กรุณาอ่านป้ายทะเบียนรถมอเตอร์ไซค์ไทยทุกป้ายที่มองเห็นในรูปนี้ (ตัวอักษรไทย+ตัวเลข เช่น "1กข1234")
พยายามอ่านให้ได้มากที่สุด แม้บางตัวจะไม่ชัด 100% ก็ให้ใส่ค่าที่น่าจะเป็นไปได้มากที่สุด อย่าข้ามป้ายไปเฉยๆ เพราะระบบนี้มีคนตรวจสอบผลอีกชั้นอยู่แล้ว ข้ามเฉพาะกรณีที่มองไม่เห็นป้ายเลยจริงๆ (เช่น ไกลเกินไป มืดสนิท หรือมุมกล้องไม่เห็นป้ายเลย)

ระวังเป็นพิเศษ — พยัญชนะไทยคู่นี้มักถูกอ่านสับสนกันบนป้ายทะเบียน ให้พิจารณารูปทรงตัวอักษรอย่างละเอียด:
- ซ กับ ษ (ซ มีหางโค้งด้านล่าง, ษ มีเชิงตวัดขึ้น)
- ถ กับ ภ
- บ กับ ป
- ค กับ ต
- ฌ กับ ณ
- ฒ กับ ฌ

ตอบเป็น JSON เท่านั้น: {"plates": ["1กข1234", "กค5678"]}
ถ้าในรูปไม่มีป้ายทะเบียนรถมอเตอร์ไซค์เลยจริงๆ ตอบ: {"plates": []}`,
              },
              {
                inline_data: { mime_type: mimeType, data: base64 },
              },
            ],
          }],
          generationConfig: { temperature: 0 },
        }),
      }
    )

    if (!geminiRes.ok) {
      const err = await geminiRes.text()
      return NextResponse.json({ error: 'Gemini error', detail: err }, { status: 500 })
    }

    const geminiData = await geminiRes.json()
    const raw = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    let plates: string[] = []
    try {
      const match = raw.match(/\{[\s\S]*\}/)
      if (match) {
        const parsed = JSON.parse(match[0])
        if (Array.isArray(parsed.plates)) {
          plates = parsed.plates.filter((p: unknown) => typeof p === 'string' && p.trim().length > 0)
        }
      }
    } catch {
      plates = []
    }

    return NextResponse.json({ plates })
  } catch (e) {
    return NextResponse.json({ error: 'Internal error', detail: String(e) }, { status: 500 })
  }
}
