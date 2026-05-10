export default function StatsCard({ label, value, icon, accent = 'success' }) {
  const accents = {
    success: { light: 'rgba(10,114,239,0.08)', text: '#0a72ef' },
    warning: { light: 'rgba(222,29,141,0.08)', text: '#de1d8d' },
    error: { light: 'rgba(255,91,79,0.08)', text: '#ff5b4f' },
    neutral: { light: 'rgba(0,0,0,0.04)', text: '#444444' },
  };
  const c = accents[accent] || accents.success;

  return (
    <div className="card-hover p-5">
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: c.light, color: c.text }}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
          </svg>
        </div>
        <div>
          <p className="text-2xl font-semibold text-[var(--geist-foreground)] tracking-[-0.02em]">{value}</p>
          <p className="text-[13px] text-[var(--accents-4)]">{label}</p>
        </div>
      </div>
    </div>
  );
}
