import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import api from '../services/api';
import BoardColumn from '../components/BoardColumn';
import JobModal from '../components/JobModal';
import JobDetailPanel from '../components/JobDetailPanel';

const STAGES = ['Saved', 'Applied', 'Phone Screen', 'Onsite', 'Offer', 'Rejected'];

const getErrorMessage = (err, fallback = 'Something went wrong') => {
  const detail = err?.response?.data?.detail;
  if (!detail) return fallback;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((e) => e.msg).join(', ');
  return fallback;
};

export default function BoardPage() {
  const [jobs, setJobs] = useState([]);
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [detailJob, setDetailJob] = useState(null);
  const [mobileStage, setMobileStage] = useState(STAGES[0]);
  const [saving, setSaving] = useState(false);

  const navigate = useNavigate();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setError('');
    try {
      const [jobsRes, resumesRes] = await Promise.all([
        api.get('/api/jobs/'),
        api.get('/api/resume/list'),
      ]);
      setJobs(jobsRes.data);
      setResumes(resumesRes.data);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load data'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (formData, jobId) => {
    setSaving(true);
    setError('');
    try {
      if (jobId) {
        await api.patch(`/api/jobs/${jobId}`, formData);
      } else {
        await api.post('/api/jobs/', formData);
      }
      await fetchAll();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save job'));
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (jobId) => {
    if (!window.confirm('Delete this job entry?')) return;
    try {
      await api.delete(`/api/jobs/${jobId}`);
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete job'));
    }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const jobId = parseInt(active.id);
    const newStage = over.id;

    // Optimistic update
    const prev = [...jobs];
    setJobs((current) =>
      current.map((j) => (j.id === jobId ? { ...j, stage: newStage } : j))
    );

    try {
      await api.patch(`/api/jobs/${jobId}`, { stage: newStage });
    } catch {
      setJobs(prev);
      setError('Failed to move job');
    }
  };

  const handleTailor = (job) => {
    navigate('/', {
      state: {
        jobDescription: job.job_description,
        resumeId: job.resume_id,
      },
    });
  };

  const getJobsForStage = (stage) => jobs.filter((j) => j.stage === stage);

  if (loading) {
    return (
      <div className="p-4 lg:p-6 max-w-full mx-auto w-full">
        <div className="flex items-center justify-between mb-4">
          <div className="h-6 w-32 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
        </div>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {STAGES.map((s) => (
            <div key={s} className="w-72 shrink-0 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 p-3 h-64 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-full mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Job Board</h1>
        <button
          onClick={() => { setEditingJob(null); setModalOpen(true); }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Job
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-xs text-red-700 dark:text-red-400 mb-4">
          {error}
        </div>
      )}

      {/* Empty state */}
      {jobs.length === 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-10 text-center">
          <p className="text-4xl mb-3">📋</p>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">No jobs yet</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Add your first job to start tracking applications.
          </p>
          <button
            onClick={() => { setEditingJob(null); setModalOpen(true); }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Add Your First Job
          </button>
        </div>
      )}

      {/* Mobile: stage dropdown + single column */}
      <div className="lg:hidden">
        <select
          value={mobileStage}
          onChange={(e) => setMobileStage(e.target.value)}
          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 mb-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
        >
          {STAGES.map((s) => {
            const count = getJobsForStage(s).length;
            return (
              <option key={s} value={s}>{s} ({count})</option>
            );
          })}
        </select>
        <div className="max-w-sm mx-auto">
          <BoardColumn
            id={mobileStage}
            title={mobileStage}
            jobs={getJobsForStage(mobileStage)}
            onCardClick={setDetailJob}
            onDelete={handleDelete}
            onTailor={handleTailor}
          />
        </div>
      </div>

      {/* Desktop: DnD board */}
      <div className="hidden lg:flex gap-3 overflow-x-auto pb-4 items-start">
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          {STAGES.map((stage) => (
            <BoardColumn
              key={stage}
              id={stage}
              title={stage}
              jobs={getJobsForStage(stage)}
              onCardClick={setDetailJob}
              onDelete={handleDelete}
              onTailor={handleTailor}
            />
          ))}
        </DndContext>
      </div>

      {/* Modals */}
      <JobModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        job={editingJob}
        resumes={resumes}
      />

      <JobDetailPanel
        job={detailJob}
        open={!!detailJob}
        onClose={() => setDetailJob(null)}
        onEdit={(job) => { setDetailJob(null); setEditingJob(job); setModalOpen(true); }}
        onDelete={handleDelete}
        onTailor={handleTailor}
      />
    </div>
  );
}
