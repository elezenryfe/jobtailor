import { useState, useEffect } from 'react';

const STAGES = ['Saved', 'Applied', 'Phone Screen', 'Onsite', 'Offer', 'Rejected'];

const tabBase = 'px-3 py-1.5 text-xs font-medium rounded-md transition-colors';

const getErrorMessage = (err, fallback = 'Something went wrong') => {
  const detail = err?.response?.data?.detail;
  if (!detail) return fallback;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((e) => e.msg).join(', ');
  return fallback;
};

export default function JobModal({ open, onClose, onSave, onExtract, job, resumes }) {
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
  const [activeTab, setActiveTab] = useState('form');
  const [pasteText, setPasteText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState('');
  const [submitError, setSubmitError] = useState('');

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
    setActiveTab('form');
    setPasteText('');
    setExtracting(false);
    setExtractError('');
    setSubmitError('');
  }, [job, open]);

  if (!open) return null;

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    if (submitError) setSubmitError('');
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
    setSubmitError('');
    try {
      const payload = { ...form, resume_id: form.resume_id ? parseInt(form.resume_id) : null };
      await onSave(payload, job?.id);
      onClose();
    } catch (err) {
      // Surfaced here rather than on the page: BoardPage's error banner renders
      // behind this modal's overlay, so a duplicate-URL 409 would be invisible.
      setSubmitError(getErrorMessage(err, 'Failed to save job.'));
    } finally {
      setSaving(false);
    }
  };

  const handleExtract = async () => {
    if (!pasteText.trim()) return;
    setExtracting(true);
    setExtractError('');
    try {
      const data = await onExtract(pasteText);
      setForm((prev) => ({
        ...prev,
        job_title: data.job_title || prev.job_title,
        company: data.company || prev.company,
        job_url: data.job_url || prev.job_url,
        job_description: pasteText,
        stage: 'Saved',
      }));
      setErrors({});
      if (!data.job_title || !data.company) {
        setExtractError("Couldn't find a job title or company in that text — fill them in below.");
      }
      setActiveTab('form');
    } catch (err) {
      setExtractError(getErrorMessage(err, 'Extraction failed. Please try again.'));
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center pt-[10vh] px-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative rounded-xl bg-[var(--geist-background)] w-full max-w-lg max-h-[80vh] overflow-y-auto p-6"
        style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08), 0 16px 48px rgba(0,0,0,0.12)' }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-md text-[var(--accents-4)] hover:bg-[var(--accents-1)] hover:text-[var(--geist-foreground)] transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h3 className="text-lg font-semibold text-[var(--geist-foreground)] tracking-[-0.02em] mb-5">
          {job ? 'Edit Job' : 'Add Job'}
        </h3>

        {!job && (
          <div className="flex gap-1 mb-4">
            <button
              onClick={() => setActiveTab('form')}
              className={`${tabBase} ${activeTab === 'form' ? 'bg-[var(--geist-foreground)] text-[var(--geist-background)]' : 'btn-ghost'}`}
            >
              Form
            </button>
            <button
              onClick={() => setActiveTab('paste')}
              className={`${tabBase} ${activeTab === 'paste' ? 'bg-[var(--geist-foreground)] text-[var(--geist-background)]' : 'btn-ghost'}`}
            >
              Paste JD
            </button>
          </div>
        )}

        {extractError && (
          <p className="text-[11px] text-[var(--geist-error)] mb-3">{extractError}</p>
        )}

        <div className={activeTab === 'form' ? 'space-y-3' : 'hidden'}>
          <div>
            <label className="block text-xs font-medium text-[var(--accents-5)] mb-1">Job Title *</label>
            <input
              type="text"
              value={form.job_title}
              onChange={(e) => handleChange('job_title', e.target.value)}
              placeholder="Software Engineer"
              className="input-geist"
            />
            {errors.job_title && <p className="text-[11px] text-[var(--geist-error)] mt-0.5">{errors.job_title}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--accents-5)] mb-1">Company *</label>
            <input
              type="text"
              value={form.company}
              onChange={(e) => handleChange('company', e.target.value)}
              placeholder="Acme Corp"
              className="input-geist"
            />
            {errors.company && <p className="text-[11px] text-[var(--geist-error)] mt-0.5">{errors.company}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--accents-5)] mb-1">Job URL</label>
            <input
              type="url"
              value={form.job_url}
              onChange={(e) => handleChange('job_url', e.target.value)}
              placeholder="https://..."
              className="input-geist"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--accents-5)] mb-1">Stage</label>
            <select
              value={form.stage}
              onChange={(e) => handleChange('stage', e.target.value)}
              className="select-geist"
            >
              {STAGES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--accents-5)] mb-1">Linked Resume</label>
            <select
              value={form.resume_id}
              onChange={(e) => handleChange('resume_id', e.target.value)}
              className="select-geist"
            >
              <option value="">None</option>
              {resumes.map((r) => (
                <option key={r.id} value={r.id}>{r.original_filename}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--accents-5)] mb-1">Job Description</label>
            <textarea
              rows={4}
              value={form.job_description}
              onChange={(e) => handleChange('job_description', e.target.value)}
              placeholder="Paste the job description..."
              className="textarea-geist"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--accents-5)] mb-1">Notes</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Any notes..."
              className="textarea-geist"
            />
          </div>

          {submitError && (
            <p className="text-[11px] text-[var(--geist-error)] pt-1">{submitError}</p>
          )}

          <div className={`flex gap-2 pt-3 ${activeTab === 'form' ? '' : 'hidden'}`}>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="btn-primary flex-1"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={onClose}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>

        {!job && activeTab === 'paste' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-[var(--accents-5)] mb-1">Paste Job Description</label>
              <textarea
                rows={12}
                value={pasteText}
                onChange={(e) => { setPasteText(e.target.value); if (extractError) setExtractError(''); }}
                placeholder="Paste the full job posting here..."
                className="textarea-geist"
              />
            </div>
            <button
              onClick={handleExtract}
              disabled={extracting || !pasteText.trim()}
              className="btn-primary w-full"
            >
              {extracting ? 'Extracting...' : 'Extract'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
