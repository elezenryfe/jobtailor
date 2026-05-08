import { useState, useEffect } from 'react';
import api from '../services/api';
import SectionHeader from '../components/SectionHeader';

const getErrorMessage = (err, fallback = 'Something went wrong') => {
  const detail = err?.response?.data?.detail;
  if (!detail) return fallback;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((e) => e.msg).join(', ');
  return fallback;
};

const TABS = [
  { key: 'behavioral', label: 'Behavioral' },
  { key: 'technical', label: 'Technical' },
  { key: 'role_specific', label: 'Role-Specific' },
];

export default function InterviewPrepPage() {
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [pastedDesc, setPastedDesc] = useState('');
  const [usePasted, setUsePasted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [prepRecord, setPrepRecord] = useState(null);
  const [activeTab, setActiveTab] = useState('behavioral');
  const [expanded, setExpanded] = useState({});

  // Practice mode
  const [practiceQuestion, setPracticeQuestion] = useState(null);
  const [practiceAnswer, setPracticeAnswer] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  useEffect(() => { fetchJobs(); }, []);

  const fetchJobs = async () => {
    try {
      const res = await api.get('/api/jobs/');
      setJobs(res.data);
    } catch {
      // silent
    }
  };

  const doGenerate = async (count) => {
    setError('');

    const payload = usePasted
      ? { job_description: pastedDesc, count }
      : { job_id: selectedJobId ? parseInt(selectedJobId) : null, count };

    if (!usePasted && !selectedJobId) { setError('Select a job or paste a description.'); return; }
    if (usePasted && !pastedDesc.trim()) { setError('Paste a job description.'); return; }

    setLoading(true);
    try {
      const res = await api.post('/api/interview/generate', payload);
      setPrepRecord(res.data);
      setActiveTab('behavioral');
      setExpanded({});
    } catch (err) {
      if (err?.response?.status === 429) {
        setError('Too many requests — wait a moment and try again.');
      } else {
        setError(getErrorMessage(err, 'Failed to generate questions'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = () => doGenerate(3);
  const handleGenerateMore = () => doGenerate(5);

  const handleGetFeedback = async () => {
    if (!practiceAnswer.trim()) return;
    setFeedbackLoading(true);
    try {
      const context = prepRecord
        ? `${prepRecord.job_title || ''} at ${prepRecord.company || ''}\n${prepRecord.job_description || ''}`
        : '';
      const res = await api.post('/api/interview/evaluate', {
        question: practiceQuestion.question,
        answer: practiceAnswer,
        context: context.substring(0, 3000),
      });
      setFeedback(res.data);
    } catch (err) {
      setFeedback({ feedback: getErrorMessage(err, 'Evaluation failed'), overall_score: 0, clarity: '-', star_structure: '-', relevance: '-' });
    } finally {
      setFeedbackLoading(false);
    }
  };

  const toggleGuidance = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const questions = prepRecord?.questions?.[activeTab] || [];

  const inputClass =
    'w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none';

  const selectClass = inputClass;

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-5xl mx-auto w-full">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Interview Prep</h1>

      {/* Source Card */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
        <SectionHeader
          accent="indigo"
          icon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          }
          title="Generate Questions"
          description="Select a saved job or paste a new job description."
        />

        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setUsePasted(false)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              !usePasted
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            Saved Job
          </button>
          <button
            onClick={() => setUsePasted(true)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              usePasted
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            Paste JD
          </button>
        </div>

        {!usePasted ? (
          <select
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            className={selectClass}
          >
            <option value="">Select a saved job...</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.company} — {j.job_title}
              </option>
            ))}
          </select>
        ) : (
          <textarea
            rows={6}
            value={pastedDesc}
            onChange={(e) => setPastedDesc(e.target.value)}
            placeholder="Paste the job description here..."
            className={`${inputClass} resize-none`}
          />
        )}

        <div className="mt-3">
          <button
            onClick={prepRecord ? handleGenerateMore : handleGenerate}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Generating...' : prepRecord ? 'Generate More (5 each)' : 'Generate Questions'}
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
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 h-40 animate-pulse" />
      )}

      {/* Results */}
      {prepRecord && !loading && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
          <SectionHeader
            accent="green"
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            title={prepRecord.job_title ? `${prepRecord.job_title} at ${prepRecord.company}` : 'Generated Questions'}
            description="Click a question for guidance, or practice your answer."
          />

          {/* Tabs */}
          <div className="flex gap-1 mt-2 mb-4">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  activeTab === tab.key
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                {tab.label} ({prepRecord.questions[tab.key]?.length || 0})
              </button>
            ))}
          </div>

          {/* Questions */}
          <div className="space-y-2">
            {questions.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-600 py-6 text-center">No questions in this category</p>
            ) : (
              questions.map((q) => (
                <div key={q.id} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-gray-900 dark:text-gray-100 font-medium flex-1">{q.question}</p>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => { setPracticeQuestion(q); setPracticeAnswer(''); setFeedback(null); }}
                        className="px-2 py-1 text-[10px] font-medium rounded bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
                      >
                        Practice
                      </button>
                      <button
                        onClick={() => toggleGuidance(q.id)}
                        className="px-2 py-1 text-[10px] font-medium rounded text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        {expanded[q.id] ? 'Hide' : 'Show'} Guidance
                      </button>
                    </div>
                  </div>
                  {expanded[q.id] && (
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-2.5 leading-relaxed">
                      {q.guidance}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!prepRecord && !loading && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-10 text-center">
          <p className="text-4xl mb-3">🎤</p>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Ready to practice?</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Select a job or paste a description, then generate interview questions.
          </p>
        </div>
      )}

      {/* Practice Modal */}
      {practiceQuestion && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center pt-[10vh] px-4"
          onClick={() => { setPracticeQuestion(null); setFeedback(null); }}
        >
          <div
            className="relative rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 w-full max-w-lg max-h-[85vh] overflow-y-auto p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => { setPracticeQuestion(null); setFeedback(null); }}
              className="absolute top-4 right-4 p-1 rounded-md text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 pr-6">{practiceQuestion.question}</h3>

            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Your Answer</label>
            <textarea
              rows={5}
              value={practiceAnswer}
              onChange={(e) => setPracticeAnswer(e.target.value)}
              placeholder="Write your answer using the STAR method..."
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
            />

            <div className="flex gap-2 mt-3">
              <button
                onClick={handleGetFeedback}
                disabled={feedbackLoading || !practiceAnswer.trim()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {feedbackLoading ? 'Analyzing...' : 'Get Feedback'}
              </button>
              <button
                onClick={() => { setPracticeQuestion(null); setFeedback(null); setPracticeAnswer(''); }}
                className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>

            {feedback && (
              <div className="mt-3 border-t border-gray-200 dark:border-gray-700 pt-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Clarity:</span>{' '}
                    <span className={`font-medium ${
                      feedback.clarity === 'strong' ? 'text-green-600' :
                      feedback.clarity === 'adequate' ? 'text-yellow-600' : 'text-red-600'
                    }`}>{feedback.clarity}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">STAR:</span>{' '}
                    <span className={`font-medium ${
                      feedback.star_structure === 'excellent' ? 'text-green-600' :
                      feedback.star_structure === 'partial' ? 'text-yellow-600' : 'text-red-600'
                    }`}>{feedback.star_structure}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Relevance:</span>{' '}
                    <span className={`font-medium ${
                      feedback.relevance === 'high' ? 'text-green-600' :
                      feedback.relevance === 'medium' ? 'text-yellow-600' : 'text-red-600'
                    }`}>{feedback.relevance}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Score:</span>{' '}
                    <span className="font-bold text-gray-900 dark:text-gray-100">{feedback.overall_score}/100</span>
                  </div>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 p-2.5 bg-gray-50 dark:bg-gray-800 rounded-lg leading-relaxed">
                  {feedback.feedback}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
