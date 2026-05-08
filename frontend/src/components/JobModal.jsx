import { useState, useEffect } from 'react';
import api from '../services/api';

const STAGES = ['Saved', 'Applied', 'Phone Screen', 'Onsite', 'Offer', 'Rejected'];

export default function JobModal({ open, onClose, onSave, job, resumes }) {
  const [form, setForm] = useState({
    job_title: '',
    company: '',
    job_description: '',
    job_url: '',
    notes: '',
    resume_id: '',
    stage: 'Saved',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (job) {
      setForm({
        job_title: job.job_title || '',
        company: job.company || '',
        job_description: job.job_description || '',
        job_url: job.job_url || '',
        notes: job.notes || '',
        resume_id: job.resume_id ? String(job.resume_id) : '',
        stage: job.stage || 'Saved',
      });
    } else {
      setForm({ job_title: '', company: '', job_description: '', job_url: '', notes: '', resume_id: '', stage: 'Saved' });
    }
    setErrors({});
  }, [job, open]);

  if (!open) return null;

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = () => {
    const e = {};
    if (!form.job_title.trim()) e.job_title = 'Required';
    if (!form.company.trim()) e.company = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = { ...form, resume_id: form.resume_id ? parseInt(form.resume_id) : null };
      await onSave(payload, job?.id);
      onClose();
    } catch {
      // error handled by parent
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none';

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center pt-[10vh] px-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 w-full max-w-lg max-h-[80vh] overflow-y-auto p-6 shadow-xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-md text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
          {job ? 'Edit Job' : 'Add Job'}
        </h3>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Job Title *</label>
            <input
              type="text"
              value={form.job_title}
              onChange={(e) => handleChange('job_title', e.target.value)}
              placeholder="Software Engineer"
              className={inputClass}
            />
            {errors.job_title && <p className="text-[11px] text-red-500 mt-0.5">{errors.job_title}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Company *</label>
            <input
              type="text"
              value={form.company}
              onChange={(e) => handleChange('company', e.target.value)}
              placeholder="Acme Corp"
              className={inputClass}
            />
            {errors.company && <p className="text-[11px] text-red-500 mt-0.5">{errors.company}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Job URL</label>
            <input
              type="url"
              value={form.job_url}
              onChange={(e) => handleChange('job_url', e.target.value)}
              placeholder="https://..."
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Stage</label>
            <select
              value={form.stage}
              onChange={(e) => handleChange('stage', e.target.value)}
              className={inputClass}
            >
              {STAGES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Linked Resume</label>
            <select
              value={form.resume_id}
              onChange={(e) => handleChange('resume_id', e.target.value)}
              className={inputClass}
            >
              <option value="">None</option>
              {resumes.map((r) => (
                <option key={r.id} value={r.id}>{r.original_filename}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Job Description</label>
            <textarea
              rows={4}
              value={form.job_description}
              onChange={(e) => handleChange('job_description', e.target.value)}
              placeholder="Paste the job description..."
              className={`${inputClass} resize-none`}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notes</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Any notes..."
              className={`${inputClass} resize-none`}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={onClose}
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
