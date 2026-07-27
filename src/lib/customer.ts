// เบอร์โทร "จริง" ต้องมีเลขอย่างน้อย 9 หลัก (เกณฑ์เดียวกับที่ฝั่ง client ใช้ก่อนยิง lookup/blacklist)
// ใช้กันก่อน match ลูกค้าเดิมด้วยเบอร์โทร — staff ที่ไม่มีเบอร์จริงมักพิมพ์ "," หรือ "-" ผ่าน required
// field เฉยๆ ถ้าเอาไปเทียบตรงๆ ลูกค้าคนละคนที่ใช้ placeholder เดียวกันในสาขาเดียวกันจะไปชนกันเป็นคนเดียวกัน
export function isRealPhone(phone: string): boolean {
  return phone.replace(/\D/g, '').length >= 9
}
