import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import JobCard from './JobCard';

const stageBadgeColors = {
  Saved: { light: 'rgba(0,0,0,0.04)', text: '#666666' },
  Applied: { light: 'rgba(10,114,239,0.08)', text: '#0a72ef' },
  'Phone Screen': { light: 'rgba(222,29,141,0.08)', text: '#de1d8d' },
  Onsite: { light: 'rgba(121,40,202,0.08)', text: '#7928ca' },
  Offer: { light: 'rgba(16,185,129,0.08)', text: '#10b981' },
  Rejected: { light: 'rgba(255,91,79,0.08)', text: '#ff5b4f' },
};

export default function BoardColumn({ id, title, jobs, onCardClick, onDelete, onTailor }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const badge = stageBadgeColors[title] || stageBadgeColors.Saved;

  return (
    <div
      className={`w-72 shrink-0 rounded-lg flex flex-col max-h-full transition-shadow duration-150 ${
        isOver ? 'shadow-[0_0_0_2px_rgba(10,114,239,0.4)]' : 'shadow-[0_0_0_1px_rgba(0,0,0,0.08)]'
      }`}
      style={{ background: isOver ? 'rgba(10,114,239,0.04)' : 'var(--accents-1)' }}
    >
      <div
        className="rounded-t-lg bg-[var(--geist-background)] px-3 py-2.5 flex items-center justify-between"
        style={{ boxShadow: '0 1px 0 0 rgba(0,0,0,0.06)' }}
      >
        <span className="text-xs font-semibold text-[var(--geist-foreground)] tracking-[-0.01em]">{title}</span>
        <span
          className="badge"
          style={{ backgroundColor: badge.light, color: badge.text, fontSize: '11px', padding: '2px 8px' }}
        >
          {jobs.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[120px]"
      >
        <SortableContext items={jobs.map((j) => j.id.toString())} strategy={verticalListSortingStrategy}>
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onClick={() => onCardClick(job)}
              onDelete={() => onDelete(job.id)}
              onTailor={() => onTailor(job)}
            />
          ))}
        </SortableContext>
        {jobs.length === 0 && (
          <p className="text-[11px] text-[var(--accents-3)] text-center py-6">
            No jobs
          </p>
        )}
      </div>
    </div>
  );
}
