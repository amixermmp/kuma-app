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
                text: `นี่คือรูปสลิปโอนเงินหรือหลักฐานการชำระเงินจากแอปธนาคารไทย
กรุณาอ่านชื่อ "ผู้โอน" (บัญชีต้นทาง/From/จาก) เท่านั้น ไม่ใช่ชื่อผู้รับปลายทาง
สลิปบางแบบมีแค่ชื่อจริง ไม่มีนามสกุล ก็อ่านเท่าที่เห็น
ตอบเป็น JSON เท่านั้น: {"name": "ชื่อผู้โอน"}
ถ้าอ่านไม่ออกหรือไม่ใช่สลิปโอนเงิน (เช่นเป็นรูปเงินสด) ตอบ: {"name": ""}`,
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

    let name = ''
    try {
      const match = raw.match(/\{[^}]+\}/)
      if (match) {
        const parsed = JSON.parse(match[0])
        name = parsed.name ?? ''
      }
    } catch {
      name = ''
    }

    return NextResponse.json({ name: name.trim() })
  } catch (e) {
    return NextResponse.json({ error: 'Internal error', detail: String(e) }, { status: 500 })
  }
}
