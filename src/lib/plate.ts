// ตัดช่องว่าง/ขีดออกเพื่อเทียบป้ายทะเบียนแบบไม่สนใจการเว้นวรรค — ใช้ทั้งฝั่ง client (จับคู่ OCR) และ server (ตรวจซ้ำ)
export function normalizePlate(plate: string): string {
  return plate.replace(/[\s\-]/g, '').toLowerCase()
}

// Levenshtein distance — ใช้เช็คว่าป้ายที่บอทอ่านได้ "ใกล้เคียง" กับป้ายที่คาดหวังแค่ตัวเดียวไหม
// (เช่น บอทอ่านพยัญชนะไทยสับสน ซ↔ษ แต่ตัวเลขตรงหมด) เพื่อแยกจากกรณีอ่านผิดเยอะ/คนละคันจริงๆ
export function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0))
  for (let i = 0; i <= a.length; i++) dp[i][0] = i
  for (let j = 0; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[a.length][b.length]
}

export function isNearMatch(a: string, b: string): boolean {
  return levenshtein(a, b) === 1
}
