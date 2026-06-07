const DetailItem = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="mb-1 text-xs text-gray-400">{label}</p>
    <p className="wrap-break-word text-sm text-gray-100">{value || '—'}</p>
  </div>
)

export default DetailItem
