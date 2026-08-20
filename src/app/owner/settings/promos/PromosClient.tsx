'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Section, Toggle, SettingsHeader } from '../_shared'

type Promo = { id: string; name: string | null; code: string | null; description: string | null; discount_type: string; discount_value: number; min_days: number | null; bonus_days: number | null; is_active: boolean; is_student_promo: boolean }

const discountLabel = (p: Promo) => {
  if (p.discount_type === 'percent') return `ลด ${p.discount_value}%`
  if (p.discount_type === 'fixed') return `ลด ฿${p.discount_value}`
  if (p.discount_type === 'bonus_days') return `เช่า ${p.min_days} วัน แถม ${p.bonus_days} วัน`
  if (p.discount_type === 'flat_rate') return `฿${p.discount_value}/วัน`
  return ''
}

export default function PromosClient({ promotions: initialPromos }: { promotions: Promo[] }) {
  const [promos, setPromos] = useState(initialPromos)

  const togglePromo = async (id: string, current: boolean) => {
    setPromos(prev => prev.map(p => p.id === id ? { ...p, is_active: !current } : p))
    await fetch(`/api/owner/settings/promo/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !current }),
    })
  }

  const toggleStudentPromo = async (id: string, current: boolean) => {
    setPromos(prev => prev.map(p => ({ ...p, is_student_promo: p.id === id ? !current : false })))
    await fetch(`/api/owner/settings/promo/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_student_promo: !current }),
    })
  }

  return (
    <>
      <SettingsHeader title="🎁 โปรโมชั่น" sub="จัดการส่วนลด/แพ็คเกจ" />

      <div style={{ paddingBottom: '40px' }}>
        <Section title="โปรโมชั่นทั้งหมด">
          <div style={{ padding: '12px 16px' }}>
            {promos.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {p.name ?? p.description ?? p.code}
                    {p.is_student_promo && (
                      <span style={{ fontSize: '10px', fontWeight: 700, color: '#be185d', background: '#fff1f2', padding: '2px 6px', borderRadius: '999px' }}>🎓 ราคานักศึกษา</span>
                    )}
                  </div>
                  <div style={{ fontSize: '11px', color: '#9ca3af' }}>{discountLabel(p)}</div>
                  <button
                    onClick={() => toggleStudentPromo(p.id, p.is_student_promo)}
                    style={{
                      marginTop: '4px', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                      background: 'none', border: 'none', padding: 0,
                      color: p.is_student_promo ? '#9ca3af' : '#be185d',
                    }}
                  >
                    {p.is_student_promo ? 'เลิกใช้เป็นราคานักศึกษา' : '🎓 ตั้งเป็นราคานักศึกษา'}
                  </button>
                </div>
                <Toggle on={p.is_active} onClick={() => togglePromo(p.id, p.is_active)} />
              </div>
            ))}
            <Link href="/owner/settings/promos/create" className="btn" style={{ display: 'block', textAlign: 'center', marginTop: '12px', border: '1.5px solid #374151', color: '#374151', background: '#fff', textDecoration: 'none' }}>
              + สร้างโปรโมชั่นใหม่
            </Link>
          </div>
        </Section>
      </div>
    </>
  )
}
