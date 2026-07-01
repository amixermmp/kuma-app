import Link from 'next/link'
import QrScanner from './QrScanner'

export default function ScanPage() {
  return (
    <div className="app-wrap">
      <div className="app-header">
        <Link href="/staff/home" className="app-header-back">←</Link>
        <div>
          <h1>สแกน QR รถ</h1>
          <div className="sub">ส่องกล้องไปที่ QR Code บนรถ</div>
        </div>
      </div>
      <QrScanner />
    </div>
  )
}
