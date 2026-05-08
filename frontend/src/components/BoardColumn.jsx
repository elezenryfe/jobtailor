import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import JobCard from './JobCard';

const stageColors = {
  Saved: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
  Applied: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  'Phone Screen': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
  Onsite: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  Offer: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  Rejected: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
};

export default function BoardColumn({ id, title, jobs, onCardClick, onDelete, onTailor }) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      className={`w-72 shrink-0 rounded-xl border flex flex-col max-h-full ${
        isOver
          ? 'border-blue-400 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
          : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50'
      }`}
    >
      <div className="rounded-t-xl border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2.5 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{title}</span>
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${stageColors[title] || stageColors.Saved}`}>
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
          <p className="text-[11px] text-gray-400 dark:text-gray-600 text-center py-6">
            No jobs
          </p>
        )}
      </div>
    </div>
  );
}
