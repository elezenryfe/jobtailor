import { useDraggable } from '@dnd-kit/core';

export default function JobCard({ job, onClick, onDelete, onTailor }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: job.id.toString(),
  });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  const days = Math.floor((Date.now() - new Date(job.updated_at)) / 86400000);
  const daysLabel = days === 0 ? 'Today' : days === 1 ? '1d ago' : `${days}d ago`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`rounded-md bg-[var(--geist-background)] p-3 cursor-grab active:cursor-grabbing transition-shadow select-none ${
        isDragging
          ? 'opacity-50 shadow-[0_0_0_1px_rgba(10,114,239,0.4),0_8px_24px_rgba(0,0,0,0.12)]'
          : 'shadow-[0_0_0_1px_rgba(0,0,0,0.06)] hover:shadow-[0_0_0_1px_rgba(0,0,0,0.1),0_4px_12px_rgba(0,0,0,0.06)]'
      } ${job.stage === 'Rejected' ? 'opacity-60' : ''}`}
      onClick={(e) => {
        if (e.target.closest('button')) return;
        onClick();
      }}
    >
      <div className="flex items-start justify-between gap-1">
        <p className="text-xs font-semibold text-[var(--geist-foreground)] tracking-[-0.01em] truncate">
          {job.company}
        </p>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="shrink-0 p-1 rounded text-[var(--accents-4)] hover:text-[var(--geist-error)] hover:bg-[rgba(255,91,79,0.08)] transition-colors"
          title="Delete job"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      <p className="text-[11px] text-[var(--accents-4)] mt-0.5 truncate">
        {job.job_title}
      </p>

      <div className="flex items-center justify-between mt-2.5">
        <span className="text-[10px] text-[var(--accents-3)]">{daysLabel}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onTailor(); }}
          className="text-[10px] font-medium px-2 py-0.5 rounded-md transition-colors"
          style={{ background: 'rgba(10,114,239,0.08)', color: '#0a72ef' }}
        >
          Adapt
        </button>
      </div>
    </div>
  );
}
