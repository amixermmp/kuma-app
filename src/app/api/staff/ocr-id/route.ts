import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { imageUrl } = await req.json()
    if (!imageUrl) return NextResponse.json({ error: 'No image URL' }, { status: 400 })

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 })

    // Fetch image from Supabase and convert to base64
    const imgRes = await fetch(imageUrl)
    if (!imgRes.ok) return NextResponse.json({ error: 'Cannot fetch image' }, { status: 400 })

    const imgBuffer = await imgRes.arrayBuffer()
    const base64 = Buffer.from(imgBuffer).toString('base64')
    const mimeType = imgRes.headers.get('content-type') || 'image/jpeg'

    // Call Gemini Vision
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: `นี่คือรูปบัตรประชาชนไทยหรือพาสปอร์ต
กรุณาอ่านชื่อ-นามสกุลของเจ้าของบัตร และเลขประจำตัว
ถ้าเป็นบัตรประชาชนไทย ให้ใช้ชื่อภาษาไทย และอ่านเลขประจำตัวประชาชน 13 หลัก (ตัวเลขล้วน ไม่มีขีด/เว้นวรรค)
ถ้าเป็นพาสปอร์ตต่างชาติ ให้ใช้ชื่อภาษาอังกฤษ และอ่านเลขที่พาสปอร์ต (ตัวอักษร+ตัวเลขตามที่ปรากฏ)
ตอบเป็น JSON เท่านั้น: {"name": "ชื่อ นามสกุล", "idCardNumber": "เลขประจำตัว"}
ถ้าอ่านไม่ออกหรือไม่ใช่บัตรประชาชน/พาสปอร์ต ตอบ: {"name": "", "idCardNumber": ""}
ถ้าอ่านชื่อได้แต่อ่านเลขประจำตัวไม่ออก ให้ idCardNumber เป็น ""`,
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

    // Parse JSON from response
    let name = ''
    let idCardNumber = ''
    try {
      const match = raw.match(/\{[^}]+\}/)
      if (match) {
        const parsed = JSON.parse(match[0])
        name = parsed.name ?? ''
        idCardNumber = parsed.idCardNumber ?? ''
      }
    } catch {
      name = ''
      idCardNumber = ''
    }

    return NextResponse.json({ name: name.trim(), idCardNumber: idCardNumber.trim() })
  } catch (e) {
    return NextResponse.json({ error: 'Internal error', detail: String(e) }, { status: 500 })
  }
}
