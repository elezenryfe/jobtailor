const stageBadgeColors = {
  Saved: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
  Applied: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  'Phone Screen': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
  Onsite: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  Offer: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  Rejected: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
};

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function JobDetailPanel({ job, open, onClose, onEdit, onDelete, onTailor }) {
  if (!open || !job) return null;

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/30" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-30 w-96 max-w-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Job Details</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Company</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{job.company}</p>
          </div>

          <div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Job Title</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">{job.job_title}</p>
          </div>

          <div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Stage</p>
            <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${stageBadgeColors[job.stage] || stageBadgeColors.Saved}`}>
              {job.stage}
            </span>
          </div>

          {job.job_url && (
            <div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Job Posting URL</p>
              <a
                href={job.job_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline break-all"
              >
                {job.job_url}
              </a>
            </div>
          )}

          {job.job_description && (
            <div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Job Description</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                {job.job_description}
              </p>
            </div>
          )}

          {job.notes && (
            <div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Notes</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap leading-relaxed">
                {job.notes}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-[11px] text-gray-400 dark:text-gray-500">
            <div>Created: {formatDate(job.created_at)}</div>
            <div>Updated: {formatDate(job.updated_at)}</div>
          </div>
        </div>

        {/* Actions */}
        <div className="border-t border-gray-200 dark:border-gray-800 p-4 space-y-2">
          <button
            onClick={() => onTailor(job)}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Adapt Resume for This Job
          </button>
          <button
            onClick={() => onEdit(job)}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Edit Job
          </button>
          <button
            onClick={() => { if (window.confirm('Delete this job entry?')) { onDelete(job.id); onClose(); } }}
            className="w-full rounded-lg border border-red-200 dark:border-red-800 bg-white dark:bg-gray-800 px-4 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            Delete Job
          </button>
        </div>
      </div>
    </>
  );
}
