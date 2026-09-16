import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json()
    if (!text || !text.trim()) return NextResponse.json({ error: 'ไม่มีข้อความ' }, { status: 400 })

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 })

    const nowBkk = new Date(Date.now() + 7 * 60 * 60 * 1000)
    const todayIso = nowBkk.toISOString().slice(0, 10)
    const beYear = nowBkk.getUTCFullYear() + 543

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `วันนี้คือวันที่ ${todayIso} (ปี พ.ศ. ${beYear})
ข้อความจากลูกค้าร้านเช่ามอเตอร์ไซค์:
"""
${text}
"""
กรุณาอ่านหาวันที่-เวลา "รับรถ" และ "คืนรถ" จากข้อความนี้ (ลูกค้าอาจพิมพ์ว่า วันรับ/รับเวลา/วันเริ่มเช่า และ วันคืน/คืนเวลา/วีนคืน หรือพิมพ์ผิดแบบอื่น)
กฎการตีความ:
- วันที่แบบไทยเรียง วัน/เดือน/ปี เสมอ (เช่น 26/9/69 คือวันที่ 26 เดือน 9)
- ปี พ.ศ. 2 หลัก (เช่น 69) ให้แปลงเป็น ค.ศ. เต็ม (69 = พ.ศ. 2569 = ค.ศ. 2026)
- ถ้าไม่ระบุปีเลย ให้เลือกปีที่ทำให้วันนั้นเป็นอนาคตที่ใกล้วันนี้ที่สุด
- เวลาอาจเขียนด้วยจุดหรือจุดสองจุด (เช่น 09.00 หรือ 09:00) ถือว่าความหมายเดียวกัน
- ถ้าข้อความมีเรื่องอื่นปนอยู่ด้วย (เช่นเปลี่ยนรุ่น เปลี่ยนเวลาจองเดิม) ให้ยึดวันที่-เวลาที่ระบุไว้ล่าสุดเป็นช่วงรับ-คืนจริงที่ต้องการ
ตอบเป็น JSON เท่านั้นรูปแบบนี้: {"startDate": "YYYY-MM-DD", "startTime": "HH:mm", "endDate": "YYYY-MM-DD", "endTime": "HH:mm"}
ถ้าหาฟิลด์ไหนไม่เจอ ให้ใส่ null ในฟิลด์นั้น`,
            }],
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

    let startDate: string | null = null, startTime: string | null = null
    let endDate: string | null = null, endTime: string | null = null
    try {
      const match = raw.match(/\{[\s\S]*\}/)
      if (match) {
        const parsed = JSON.parse(match[0])
        startDate = parsed.startDate ?? null
        startTime = parsed.startTime ?? null
        endDate = parsed.endDate ?? null
        endTime = parsed.endTime ?? null
      }
    } catch {
      // อ่านไม่ออก — ปล่อยเป็น null ทั้งหมด ให้พนักงานกรอกเอง
    }

    return NextResponse.json({ startDate, startTime, endDate, endTime })
  } catch (e) {
    return NextResponse.json({ error: 'Internal error', detail: String(e) }, { status: 500 })
  }
}
