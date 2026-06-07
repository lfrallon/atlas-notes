const StatusMessage = ({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode
  tone?: 'neutral' | 'danger'
}) => (
  <p
    className={`mt-3 rounded-md border px-3 py-2 text-sm ${
      tone === 'danger'
        ? 'border-red-500/50 bg-red-500/10 text-red-300'
        : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-100'
    }`}
  >
    {children}
  </p>
)

export default StatusMessage
