// ชื่อสั้นของสาขาสำหรับแสดงบนป้าย: "KUMA สาขาบางแสน" → "บางแสน", "ZAME สาชาศรีราชา" → "ศรีราชา"
// (ตัดชื่อแบรนด์ / คำว่าสาขา / ข้อความในวงเล็บออก)
export function shortBranchName(name: string): string {
  return name
    .replace(/\(.*?\)/g, '')
    .replace(/^\s*(KUMA|ZAME)\s*/i, '')
    .replace(/^สาขา|^สาชา/, '')
    .trim()
}
