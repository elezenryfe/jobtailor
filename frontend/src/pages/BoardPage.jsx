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
      <div className="p-5 lg:p-8 max-w-full mx-auto w-full">
        <div className="flex items-center justify-between mb-5">
          <div className="h-7 w-28 bg-[var(--accents-2)] rounded animate-pulse" />
        </div>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {STAGES.map((s) => (
            <div key={s} className="w-72 shrink-0 rounded-lg bg-[var(--accents-1)] h-64 animate-pulse" style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.06)' }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 lg:p-8 max-w-full mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold text-[var(--geist-foreground)] tracking-[-0.025em]">Job Board</h1>
        <button
          onClick={() => { setEditingJob(null); setModalOpen(true); }}
          className="btn-primary"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Job
        </button>
      </div>

      {error && (
        <div className="rounded-lg p-3 text-xs mb-4" style={{ background: 'rgba(255,91,79,0.08)', color: '#ff5b4f' }}>
          {error}
        </div>
      )}

      {/* Empty state */}
      {jobs.length === 0 && (
        <div className="card p-10 text-center">
          <p className="text-4xl mb-4 opacity-50">+</p>
          <h3 className="text-sm font-semibold text-[var(--geist-foreground)] tracking-[-0.015em] mb-1">No jobs yet</h3>
          <p className="text-xs text-[var(--accents-4)] mb-5">
            Add your first job to start tracking applications.
          </p>
          <button
            onClick={() => { setEditingJob(null); setModalOpen(true); }}
            className="btn-primary"
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
          className="select-geist mb-4"
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
