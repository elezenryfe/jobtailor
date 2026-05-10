export default function SectionHeader({ icon, title, description, accent = 'success' }) {
  const accents = {
    success: { light: 'rgba(10,114,239,0.08)', text: '#0a72ef' },
    warning: { light: 'rgba(222,29,141,0.08)', text: '#de1d8d' },
    error: { light: 'rgba(255,91,79,0.08)', text: '#ff5b4f' },
    neutral: { light: 'rgba(0,0,0,0.04)', text: '#444444' },
  };
  const c = accents[accent] || accents.success;

  return (
    <div className="flex items-center gap-3 mb-5">
      <div
        className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0"
        style={{ backgroundColor: c.light, color: c.text }}
      >
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-[var(--geist-foreground)] tracking-[-0.015em]">{title}</h3>
        {description && <p className="text-[13px] text-[var(--accents-4)]">{description}</p>}
      </div>
    </div>
  );
}
