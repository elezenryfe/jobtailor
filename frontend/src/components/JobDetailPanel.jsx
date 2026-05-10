const stageBadgeColors = {
  Saved: { light: 'rgba(0,0,0,0.04)', text: '#666666' },
  Applied: { light: 'rgba(10,114,239,0.08)', text: '#0a72ef' },
  'Phone Screen': { light: 'rgba(222,29,141,0.08)', text: '#de1d8d' },
  Onsite: { light: 'rgba(121,40,202,0.08)', text: '#7928ca' },
  Offer: { light: 'rgba(16,185,129,0.08)', text: '#10b981' },
  Rejected: { light: 'rgba(255,91,79,0.08)', text: '#ff5b4f' },
};

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function JobDetailPanel({ job, open, onClose, onEdit, onDelete, onTailor }) {
  if (!open || !job) return null;
  const badge = stageBadgeColors[job.stage] || stageBadgeColors.Saved;

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div
        className="fixed inset-y-0 right-0 z-30 w-96 max-w-full bg-[var(--geist-background)] flex flex-col"
        style={{ boxShadow: '-1px 0 0 0 rgba(0,0,0,0.08), -8px 0 24px rgba(0,0,0,0.06)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ boxShadow: '0 1px 0 0 rgba(0,0,0,0.06)' }}
        >
          <h3 className="text-sm font-semibold text-[var(--geist-foreground)] tracking-[-0.015em]">Job Details</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[var(--accents-4)] hover:bg-[var(--accents-1)] hover:text-[var(--geist-foreground)] transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <p className="text-xs text-[var(--accents-4)] mb-0.5">Company</p>
            <p className="text-sm font-semibold text-[var(--geist-foreground)]">{job.company}</p>
          </div>

          <div>
            <p className="text-xs text-[var(--accents-4)] mb-0.5">Job Title</p>
            <p className="text-sm text-[var(--accents-6)]">{job.job_title}</p>
          </div>

          <div>
            <p className="text-xs text-[var(--accents-4)] mb-0.5">Stage</p>
            <span
              className="badge"
              style={{ backgroundColor: badge.light, color: badge.text, fontSize: '12px' }}
            >
              {job.stage}
            </span>
          </div>

          {job.job_url && (
            <div>
              <p className="text-xs text-[var(--accents-4)] mb-0.5">Job Posting URL</p>
              <a
                href={job.job_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[var(--geist-success)] hover:underline break-all"
              >
                {job.job_url}
              </a>
            </div>
          )}

          {job.job_description && (
            <div>
              <p className="text-xs text-[var(--accents-4)] mb-0.5">Job Description</p>
              <p className="text-xs text-[var(--accents-5)] whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                {job.job_description}
              </p>
            </div>
          )}

          {job.notes && (
            <div>
              <p className="text-xs text-[var(--accents-4)] mb-0.5">Notes</p>
              <p className="text-xs text-[var(--accents-5)] whitespace-pre-wrap leading-relaxed">
                {job.notes}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-[11px] text-[var(--accents-3)]">
            <div>Created: {formatDate(job.created_at)}</div>
            <div>Updated: {formatDate(job.updated_at)}</div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 space-y-2" style={{ boxShadow: '0 -1px 0 0 rgba(0,0,0,0.06)' }}>
          <button
            onClick={() => onTailor(job)}
            className="btn-primary w-full"
          >
            Adapt Resume for This Job
          </button>
          <button
            onClick={() => onEdit(job)}
            className="btn-secondary w-full"
          >
            Edit Job
          </button>
          <button
            onClick={() => { if (window.confirm('Delete this job entry?')) { onDelete(job.id); onClose(); } }}
            className="w-full rounded-md px-4 py-2 text-xs font-medium transition-colors"
            style={{ background: 'rgba(255,91,79,0.08)', color: '#ff5b4f' }}
          >
            Delete Job
          </button>
        </div>
      </div>
    </>
  );
}
