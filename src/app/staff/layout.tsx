import OffsiteReminderWatcher from '@/components/OffsiteReminderWatcher'

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <OffsiteReminderWatcher />
    </>
  )
}
