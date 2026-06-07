const StatCard = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-xl border border-white/10 bg-white/4 p-4 shadow-lg shadow-black/10">
    <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
      {label}
    </p>
    <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
  </div>
)

export default StatCard
