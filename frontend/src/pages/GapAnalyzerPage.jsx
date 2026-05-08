import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import SectionHeader from '../components/SectionHeader';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts';

const getErrorMessage = (err, fallback = 'Something went wrong') => {
  const detail = err?.response?.data?.detail;
  if (!detail) return fallback;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((e) => e.msg).join(', ');
  return fallback;
};

export default function GapAnalyzerPage() {
  const { dark } = useTheme();
  const [resumes, setResumes] = useState([]);
  const [selectedResumeId, setSelectedResumeId] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resumesLoaded, setResumesLoaded] = useState(false);

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
    setLoading(true); setError(''); setAnalysis(null); setSuggestions([]);
    try {
      const [analysisRes, sugRes] = await Promise.all([
        api.get('/api/gap-analyzer/analyze', { params: { resume_id: selectedResumeId } }),
        api.get('/api/gap-analyzer/suggestions', { params: { resume_id: selectedResumeId } }),
      ]);
      setAnalysis(analysisRes.data);
      setSuggestions(sugRes.data.suggestions || []);
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

  const suggestionCategoryColors = {
    certification: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
    course: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    project: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-5xl mx-auto w-full">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Skills Gap Analyzer</h1>

      {/* Input Card */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
        <SectionHeader
          accent="indigo"
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
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Select Resume</label>
            <select
              value={selectedResumeId}
              onFocus={handleFocus}
              onChange={(e) => setSelectedResumeId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
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
            className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors h-[38px]"
          >
            {loading ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-xs text-red-700 dark:text-red-400 mt-3">
            {error}
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 h-64 animate-pulse" />
      )}

      {/* Results */}
      {analysis && !loading && (
        <>
          {/* Match Score + Radar */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Match Score Card */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 flex flex-col items-center justify-center">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Match Score</p>
              <p className="text-4xl font-bold text-gray-900 dark:text-gray-100">{analysis.matchScore}%</p>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-3 mb-2">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500"
                  style={{ width: `${Math.min(analysis.matchScore, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {analysis.matching.length} of {analysis.totalDemandedSkills} market skills matched
              </p>
            </div>

            {/* Radar Chart */}
            <div className="lg:col-span-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
              <SectionHeader
                accent="purple"
                icon={
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                }
                title="Skills Overlap"
                description="Market demand vs. your skills."
              />
              {chartData.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-600 py-8 text-center">Not enough skill data to chart</p>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <RadarChart data={chartData}>
                    <PolarGrid stroke={dark ? '#374151' : '#e5e7eb'} />
                    <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11, fill: dark ? '#9ca3af' : '#6b7280' }} />
                    <PolarRadiusAxis tick={{ fontSize: 10, fill: dark ? '#9ca3af' : '#6b7280' }} />
                    <Radar name="Market Demand" dataKey="demand" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.15} />
                    <Radar name="Your Skills" dataKey="you" stroke="#10b981" fill="#10b981" fillOpacity={0.35} strokeDasharray="4 4" />
                    <Tooltip
                      contentStyle={{ fontSize: 12, backgroundColor: dark ? '#1f2937' : '#fff', border: dark ? '1px solid #374151' : '1px solid #e5e7eb', borderRadius: 8, color: dark ? '#f3f4f6' : '#111827' }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Skill Lists */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Matching */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
              <h3 className="text-xs font-semibold text-green-600 dark:text-green-400 mb-2">
                Matching ({analysis.matching.length})
              </h3>
              <div className="flex flex-wrap gap-1">
                {analysis.matching.length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-gray-600">None</p>
                ) : (
                  analysis.matching.map((s) => (
                    <span key={s} className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400">
                      {s}
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Missing */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
              <h3 className="text-xs font-semibold text-red-600 dark:text-red-400 mb-2">
                Missing ({analysis.missing.length})
              </h3>
              <div className="flex flex-wrap gap-1">
                {analysis.missing.length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-gray-600">None — great job!</p>
                ) : (
                  analysis.missing.map((s) => (
                    <span key={s} className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
                      {s}
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Extra */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                Extra ({analysis.extra.length})
              </h3>
              <div className="flex flex-wrap gap-1">
                {analysis.extra.length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-gray-600">None</p>
                ) : (
                  analysis.extra.map((s) => (
                    <span key={s} className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                      {s}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
              <SectionHeader
                accent="green"
                icon={
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                }
                title="Suggestions to Close Gaps"
                description="Certifications, courses, and projects for your top missing skills."
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
                {suggestions.map((s, i) => (
                  <div key={i} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${suggestionCategoryColors[s.category] || ''}`}>
                        {s.category}
                      </span>
                      <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">{s.title}</span>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">{s.description}</p>
                    {s.url && (
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-block mt-1.5 text-[10px] text-blue-600 dark:text-blue-400 hover:underline">
                        Learn more →
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Empty state (no analysis yet) */}
      {!analysis && !loading && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-10 text-center">
          <p className="text-4xl mb-3">🎯</p>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Find your skill gaps</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Select a resume and click Analyze to see how you stack up against the market.
          </p>
        </div>
      )}
    </div>
  );
}
