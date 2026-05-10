import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import SectionHeader from '../components/SectionHeader';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts';

const STORAGE_KEY = 'gap_analyzer_state';

const getErrorMessage = (err, fallback = 'Something went wrong') => {
  const detail = err?.response?.data?.detail;
  if (!detail) return fallback;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((e) => e.msg).join(', ');
  return fallback;
};

const suggestionCategoryColors = {
  certification: { bg: 'rgba(222,29,141,0.08)', text: '#de1d8d' },
  course: { bg: 'rgba(10,114,239,0.08)', text: '#0a72ef' },
  project: { bg: 'rgba(121,40,202,0.08)', text: '#7928ca' },
};

function loadPersistedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore corrupt data */ }
  return null;
}

function persistState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignore quota errors */ }
}

export default function GapAnalyzerPage() {
  const { dark } = useTheme();
  const persisted = loadPersistedState();
  const [resumes, setResumes] = useState([]);
  const [selectedResumeId, setSelectedResumeId] = useState(persisted?.selectedResumeId || '');
  const [analysis, setAnalysis] = useState(persisted?.analysis || null);
  const [suggestions, setSuggestions] = useState(persisted?.suggestions || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resumesLoaded, setResumesLoaded] = useState(false);

  // Auto-load resumes on mount
  useEffect(() => {
    loadResumes();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadResumes = async () => {
    if (resumesLoaded) return;
    try {
      const res = await api.get('/api/resume/list');
      setResumes(res.data);
      setResumesLoaded(true);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load resumes'));
    }
  };

  const handleFocus = () => { loadResumes(); };

  const handleAnalyze = async () => {
    if (!selectedResumeId) { setError('Select a resume first.'); return; }
    setLoading(true); setError('');
    try {
      const [analysisRes, sugRes] = await Promise.all([
        api.get('/api/gap-analyzer/analyze', { params: { resume_id: selectedResumeId } }),
        api.get('/api/gap-analyzer/suggestions', { params: { resume_id: selectedResumeId } }),
      ]);
      const newAnalysis = analysisRes.data;
      const newSuggestions = sugRes.data.suggestions || [];
      setAnalysis(newAnalysis);
      setSuggestions(newSuggestions);
      persistState({
        selectedResumeId,
        analysis: newAnalysis,
        suggestions: newSuggestions,
      });
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to analyze skills gap'));
    } finally {
      setLoading(false);
    }
  };

  const chartData = analysis
    ? analysis.radarData.map((d) => ({
        skill: d.skill,
        demand: d.demandCount,
        you: d.hasIt ? d.demandCount : 0,
      }))
    : [];

  return (
    <div className="p-5 lg:p-8 space-y-6 max-w-5xl mx-auto w-full">
      <h1 className="text-xl font-semibold text-[var(--geist-foreground)] tracking-[-0.025em]">Skills Gap Analyzer</h1>

      {/* Input Card */}
      <div className="card p-5">
        <SectionHeader
          accent="success"
          icon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
            </svg>
          }
          title="Analyze Your Skills"
          description="Compare your resume skills against what the market demands from your saved jobs."
        />
        <div className="flex flex-wrap items-end gap-3 mt-1">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-[var(--accents-5)] mb-1">Select Resume</label>
            <select
              value={selectedResumeId}
              onFocus={handleFocus}
              onChange={(e) => setSelectedResumeId(e.target.value)}
              className="select-geist"
            >
              <option value="">Select a resume...</option>
              {resumes.map((r) => (
                <option key={r.id} value={r.id}>{r.original_filename}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="btn-primary"
          >
            {loading ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>

        {error && (
          <div className="rounded-lg p-3 text-xs mt-3" style={{ background: 'rgba(255,91,79,0.08)', color: '#ff5b4f' }}>
            {error}
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="card h-64 animate-pulse" />
      )}

      {/* Results */}
      {analysis && !loading && (
        <>
          {/* Match Score + Radar */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Match Score Card */}
            <div className="card p-5 flex flex-col items-center justify-center">
              <p className="text-xs font-medium text-[var(--accents-4)] mb-2">Match Score</p>
              <p className="text-5xl font-bold text-[var(--geist-foreground)] tracking-[-0.04em]">{analysis.matchScore}%</p>
              <div className="w-full bg-[var(--accents-2)] rounded-full h-1.5 mt-4 mb-2">
                <div
                  className="h-1.5 rounded-full"
                  style={{
                    width: `${Math.min(analysis.matchScore, 100)}%`,
                    background: `linear-gradient(90deg, #ff5b4f, #de1d8d, #0a72ef)`,
                  }}
                />
              </div>
              <p className="text-xs text-[var(--accents-4)]">
                {analysis.matching.length} of {analysis.totalDemandedSkills} market skills matched
              </p>
            </div>

            {/* Radar Chart */}
            <div className="lg:col-span-2 card p-5">
              <SectionHeader
                accent="neutral"
                icon={
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                }
                title="Skills Overlap"
                description="Market demand vs. your skills."
              />
              {chartData.length === 0 ? (
                <p className="text-xs text-[var(--accents-3)] py-8 text-center">Not enough skill data to chart</p>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <RadarChart data={chartData}>
                    <PolarGrid stroke={dark ? '#333' : '#eaeaea'} />
                    <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11, fill: dark ? '#888' : '#666' }} />
                    <PolarRadiusAxis tick={{ fontSize: 10, fill: dark ? '#888' : '#666' }} />
                    <Radar name="Market Demand" dataKey="demand" stroke="#de1d8d" fill="#de1d8d" fillOpacity={0.15} />
                    <Radar name="Your Skills" dataKey="you" stroke="#10b981" fill="#10b981" fillOpacity={0.35} strokeDasharray="4 4" />
                    <Tooltip
                      contentStyle={{
                        fontSize: 12,
                        backgroundColor: dark ? '#1a1a1a' : '#ffffff',
                        border: 'none',
                        borderRadius: 8,
                        color: dark ? '#fafafa' : '#171717',
                        boxShadow: '0 0 0 1px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.12)',
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Skill Lists */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Matching */}
            <div className="card p-5">
              <h3 className="text-xs font-semibold tracking-[-0.01em] mb-2" style={{ color: '#10b981' }}>
                Matching ({analysis.matching.length})
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {analysis.matching.length === 0 ? (
                  <p className="text-xs text-[var(--accents-3)]">None</p>
                ) : (
                  analysis.matching.map((s) => (
                    <span key={s} className="badge text-[11px]" style={{ background: 'rgba(16,185,129,0.08)', color: '#10b981' }}>
                      {s}
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Missing */}
            <div className="card p-5">
              <h3 className="text-xs font-semibold tracking-[-0.01em] mb-2" style={{ color: '#ff5b4f' }}>
                Missing ({analysis.missing.length})
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {analysis.missing.length === 0 ? (
                  <p className="text-xs text-[var(--accents-3)]">None — great job!</p>
                ) : (
                  analysis.missing.map((s) => (
                    <span key={s} className="badge text-[11px]" style={{ background: 'rgba(255,91,79,0.08)', color: '#ff5b4f' }}>
                      {s}
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Extra */}
            <div className="card p-5">
              <h3 className="text-xs font-semibold text-[var(--accents-5)] tracking-[-0.01em] mb-2">
                Extra ({analysis.extra.length})
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {analysis.extra.length === 0 ? (
                  <p className="text-xs text-[var(--accents-3)]">None</p>
                ) : (
                  analysis.extra.map((s) => (
                    <span key={s} className="badge" style={{ background: 'rgba(0,0,0,0.04)', color: '#666666' }}>
                      {s}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="card p-5">
              <SectionHeader
                accent="success"
                icon={
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                }
                title="Suggestions to Close Gaps"
                description="Certifications, courses, and projects for your top missing skills."
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
                {suggestions.map((s, i) => {
                  const catColor = suggestionCategoryColors[s.category] || suggestionCategoryColors.course;
                  return (
                    <div key={i} className="rounded-lg p-3" style={{ background: 'var(--accents-1)', boxShadow: '0 0 0 1px rgba(0,0,0,0.05)' }}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="badge text-[10px]" style={{ backgroundColor: catColor.bg, color: catColor.text, padding: '2px 6px' }}>
                          {s.category}
                        </span>
                        <span className="text-xs font-semibold text-[var(--geist-foreground)]">{s.title}</span>
                      </div>
                      <p className="text-[11px] text-[var(--accents-5)] leading-relaxed">{s.description}</p>
                      {s.url && (
                        <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-block mt-1.5 text-[11px] text-[var(--geist-success)] hover:underline">
                          Learn more →
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!analysis && !loading && (
        <div className="card p-10 text-center">
          <p className="text-4xl mb-4 opacity-30">+</p>
          <h3 className="text-sm font-semibold text-[var(--geist-foreground)] tracking-[-0.015em] mb-1">Find your skill gaps</h3>
          <p className="text-xs text-[var(--accents-4)]">
            Select a resume and click Analyze to see how you stack up against the market.
          </p>
        </div>
      )}
    </div>
  );
}
