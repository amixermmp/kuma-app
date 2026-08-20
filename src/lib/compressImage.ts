/**
 * Compress an image file to ≤ maxKB using Canvas API.
 * Returns a Blob (JPEG).
 */
export async function compressImage(file: File, maxKB = 200): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      let { width, height } = img

      // Downscale if larger than 1920px on either side
      const MAX_DIM = 1920
      if (width > MAX_DIM || height > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / width, MAX_DIM / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { URL.revokeObjectURL(objectUrl); reject(new Error('Canvas not supported')); return }
      ctx.drawImage(img, 0, 0, width, height)
      // revoke หลังวาดเสร็จเท่านั้น — canvas มีข้อมูลพิกเซลของตัวเองแล้วตอนนี้ ไม่ต้องพึ่ง blob เดิมอีก
      // เดิม revoke ก่อน drawImage บางเบราว์เซอร์/มือถือ (โดยเฉพาะรูปใหญ่จากกล้องรุ่นใหม่) จะลบข้อมูลจริง
      // ก่อนวาดทัน กลายเป็นวาดได้รูปดำล้วนแทน (race condition ไม่ใช่ทุกครั้ง)
      URL.revokeObjectURL(objectUrl)

      // Reduce quality until ≤ maxKB
      let quality = 0.85
      const attempt = () => {
        canvas.toBlob(blob => {
          if (!blob) { reject(new Error('Compression failed')); return }
          if (blob.size <= maxKB * 1024 || quality <= 0.15) {
            resolve(blob)
          } else {
            quality = Math.round((quality - 0.1) * 100) / 100
            attempt()
          }
        }, 'image/jpeg', quality)
      }
      attempt()
    }

    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Image load failed')) }
    img.src = objectUrl
  })
}

/**
 * Downscale an image to ≤ maxDim px while keeping PNG transparency (no JPEG re-encode).
 * ใช้กับกรอบ/สติ๊กเกอร์ที่ต้องคงพื้นหลังโปร่งใสไว้ — compressImage() ข้างบนบังคับเป็น JPEG ทำให้พื้นโปร่งใสหายไป
 */
export async function compressImagePng(file: File, maxDim = 1600): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      let { width, height } = img
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { URL.revokeObjectURL(objectUrl); reject(new Error('Canvas not supported')); return }
      ctx.drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(objectUrl)

      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('Compression failed')); return }
        resolve(blob)
      }, 'image/png')
    }

    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Image load failed')) }
    img.src = objectUrl
  })
}
