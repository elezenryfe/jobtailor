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
      className={`rounded-lg border bg-white dark:bg-gray-900 p-3 cursor-grab active:cursor-grabbing transition-shadow hover:shadow-sm ${
        isDragging
          ? 'opacity-50 shadow-lg border-blue-400 dark:border-blue-500'
          : 'border-gray-200 dark:border-gray-800'
      } ${job.stage === 'Rejected' ? 'opacity-60' : ''}`}
      onClick={(e) => {
        // Don't open detail if clicking action buttons
        if (e.target.closest('button')) return;
        onClick();
      }}
    >
      <div className="flex items-start justify-between gap-1">
        <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">
          {job.company}
        </p>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="shrink-0 p-0.5 rounded text-gray-400 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          title="Delete job"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">
        {job.job_title}
      </p>

      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] text-gray-400 dark:text-gray-500">{daysLabel}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onTailor(); }}
          className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
        >
          Adapt Resume
        </button>
      </div>
    </div>
  );
}
