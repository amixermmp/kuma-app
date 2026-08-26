const DIGIT: Record<number, string> = { 1: 'หนึ่ง', 2: 'สอง', 3: 'สาม', 4: 'สี่', 5: 'ห้า', 6: 'หก', 7: 'เจ็ด', 8: 'แปด', 9: 'เก้า' }
const PLACE = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน']

function convertGroup(numStr: string): string {
  let result = ''
  const len = numStr.length
  for (let i = 0; i < len; i++) {
    const digit = parseInt(numStr[i], 10)
    const place = len - i - 1
    if (digit === 0) continue
    if (place === 0 && digit === 1 && len > 1) result += 'เอ็ด'
    else if (place === 1 && digit === 2) result += 'ยี่สิบ'
    else if (place === 1 && digit === 1) result += 'สิบ'
    else result += DIGIT[digit] + PLACE[place]
  }
  return result
}

function numberToThaiText(value: number): string {
  if (value === 0) return 'ศูนย์'
  let intStr = Math.floor(value).toString()
  const groups: string[] = []
  while (intStr.length > 6) {
    groups.unshift(intStr.slice(-6))
    intStr = intStr.slice(0, -6)
  }
  groups.unshift(intStr)
  return groups.map((g, idx) => {
    const converted = convertGroup(g)
    if (!converted) return ''
    return converted + (idx < groups.length - 1 ? 'ล้าน' : '')
  }).join('')
}

// จำนวนเงินเป็นตัวอักษรไทย ตามธรรมเนียมใบเสร็จ/ใบกำกับภาษีไทย เช่น 4711.50 -> "สี่พันเจ็ดร้อยสิบเอ็ดบาทห้าสิบสตางค์ถ้วน"
export function bahtText(amount: number): string {
  const rounded = Math.round(amount * 100) / 100
  const baht = Math.floor(rounded)
  const satang = Math.round((rounded - baht) * 100)
  let text = numberToThaiText(baht) + 'บาท'
  text += satang === 0 ? 'ถ้วน' : numberToThaiText(satang) + 'สตางค์ถ้วน'
  return text
}
