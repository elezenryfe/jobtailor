import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import StatsCard from '../components/StatsCard';
import WelcomeBanner from '../components/WelcomeBanner';
import SectionHeader from '../components/SectionHeader';

const getErrorMessage = (err, fallback = 'Something went wrong') => {
  const detail = err?.response?.data?.detail;
  if (!detail) return fallback;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((e) => e.msg).join(', ');
  return fallback;
};

const modeLabels = {
  both: 'Your adapted resume and cover letter are ready.',
  resume: 'Your adapted resume is ready.',
  cover_letter: 'Your cover letter is ready.',
};

const statsIcons = {
  resumes: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12',
  generated: 'M13 10V3L4 14h7v7l9-11h-7z',
  adapted: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
};

const inputCls = 'input-geist';
const selectCls = 'select-geist';
const textareaCls = 'textarea-geist';

export default function Dashboard() {
  const location = useLocation();
  const { user } = useAuth();
  const userId = user?.id;

  const genCountKey = userId ? `jobsort_generatedCount_${userId}` : 'jobsort_generatedCount';
  const adaptedCountKey = userId ? `jobsort_adaptedCount_${userId}` : 'jobsort_adaptedCount';

  const [resumes, setResumes] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [selectedResumeId, setSelectedResumeId] = useState('');
  const [selectedJobId, setSelectedJobId] = useState('');
  const [usePasted, setUsePasted] = useState(false);
  const [jobDesc, setJobDesc] = useState('');
  const [generationMode, setGenerationMode] = useState('both');

  const modeHints = {
    both: 'Will call AI to adapt your resume AND generate a cover letter.',
    resume: 'Will call AI to adapt your resume only. No cover letter.',
    cover_letter: 'Will call AI to generate a cover letter only. Resume will not be adapted.',
  };

  const handleModeChange = (mode) => {
    setGenerationMode(mode);
    setAdapted(null);
    setEditData(null);
    setEditCoverLetter('');
    setDownloadTracked(false);
  };
  const [adapted, setAdapted] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [generatedCount, setGeneratedCount] = useState(() => {
    const saved = localStorage.getItem(genCountKey);
    return saved ? parseInt(saved, 10) : 0;
  });
  const [adaptedCount, setAdaptedCount] = useState(() => {
    const saved = localStorage.getItem(adaptedCountKey);
    return saved ? parseInt(saved, 10) : 0;
  });
  const [downloadTracked, setDownloadTracked] = useState(false);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState(null);
  const [editCoverLetter, setEditCoverLetter] = useState('');
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => { fetchResumes(); fetchJobs(); }, []);

  useEffect(() => { localStorage.setItem(genCountKey, generatedCount); }, [generatedCount, genCountKey]);
  useEffect(() => { localStorage.setItem(adaptedCountKey, adaptedCount); }, [adaptedCount, adaptedCountKey]);

  useEffect(() => {
    if (location.state?.jobDescription) {
      setUsePasted(true);
      setJobDesc(location.state.jobDescription);
      if (location.state?.resumeId) setSelectedResumeId(String(location.state.resumeId));
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const fetchResumes = async () => {
    try { const res = await api.get('/api/resume/list'); setResumes(res.data); } catch { /* */ }
  };
  const fetchJobs = async () => {
    try { const res = await api.get('/api/jobs/'); setJobs(res.data); } catch { /* */ }
  };

  const handleJobSelect = (jobId) => {
    setSelectedJobId(jobId);
    if (jobId) {
      const job = jobs.find((j) => j.id === parseInt(jobId));
      if (job) { setJobDesc(job.job_description || ''); setUsePasted(false); }
    }
  };

  const [deletingResumeId, setDeletingResumeId] = useState(null);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError('');
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try { await api.post('/api/resume/upload', formData); await fetchResumes(); e.target.value = ''; }
    catch (err) { setError(getErrorMessage(err, 'Upload failed')); }
    finally { setUploading(false); }
  };

  const handleDeleteResume = async (resumeId) => {
    setError('');
    setDeletingResumeId(resumeId);
    try {
      await api.delete(`/api/resume/${resumeId}`);
      if (String(selectedResumeId) === String(resumeId)) setSelectedResumeId('');
      await fetchResumes();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete resume'));
    } finally {
      setDeletingResumeId(null);
    }
  };

  const handleGenerate = async () => {
    setError('');
    if (!selectedResumeId) { setError('Please select a resume.'); return; }
    if (!jobDesc.trim()) { setError('Please enter or select a job description.'); return; }
    setLoading(true);
    setAdapted(null);
    setDownloadTracked(false);
    setEditing(false);
    try {
      const res = await api.post('/api/tailor/', {
        resume_id: parseInt(selectedResumeId),
        job_description: jobDesc,
        mode: generationMode,
      });
      setAdapted(res.data);
      setEditData(res.data.tailored_resume_json ? { ...res.data.tailored_resume_json } : null);
      setEditCoverLetter(res.data.cover_letter_text || '');
      setGeneratedCount((c) => c + 1);
    } catch (err) {
      if (err?.response?.status === 429) {
        setError('Too many requests — wait a moment and try again.');
      } else {
        setError(getErrorMessage(err, 'Generation failed'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const res = await api.post('/api/tailor/regenerate-pdf', {
        tailored_resume_json: editData,
        cover_letter_text: editCoverLetter,
        mode: generationMode,
      });
      setAdapted((prev) => ({ ...prev, ...res.data }));
      const base = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      if (res.data.resume_pdf_url) {
        window.open(base + res.data.resume_pdf_url, '_blank');
      }
      if (res.data.cover_letter_pdf_url) {
        window.open(base + res.data.cover_letter_pdf_url, '_blank');
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to regenerate PDF'));
    } finally {
      setRegenerating(false);
    }
  };

  const handleDownload = () => {
    if (!downloadTracked) { setAdaptedCount((c) => c + 1); setDownloadTracked(true); }
  };

  const updateEditField = (field, value) => {
    setEditData((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const updateExperienceItem = (idx, field, value) => {
    setEditData((prev) => {
      if (!prev) return prev;
      const exp = [...(prev.experience || [])];
      exp[idx] = { ...exp[idx], [field]: value };
      return { ...prev, experience: exp };
    });
  };
  const updateExpBullets = (idx, bullets) => {
    setEditData((prev) => {
      if (!prev) return prev;
      const exp = [...(prev.experience || [])];
      exp[idx] = { ...exp[idx], bullets };
      return { ...prev, experience: exp };
    });
  };
  const addExperienceItem = () => {
    setEditData((prev) => prev ? { ...prev, experience: [...(prev.experience || []), { title: '', company: '', dates: '', bullets: [] }] } : prev);
  };
  const removeExperienceItem = (idx) => {
    setEditData((prev) => prev ? { ...prev, experience: prev.experience.filter((_, i) => i !== idx) } : prev);
  };

  const updateEducationItem = (idx, field, value) => {
    setEditData((prev) => {
      if (!prev) return prev;
      const edu = [...(prev.education || [])];
      edu[idx] = { ...edu[idx], [field]: value };
      return { ...prev, education: edu };
    });
  };
  const addEducationItem = () => {
    setEditData((prev) => prev ? { ...prev, education: [...(prev.education || []), { degree: '', school: '', year: '' }] } : prev);
  };
  const removeEducationItem = (idx) => {
    setEditData((prev) => prev ? { ...prev, education: prev.education.filter((_, i) => i !== idx) } : prev);
  };

  const updateCertificationItem = (idx, field, value) => {
    setEditData((prev) => {
      if (!prev) return prev;
      const certs = [...(prev.certifications || [])];
      certs[idx] = { ...certs[idx], [field]: value };
      return { ...prev, certifications: certs };
    });
  };
  const addCertificationItem = () => {
    setEditData((prev) => prev ? { ...prev, certifications: [...(prev.certifications || []), { name: '', year: '' }] } : prev);
  };
  const removeCertificationItem = (idx) => {
    setEditData((prev) => prev ? { ...prev, certifications: prev.certifications.filter((_, i) => i !== idx) } : prev);
  };

  const updateOtherItem = (idx, field, value) => {
    setEditData((prev) => {
      if (!prev) return prev;
      const other = [...(prev.other || [])];
      other[idx] = { ...other[idx], [field]: value };
      return { ...prev, other };
    });
  };
  const addOtherItem = () => {
    setEditData((prev) => prev ? { ...prev, other: [...(prev.other || []), { heading: '', content: '' }] } : prev);
  };
  const removeOtherItem = (idx) => {
    setEditData((prev) => prev ? { ...prev, other: prev.other.filter((_, i) => i !== idx) } : prev);
  };

  const smallInputCls = 'input-geist text-xs h-8';

  const fieldLabelCls = 'text-[11px] font-medium text-[var(--accents-4)] mb-0.5';
  const sectionTitleCls = 'text-xs font-semibold text-[var(--geist-foreground)] tracking-[-0.01em] mb-1.5';

  const tabBase = 'px-3 py-1.5 text-xs font-medium rounded-md transition-colors';

  return (
    <div className="p-5 lg:p-8 space-y-6 max-w-5xl mx-auto w-full">
      <WelcomeBanner />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard label="Resumes" value={resumes.length} icon={statsIcons.resumes} accent="success" />
        <StatsCard label="Generated" value={generatedCount} icon={statsIcons.generated} accent="warning" />
        <StatsCard label="Jobs Adapted" value={adaptedCount} icon={statsIcons.adapted} accent="success" />
      </div>

      {/* Upload */}
      <div className="card p-6">
        <SectionHeader
          accent="success"
          icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>}
          title="Upload Resume"
          description="Upload a PDF to extract structured data."
        />
        <label className={`btn-primary ${uploading ? 'opacity-50' : ''}`}>
          {uploading ? 'Uploading...' : 'Choose PDF'}
          <input type="file" accept="application/pdf" onChange={handleUpload} className="hidden" disabled={uploading} />
        </label>

        {resumes.length > 0 && (
          <div className="mt-4 pt-4 border-t border-[var(--accents-2)]">
            <div className="text-[11px] font-medium text-[var(--accents-4)] mb-2">Uploaded resumes</div>
            <div className="space-y-1">
              {resumes.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-md px-2 py-1.5 bg-[var(--accents-1)]">
                  <span className="text-xs text-[var(--accents-6)] truncate mr-2">{r.original_filename}</span>
                  <button
                    onClick={() => handleDeleteResume(r.id)}
                    disabled={deletingResumeId === r.id}
                    className="text-[11px] text-[var(--geist-error)] hover:underline shrink-0 disabled:opacity-50"
                  >
                    {deletingResumeId === r.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Adapt Card */}
      <div className="card p-6">
        <SectionHeader
          accent="neutral"
          icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>}
          title="Adapt Documents"
          description="AI-powered resume adaptation and cover letter generation from saved jobs."
        />
        <div className="space-y-3 mt-1">
          <select value={selectedResumeId} onChange={(e) => setSelectedResumeId(e.target.value)} className={selectCls}>
            <option value="">Select a resume...</option>
            {resumes.map((r) => (<option key={r.id} value={r.id}>{r.original_filename}</option>))}
          </select>

          <div className="flex gap-1">
            <button onClick={() => { setUsePasted(false); setSelectedJobId(''); }} className={`${tabBase} ${!usePasted ? 'bg-[var(--geist-foreground)] text-[var(--geist-background)]' : 'btn-ghost'}`}>
              From Saved Job
            </button>
            <button onClick={() => { setUsePasted(true); setSelectedJobId(''); }} className={`${tabBase} ${usePasted ? 'bg-[var(--geist-foreground)] text-[var(--geist-background)]' : 'btn-ghost'}`}>
              Paste JD
            </button>
          </div>

          {!usePasted ? (
            <select value={selectedJobId} onChange={(e) => handleJobSelect(e.target.value)} className={selectCls}>
              <option value="">Select a saved job...</option>
              {jobs.filter((j) => j.stage === 'Saved' && j.job_description).map((j) => (<option key={j.id} value={j.id}>{j.company} — {j.job_title}</option>))}
            </select>
          ) : (
            <textarea rows={5} value={jobDesc} onChange={(e) => setJobDesc(e.target.value)} placeholder="Paste the job description here..." className={textareaCls} />
          )}

          {!usePasted && selectedJobId && jobDesc && (
            <div className="rounded-lg bg-[var(--accents-1)] p-3 max-h-32 overflow-y-auto" style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.06)' }}>
              <p className="text-[11px] text-[var(--accents-4)] whitespace-pre-wrap line-clamp-4">{jobDesc}</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[var(--accents-5)] mb-1.5">Generate</label>
            <div className="flex gap-1.5 flex-wrap">
              {[{ key: 'both', label: 'Resume + Cover Letter' }, { key: 'resume', label: 'Resume Only' }, { key: 'cover_letter', label: 'Cover Letter Only' }].map((opt) => (
                <button key={opt.key} onClick={() => handleModeChange(opt.key)} className={`${tabBase} ${generationMode === opt.key ? 'bg-[var(--accents-1)] text-[var(--geist-foreground)] font-medium' : 'btn-ghost'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-[var(--accents-4)] mt-1.5">{modeHints[generationMode]}</p>
          </div>

          {error && (
            <div className="rounded-lg p-3 text-xs" style={{ background: 'rgba(255,91,79,0.08)', color: '#ff5b4f' }}>
              {error}
            </div>
          )}

          <button onClick={handleGenerate} disabled={loading} className="btn-primary">
            {loading ? (
              <>
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating...
              </>
            ) : 'Generate with AI'}
          </button>
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="card p-6 space-y-4 animate-pulse">
          <div className="h-4 w-48 bg-[var(--accents-2)] rounded" />
          <div className="h-3 w-72 bg-[var(--accents-2)] rounded" />
          <div className="space-y-2 mt-4">
            <div className="h-3 w-full bg-[var(--accents-2)] rounded" />
            <div className="h-3 w-5/6 bg-[var(--accents-2)] rounded" />
            <div className="h-3 w-4/6 bg-[var(--accents-2)] rounded" />
          </div>
          <div className="flex justify-center pt-4">
            <div className="h-3 w-36 bg-[var(--accents-2)] rounded" />
          </div>
        </div>
      )}

      {/* Results */}
      {adapted && !loading && (
        <div className="card p-6">
          <SectionHeader
            accent="success"
            icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            title="Generated Documents"
            description={modeLabels[generationMode]}
          />

          {/* Download buttons */}
          <div className="flex flex-wrap gap-2 mb-5">
            {adapted.resume_pdf_url && (
              <a href={`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${adapted.resume_pdf_url}`} target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ background: '#0a72ef' }} download onClick={handleDownload}>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Adapted Resume
              </a>
            )}
            {adapted.cover_letter_pdf_url && (
              <a href={`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${adapted.cover_letter_pdf_url}`} target="_blank" rel="noopener noreferrer" className="btn-primary" download onClick={handleDownload}>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Cover Letter
              </a>
            )}
          </div>

          {/* Divider */}
          <div className="pt-5" style={{ borderTop: '1px solid var(--accents-2)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold text-[var(--geist-foreground)] tracking-[-0.01em]">Preview & Edit</h3>
              <button
                onClick={() => setEditing(!editing)}
                className={`text-xs font-medium px-3 py-1 rounded-md transition-colors ${
                  editing
                    ? 'bg-[var(--accents-1)] text-[var(--geist-foreground)]'
                    : 'btn-ghost'
                }`}
              >
                {editing ? 'Done Editing' : 'Edit'}
              </button>
            </div>

            {editData && (generationMode === 'both' || generationMode === 'resume') && (
              <div className="space-y-5">
                {/* Header fields */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <div className={fieldLabelCls}>Full Name</div>
                    {editing ? (
                      <input value={editData.full_name || ''} onChange={(e) => updateEditField('full_name', e.target.value)} className={`${smallInputCls} w-full`} />
                    ) : (
                      <p className="text-sm font-semibold text-[var(--geist-foreground)]">{editData.full_name || '—'}</p>
                    )}
                  </div>
                  <div>
                    <div className={fieldLabelCls}>Email</div>
                    {editing ? (
                      <input value={editData.email || ''} onChange={(e) => updateEditField('email', e.target.value)} className={`${smallInputCls} w-full`} />
                    ) : (
                      <p className="text-sm text-[var(--accents-6)]">{editData.email || '—'}</p>
                    )}
                  </div>
                  <div>
                    <div className={fieldLabelCls}>Phone</div>
                    {editing ? (
                      <input value={editData.phone || ''} onChange={(e) => updateEditField('phone', e.target.value)} className={`${smallInputCls} w-full`} />
                    ) : (
                      <p className="text-sm text-[var(--accents-6)]">{editData.phone || '—'}</p>
                    )}
                  </div>
                </div>

                {/* Summary */}
                <div>
                  <div className={fieldLabelCls}>Summary</div>
                  {editing ? (
                    <textarea rows={2} value={editData.summary || ''} onChange={(e) => updateEditField('summary', e.target.value)} className={textareaCls} />
                  ) : (
                    <p className="text-xs text-[var(--accents-5)] leading-relaxed">{editData.summary || '—'}</p>
                  )}
                </div>

                {/* Experience */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className={sectionTitleCls}>Experience</div>
                    {editing && (
                      <button onClick={addExperienceItem} className="text-[11px] font-medium text-[var(--geist-success)] hover:underline">+ Add</button>
                    )}
                  </div>
                  {(editData.experience || []).map((exp, i) => (
                    <div key={i} className="rounded-lg p-3 mb-2" style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.06)' }}>
                      {editing ? (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <input value={exp.title || ''} onChange={(e) => updateExperienceItem(i, 'title', e.target.value)} placeholder="Title" className={`${smallInputCls} flex-1`} />
                            <input value={exp.company || ''} onChange={(e) => updateExperienceItem(i, 'company', e.target.value)} placeholder="Company" className={`${smallInputCls} flex-1`} />
                            <input value={exp.dates || ''} onChange={(e) => updateExperienceItem(i, 'dates', e.target.value)} placeholder="Dates" className={`${smallInputCls} w-32`} />
                          </div>
                          <textarea
                            rows={2}
                            value={(exp.bullets || []).join('\n')}
                            onChange={(e) => updateExpBullets(i, e.target.value.split('\n'))}
                            placeholder="Bullet points (one per line)"
                            className={textareaCls}
                          />
                          <button onClick={() => removeExperienceItem(i)} className="text-[11px] text-[var(--geist-error)] hover:underline">Remove</button>
                        </div>
                      ) : (
                        <div>
                          <span className="text-xs font-semibold text-[var(--geist-foreground)]">{exp.title || 'Untitled'}</span>
                          {exp.company && <span className="text-xs text-[var(--accents-5)]"> — {exp.company}</span>}
                          {exp.dates && <span className="text-[11px] text-[var(--accents-4)] ml-2">{exp.dates}</span>}
                          {(exp.bullets || []).length > 0 && (
                            <ul className="mt-1 ml-3 list-disc text-[11px] text-[var(--accents-5)] space-y-0.5">
                              {exp.bullets.map((b, bi) => <li key={bi}>{b}</li>)}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Education */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className={sectionTitleCls}>Education</div>
                    {editing && (
                      <button onClick={addEducationItem} className="text-[11px] font-medium text-[var(--geist-success)] hover:underline">+ Add</button>
                    )}
                  </div>
                  {(editData.education || []).map((edu, i) => (
                    <div key={i} className="rounded-lg p-3 mb-2" style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.06)' }}>
                      {editing ? (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <input value={edu.degree || ''} onChange={(e) => updateEducationItem(i, 'degree', e.target.value)} placeholder="Degree" className={`${smallInputCls} flex-1`} />
                            <input value={edu.school || ''} onChange={(e) => updateEducationItem(i, 'school', e.target.value)} placeholder="School" className={`${smallInputCls} flex-1`} />
                            <input value={edu.year || ''} onChange={(e) => updateEducationItem(i, 'year', e.target.value)} placeholder="Year" className={`${smallInputCls} w-24`} />
                          </div>
                          <button onClick={() => removeEducationItem(i)} className="text-[11px] text-[var(--geist-error)] hover:underline">Remove</button>
                        </div>
                      ) : (
                        <p className="text-xs text-[var(--accents-6)]">
                          {edu.degree || 'Degree'}{edu.school ? `, ${edu.school}` : ''}{edu.year ? ` (${edu.year})` : ''}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Skills */}
                <div>
                  <div className={fieldLabelCls}>Skills</div>
                  {editing ? (
                    <input
                      value={(editData.skills || []).join(', ')}
                      onChange={(e) => updateEditField('skills', e.target.value.split(/\s*,\s*/).filter(Boolean))}
                      placeholder="Python, React, SQL..."
                      className={inputCls}
                    />
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {(editData.skills || []).length === 0 ? (
                        <p className="text-xs text-[var(--accents-3)]">—</p>
                      ) : (
                        editData.skills.map((s) => (
                          <span key={s} className="badge bg-[var(--accents-1)] text-[var(--accents-5)]">{s}</span>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Certifications */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className={sectionTitleCls}>Certifications</div>
                    {editing && (
                      <button onClick={addCertificationItem} className="text-[11px] font-medium text-[var(--geist-success)] hover:underline">+ Add</button>
                    )}
                  </div>
                  {(editData.certifications || []).map((cert, i) => (
                    <div key={i} className="rounded-lg p-3 mb-2" style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.06)' }}>
                      {editing ? (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <input value={cert.name || ''} onChange={(e) => updateCertificationItem(i, 'name', e.target.value)} placeholder="Name" className={`${smallInputCls} flex-1`} />
                            <input value={cert.year || ''} onChange={(e) => updateCertificationItem(i, 'year', e.target.value)} placeholder="Year" className={`${smallInputCls} w-24`} />
                          </div>
                          <button onClick={() => removeCertificationItem(i)} className="text-[11px] text-[var(--geist-error)] hover:underline">Remove</button>
                        </div>
                      ) : (
                        <p className="text-xs text-[var(--accents-6)]">{cert.name || 'Certification'}{cert.year ? ` (${cert.year})` : ''}</p>
                      )}
                    </div>
                  ))}

                {/* Dynamic sections (projects, publications, awards, etc.) */}
                {(editData.other || []).map((item, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className={sectionTitleCls}>{item.heading || 'Untitled Section'}</div>
                      {editing && (
                        <button onClick={() => removeOtherItem(i)} className="text-[11px] text-[var(--geist-error)] hover:underline">Remove</button>
                      )}
                    </div>
                    {editing ? (
                      <div className="space-y-2 mb-3">
                        <input value={item.heading || ''} onChange={(e) => updateOtherItem(i, 'heading', e.target.value)} placeholder="Section heading" className={`${smallInputCls} w-full`} />
                        <textarea
                          rows={3}
                          value={item.content || ''}
                          onChange={(e) => updateOtherItem(i, 'content', e.target.value)}
                          placeholder="Section content"
                          className={textareaCls}
                        />
                      </div>
                    ) : (
                      <p className="text-[11px] text-[var(--accents-5)] whitespace-pre-line mb-3">{item.content || '—'}</p>
                    )}
                  </div>
                ))}
                {editing && (
                  <button onClick={addOtherItem} className="text-[11px] font-medium text-[var(--geist-success)] hover:underline">+ Add Section</button>
                )}
              </div>
              </div>
            )}

            {/* Cover letter preview */}
            {(generationMode === 'both' || generationMode === 'cover_letter') && editCoverLetter && (
              <div className={generationMode === 'both' ? 'mt-5 pt-5 border-t border-[var(--accents-2)]' : ''}>
                <div className={sectionTitleCls}>Cover Letter</div>
                {editing ? (
                  <textarea rows={6} value={editCoverLetter} onChange={(e) => setEditCoverLetter(e.target.value)} className={textareaCls} />
                ) : (
                  <p className="text-xs text-[var(--accents-5)] leading-relaxed whitespace-pre-wrap">{editCoverLetter}</p>
                )}
              </div>
            )}

            {/* Re-generate button — always visible when results exist */}
            <div className="mt-5 pt-5 border-t border-[var(--accents-2)]">
              <button
                onClick={handleRegenerate}
                disabled={regenerating}
                className="btn-primary"
              >
                {regenerating ? (
                  <>
                    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Re-generating...
                  </>
                ) : 'Re-generate PDF with Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
