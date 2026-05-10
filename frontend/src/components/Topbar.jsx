export default function Topbar({ onMenuClick }) {
  return (
    <header
      className="flex h-12 items-center gap-4 bg-[var(--geist-background)] dark:bg-black px-4 lg:px-6"
      style={{ boxShadow: '0 1px 0 0 rgba(0,0,0,0.06)' }}
    >
      <button
        onClick={onMenuClick}
        className="rounded-md p-1.5 text-[var(--accents-4)] hover:bg-[var(--accents-1)] hover:text-[var(--geist-foreground)] transition-colors lg:hidden"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <div className="flex-1" />
      <span className="text-[11px] font-medium text-[var(--accents-4)] tracking-[0.02em]">JobSort v1.0</span>
    </header>
  );
}
