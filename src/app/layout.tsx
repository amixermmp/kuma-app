import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Kuma App — ระบบเช่ามอเตอร์ไซค์',
  description: 'ระบบจัดการร้านเช่ามอเตอร์ไซค์',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
  icons: {
    apple: '/api/app-icon',
  },
  themeColor: '#1e293b',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  )
}
