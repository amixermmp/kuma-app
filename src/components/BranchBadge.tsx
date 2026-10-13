export default function BranchBadge({ name }: { name?: string }) {
  if (!name) return null
  return (
    <span style={{
      marginLeft: '8px', fontSize: '11px', fontWeight: 700, padding: '2px 8px',
      borderRadius: '12px', background: '#eff6ff', color: '#1d4ed8', verticalAlign: 'middle',
    }}>{name}</span>
  )
}
