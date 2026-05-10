import { useState } from 'react';

function formatSalary(job) {
  if (job.min_salary == null && job.max_salary == null) return null;
  const fmt = (n) => {
    if (n >= 1000) return `$${(n / 1000).toFixed(0)}k`;
    return `$${n.toFixed(0)}`;
  };
  const min = job.min_salary != null ? fmt(job.min_salary) : '';
  const max = job.max_salary != null ? fmt(job.max_salary) : '';
  const period = job.salary_period === 'yearly' ? '/yr' : job.salary_period === 'monthly' ? '/mo' : job.salary_period === 'hourly' ? '/hr' : '';
  if (min && max) return `${min} - ${max}${period}`;
  if (min) return `From ${min}${period}`;
  if (max) return `Up to ${max}${period}`;
  return null;
}

function timeAgo(dateStr) {
  if (!dateStr) return null;
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const days = Math.floor((now - then) / 86400000);
  if (days < 0) return null;
  if (days === 0) return 'Today';
  if (days === 1) return '1d ago';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function JobSearchCard({ job, onAutoApply, onSaveJob, saving, saved, savedStage }) {
  const [expanded, setExpanded] = useState(false);
  const salary = formatSalary(job);
  const postedAgo = timeAgo(job.posted_at);
  const hasFullDesc = job.job_description && job.job_description.length > 200;

  return (
    <div className="card-hover p-3 flex flex-col gap-1.5">
      {/* Title & Company */}
      <p className="text-xs font-semibold text-[var(--geist-foreground)] tracking-[-0.01em] line-clamp-1">
        {job.job_title}
      </p>
      <p className="text-[11px] text-[var(--accents-5)]">{job.company}</p>

      {/* Meta badges row */}
      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
        {job.location && (
          <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--accents-1)] text-[var(--accents-5)]">
            {job.location}
          </span>
        )}
        {salary && (
          <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-[rgba(16,185,129,0.08)] text-[#10b981] font-medium">
            {salary}
          </span>
        )}
        {job.employment_type && (
          <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-[rgba(10,114,239,0.08)] text-[#0a72ef]">
            {job.employment_type}
          </span>
        )}
        {postedAgo && (
          <span className="text-[10px] text-[var(--accents-3)]">{postedAgo}</span>
        )}
        {job.publisher && (
          <span className="text-[10px] text-[var(--accents-3)]">via {job.publisher}</span>
        )}
      </div>

      {/* Description excerpt */}
      {job.job_description && (
        <div className="mt-0.5">
          <p className="text-[11px] text-[var(--accents-4)] leading-relaxed line-clamp-2">
            {job.job_description}
          </p>
          {(hasFullDesc || job.required_skills?.length > 0) && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[10px] text-[var(--accents-4)] hover:text-[var(--geist-foreground)] mt-0.5"
            >
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      )}

      {/* Expanded detail */}
      {expanded && (
        <div className="mt-1 p-2 rounded-md bg-[var(--accents-1)] space-y-2">
          {hasFullDesc && (
            <div>
              <p className="text-[10px] font-medium text-[var(--accents-5)] mb-0.5">Full Description</p>
              <p className="text-[11px] text-[var(--accents-4)] leading-relaxed whitespace-pre-line">
                {job.job_description}
              </p>
            </div>
          )}
          {job.required_skills?.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-[var(--accents-5)] mb-1">Required Skills</p>
              <div className="flex flex-wrap gap-1">
                {job.required_skills.map((skill, i) => (
                  <span key={i} className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-[var(--geist-background)] text-[var(--accents-5)]">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
          {job.job_url && (
            <a
              href={job.job_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-[var(--geist-success)] hover:underline inline-block"
            >
              View original listing →
            </a>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 mt-auto pt-2">
        <button
          onClick={() => { onAutoApply(); if (job.job_url) window.open(job.job_url, '_blank', 'noopener'); }}
          disabled={saving || savedStage === 'Applied'}
          className="btn-primary btn-sm flex-1"
        >
          {saving ? 'Saving...' : savedStage === 'Applied' ? 'Applied' : 'Apply'}
        </button>
        <button
          onClick={onSaveJob}
          disabled={saving || saved}
          className={`btn-sm flex-1 rounded-md text-xs font-medium transition-colors ${
            saved ? 'bg-[var(--accents-1)] text-[var(--accents-4)] cursor-default' : 'btn-secondary'
          }`}
        >
          {saved ? (savedStage === 'Applied' ? 'Applied' : 'Saved') : 'Save'}
        </button>
      </div>
    </div>
  );
}
