import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Kuma App — ระบบเช่ามอเตอร์ไซค์',
    short_name: 'Kuma',
    description: 'ระบบจัดการร้านเช่ามอเตอร์ไซค์',
    start_url: '/staff/home',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1e293b',
    icons: [
      { src: '/api/app-icon', sizes: '192x192', type: 'image/png' },
      { src: '/api/app-icon', sizes: '512x512', type: 'image/png' },
    ],
  }
}
