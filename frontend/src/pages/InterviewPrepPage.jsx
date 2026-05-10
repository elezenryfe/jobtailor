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

const tabBase = 'px-3 py-1.5 text-xs font-medium rounded-md transition-colors';

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

  return (
    <div className="p-5 lg:p-8 space-y-6 max-w-5xl mx-auto w-full">
      <h1 className="text-xl font-semibold text-[var(--geist-foreground)] tracking-[-0.025em]">Interview Prep</h1>

      {/* Source Card */}
      <div className="card p-5">
        <SectionHeader
          accent="neutral"
          icon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          }
          title="Generate Questions"
          description="Select a saved job or paste a new job description."
        />

        <div className="flex gap-1 mb-3">
          <button
            onClick={() => setUsePasted(false)}
            className={`${tabBase} ${!usePasted ? 'bg-[var(--geist-foreground)] text-[var(--geist-background)]' : 'btn-ghost'}`}
          >
            Saved Job
          </button>
          <button
            onClick={() => setUsePasted(true)}
            className={`${tabBase} ${usePasted ? 'bg-[var(--geist-foreground)] text-[var(--geist-background)]' : 'btn-ghost'}`}
          >
            Paste JD
          </button>
        </div>

        {!usePasted ? (
          <select
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            className="select-geist"
          >
            <option value="">Select a saved job...</option>
            {jobs.filter((j) => j.stage !== 'Offer' && j.stage !== 'Rejected').map((j) => (
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
            className="textarea-geist"
          />
        )}

        <div className="mt-3">
          <button
            onClick={prepRecord ? handleGenerateMore : handleGenerate}
            disabled={loading}
            className="btn-primary"
          >
            {loading ? 'Generating...' : prepRecord ? 'Generate More (5 each)' : 'Generate Questions'}
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
        <div className="card h-40 animate-pulse" />
      )}

      {/* Results */}
      {prepRecord && !loading && (
        <div className="card p-5">
          <SectionHeader
            accent="success"
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
                className={`${tabBase} ${activeTab === tab.key ? 'bg-[var(--geist-foreground)] text-[var(--geist-background)]' : 'btn-ghost'}`}
              >
                {tab.label} ({prepRecord.questions[tab.key]?.length || 0})
              </button>
            ))}
          </div>

          {/* Questions */}
          <div className="space-y-2">
            {questions.length === 0 ? (
              <p className="text-xs text-[var(--accents-3)] py-6 text-center">No questions in this category</p>
            ) : (
              questions.map((q) => (
                <div key={q.id} className="rounded-lg p-3" style={{ background: 'var(--geist-background)', boxShadow: '0 0 0 1px rgba(0,0,0,0.06)' }}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-[var(--geist-foreground)] font-medium flex-1">{q.question}</p>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => { setPracticeQuestion(q); setPracticeAnswer(''); setFeedback(null); }}
                        className="text-[10px] font-medium px-2 py-1 rounded-md transition-colors"
                        style={{ background: 'rgba(10,114,239,0.08)', color: '#0a72ef' }}
                      >
                        Practice
                      </button>
                      <button
                        onClick={() => toggleGuidance(q.id)}
                        className="btn-ghost text-[10px]"
                      >
                        {expanded[q.id] ? 'Hide' : 'Show'} Guidance
                      </button>
                    </div>
                  </div>
                  {expanded[q.id] && (
                    <div className="mt-2 text-xs text-[var(--accents-5)] bg-[var(--accents-1)] rounded-md p-2.5 leading-relaxed">
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
        <div className="card p-10 text-center">
          <p className="text-4xl mb-4 opacity-30">+</p>
          <h3 className="text-sm font-semibold text-[var(--geist-foreground)] tracking-[-0.015em] mb-1">Ready to practice?</h3>
          <p className="text-xs text-[var(--accents-4)]">
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
            className="relative rounded-xl bg-[var(--geist-background)] w-full max-w-lg max-h-[85vh] overflow-y-auto p-5"
            style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08), 0 16px 48px rgba(0,0,0,0.12)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => { setPracticeQuestion(null); setFeedback(null); }}
              className="absolute top-4 right-4 p-1 rounded-md text-[var(--accents-4)] hover:bg-[var(--accents-1)] hover:text-[var(--geist-foreground)] transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h3 className="text-sm font-semibold text-[var(--geist-foreground)] tracking-[-0.015em] mb-3 pr-6">{practiceQuestion.question}</h3>

            <label className="block text-xs font-medium text-[var(--accents-5)] mb-1">Your Answer</label>
            <textarea
              rows={5}
              value={practiceAnswer}
              onChange={(e) => setPracticeAnswer(e.target.value)}
              placeholder="Write your answer using the STAR method..."
              className="textarea-geist"
            />

            <div className="flex gap-2 mt-3">
              <button
                onClick={handleGetFeedback}
                disabled={feedbackLoading || !practiceAnswer.trim()}
                className="btn-primary"
              >
                {feedbackLoading ? 'Analyzing...' : 'Get Feedback'}
              </button>
              <button
                onClick={() => { setPracticeQuestion(null); setFeedback(null); setPracticeAnswer(''); }}
                className="btn-secondary"
              >
                Close
              </button>
            </div>

            {feedback && (
              <div className="mt-4 pt-4 border-t border-[var(--accents-2)]">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="font-medium text-[var(--accents-6)]">Clarity:</span>{' '}
                    <span className={`font-medium ${
                      feedback.clarity === 'strong' ? 'text-green-600' :
                      feedback.clarity === 'adequate' ? 'text-yellow-600' : 'text-red-600'
                    }`}>{feedback.clarity}</span>
                  </div>
                  <div>
                    <span className="font-medium text-[var(--accents-6)]">STAR:</span>{' '}
                    <span className={`font-medium ${
                      feedback.star_structure === 'excellent' ? 'text-green-600' :
                      feedback.star_structure === 'partial' ? 'text-yellow-600' : 'text-red-600'
                    }`}>{feedback.star_structure}</span>
                  </div>
                  <div>
                    <span className="font-medium text-[var(--accents-6)]">Relevance:</span>{' '}
                    <span className={`font-medium ${
                      feedback.relevance === 'high' ? 'text-green-600' :
                      feedback.relevance === 'medium' ? 'text-yellow-600' : 'text-red-600'
                    }`}>{feedback.relevance}</span>
                  </div>
                  <div>
                    <span className="font-medium text-[var(--accents-6)]">Score:</span>{' '}
                    <span className="font-bold text-[var(--geist-foreground)]">{feedback.overall_score}/100</span>
                  </div>
                </div>
                <p className="text-xs text-[var(--accents-5)] mt-2 p-2.5 bg-[var(--accents-1)] rounded-lg leading-relaxed">
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
