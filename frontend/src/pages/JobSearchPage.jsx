import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import JobSearchFilters from '../components/JobSearchFilters';
import JobSearchCard from '../components/JobSearchCard';

const MAX_HISTORY = 5;

function makeKey(base, userId) {
  return userId ? `${base}_${userId}` : base;
}

function loadHistory(userId) {
  try {
    const raw = localStorage.getItem(makeKey('jobtailor_search_history', userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function loadSearchState(userId) {
  try {
    const raw = localStorage.getItem(makeKey('jobtailor_search_state', userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSearchState(state, userId) {
  try {
    localStorage.setItem(makeKey('jobtailor_search_state', userId), JSON.stringify(state));
  } catch { /* ignore quota errors */ }
}

function saveHistoryEntry(filters, userId) {
  const history = loadHistory(userId).filter(
    (h) => h.keywords !== filters.keywords
  );
  history.unshift({
    keywords: filters.keywords,
    location: filters.location || '',
    employment_types: filters.employment_types || [],
    remote_only: filters.remote_only || false,
  });
  if (history.length > MAX_HISTORY) history.pop();
  localStorage.setItem(makeKey('jobtailor_search_history', userId), JSON.stringify(history));
}

function getErrorMessage(err, fallback) {
  const detail = err?.response?.data?.detail;
  if (!detail) return fallback;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((e) => e.msg).join(', ');
  return fallback;
}

// Client-side salary filtering
function filterBySalary(results, min, max) {
  if (!min && !max) return results;
  return results.filter((job) => {
    const jobMin = job.min_salary;
    const jobMax = job.max_salary;
    if (jobMin == null && jobMax == null) return false;
    if (min && (jobMax == null || jobMax < min)) return false;
    if (max && (jobMin == null || jobMin > max)) return false;
    return true;
  });
}

export default function JobSearchPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id;

  const persisted = loadSearchState(userId);

  const [filters, setFilters] = useState(persisted?.filters || {
    keywords: '',
    location: '',
    employment_types: [],
    remote_only: false,
    salary_min: undefined,
    salary_max: undefined,
  });
  const [allResults, setAllResults] = useState(persisted?.allResults || []);
  const [displayedResults, setDisplayedResults] = useState(persisted?.displayedResults || []);
  const [total, setTotal] = useState(persisted?.total || 0);
  const [page, setPage] = useState(persisted?.page || 1);
  const [numPages, setNumPages] = useState(persisted?.numPages || 1);
  const [searching, setSearching] = useState(!!persisted);
  const [history, setHistory] = useState(() => loadHistory(userId));

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  // Map: source_job_id → { dbId, stage } so we can PATCH instead of re-POSTing
  const [savingJobs, setSavingJobs] = useState(new Set());
  const [savedJobs, setSavedJobs] = useState(new Map());

  // Persist search state so results survive navigation
  useEffect(() => {
    if (allResults.length > 0) {
      saveSearchState({ filters, allResults, displayedResults, total, page, numPages }, userId);
    }
  }, [filters, allResults, displayedResults, total, page, numPages, userId]);

  // Apply client-side salary filter whenever allResults or filters.salary change
  useEffect(() => {
    setDisplayedResults(
      filterBySalary(allResults, filters.salary_min, filters.salary_max)
    );
  }, [allResults, filters.salary_min, filters.salary_max]);

  const performSearch = useCallback(async (searchFilters, pageNum = 1) => {
    if (!searchFilters.keywords.trim()) {
      setError('Please enter keywords to search for jobs.');
      return;
    }

    setLoading(true);
    setSearching(true);
    setError('');
    setSuccessMsg('');

    try {
      const payload = {
        keywords: searchFilters.keywords.trim(),
        page: pageNum,
        num_pages: 2, // Fetch 2 pages at once for better results
      };
      if (searchFilters.location?.trim()) {
        payload.location = searchFilters.location.trim();
      }
      if (searchFilters.employment_types?.length > 0) {
        payload.employment_types = searchFilters.employment_types;
      }
      if (searchFilters.remote_only) {
        payload.remote_only = true;
      }

      const res = await api.post('/api/job-search/search', payload);
      const results = res.data.results || [];
      setAllResults(results);
      setTotal(res.data.total || 0);
      setPage(pageNum);
      setNumPages(res.data.num_pages || 1);

      saveHistoryEntry(searchFilters, userId);
      setHistory(loadHistory(userId));
    } catch (err) {
      setError(getErrorMessage(err, 'Search failed. Please try again.'));
      setAllResults([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = (searchFilters) => {
    setFilters(searchFilters);
    performSearch(searchFilters, 1);
  };

  const handleHistoryClick = (historyEntry) => {
    setFilters((prev) => ({ ...prev, ...historyEntry }));
    performSearch(historyEntry, 1);
  };

  const handleNextPage = () => {
    if (page < numPages) {
      const nextPage = page + 1;
      setPage(nextPage);
      performSearch(filters, nextPage);
    }
  };

  const handlePrevPage = () => {
    if (page > 1) {
      const prevPage = page - 1;
      setPage(prevPage);
      performSearch(filters, prevPage);
    }
  };

  const handleSave = async (job, stage) => {
    setSavingJobs((prev) => new Set(prev).add(job.source_job_id));
    setError('');

    try {
      const existing = savedJobs.get(job.source_job_id);
      if (existing) {
        // Already on the board — PATCH to move it to the new stage
        await api.patch(`/api/jobs/${existing.dbId}`, { stage });
        setSavedJobs((prev) => {
          const next = new Map(prev);
          next.set(job.source_job_id, { dbId: existing.dbId, stage });
          return next;
        });
      } else {
        // New job — POST to create it
        const res = await api.post('/api/jobs/', {
          job_title: job.job_title,
          company: job.company,
          job_description: job.job_description,
          job_url: job.job_url,
          stage: stage,
        });
        setSavedJobs((prev) => {
          const next = new Map(prev);
          next.set(job.source_job_id, { dbId: res.data.id, stage });
          return next;
        });
      }
      const stageLabel = stage === 'Applied' ? 'Applied' : 'Saved';
      setSuccessMsg(`${job.job_title} at ${job.company} moved to ${stageLabel}`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      if (err?.response?.status === 409) {
        setError('This job is already on your board.');
      } else if (err?.response?.status === 404) {
        setSavedJobs((prev) => {
          const next = new Map(prev);
          next.delete(job.source_job_id);
          return next;
        });
        setError('Job was removed from your board. Try saving again.');
      } else {
        setError(getErrorMessage(err, 'Failed to save job to your board.'));
      }
    } finally {
      setSavingJobs((prev) => {
        const next = new Set(prev);
        next.delete(job.source_job_id);
        return next;
      });
    }
  };

  const handleAutoApply = (job) => handleSave(job, 'Applied');
  const handleSaveJob = (job) => handleSave(job, 'Saved');

  return (
    <div className="p-5 lg:p-8 max-w-full mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold text-[var(--geist-foreground)] tracking-[-0.025em]">
          Job Search
        </h1>
        <button
          onClick={() => navigate('/board')}
          className="btn-ghost btn-sm"
        >
          Go to Board →
        </button>
      </div>

      {/* Search Filters */}
      <JobSearchFilters
        onSearch={handleSearch}
        loading={loading}
        initialValues={filters}
      />

      {/* Search history chips */}
      {history.length > 0 && !searching && (
        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          <span className="text-[10px] text-[var(--accents-4)]">Recent:</span>
          {history.map((h, i) => (
            <button
              key={i}
              onClick={() => handleHistoryClick(h)}
              className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--accents-1)] text-[var(--accents-5)] hover:bg-[var(--accents-2)] transition-colors"
            >
              {h.keywords}{h.location ? ` · ${h.location}` : ''}
            </button>
          ))}
        </div>
      )}

      {/* Success banner */}
      {successMsg && (
        <div className="rounded-lg p-3 text-xs mb-4 mt-3" style={{ background: 'rgba(16,185,129,0.08)', color: '#10b981' }}>
          {successMsg} —{' '}
          <button onClick={() => navigate('/board')} className="underline font-medium">
            View Board
          </button>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="rounded-lg p-3 text-xs mb-4 mt-3" style={{ background: 'rgba(255,91,79,0.08)', color: '#ff5b4f' }}>
          {error}
        </div>
      )}

      {/* First-visit empty state */}
      {!searching && !loading && (
        <div className="card p-12 text-center mt-4">
          <div className="text-5xl mb-4 opacity-30">&#x1F50D;</div>
          <h3 className="text-sm font-semibold text-[var(--geist-foreground)] tracking-[-0.015em] mb-1">
            Search for Jobs
          </h3>
          <p className="text-xs text-[var(--accents-4)] max-w-sm mx-auto">
            Enter keywords above to search millions of job listings. Save interesting
            roles to your board with one click.
          </p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid gap-3 mt-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="rounded-lg bg-[var(--accents-1)] h-44 animate-pulse"
              style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.06)' }}
            />
          ))}
        </div>
      )}

      {/* Empty results */}
      {searching && !loading && displayedResults.length === 0 && !error && (
        <div className="card p-10 text-center mt-4">
          <h3 className="text-sm font-semibold text-[var(--geist-foreground)] tracking-[-0.015em] mb-1">
            No jobs found
          </h3>
          <p className="text-xs text-[var(--accents-4)]">
            Try different keywords or adjust your filters.
          </p>
        </div>
      )}

      {/* Results */}
      {displayedResults.length > 0 && (
        <>
          <div className="flex items-center justify-between mt-4 mb-3">
            <p className="text-xs text-[var(--accents-4)]">
              {displayedResults.length} result{displayedResults.length !== 1 ? 's' : ''} shown
              {displayedResults.length !== allResults.length ? ` (filtered from ${allResults.length})` : ''}
              {total > 0 ? ` — Page ${page}` : ''}
            </p>
          </div>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {displayedResults.map((job) => {
              const entry = savedJobs.get(job.source_job_id);
              return (
                <JobSearchCard
                  key={job.source_job_id}
                  job={job}
                  onAutoApply={() => handleAutoApply(job)}
                  onSaveJob={() => handleSaveJob(job)}
                  saving={savingJobs.has(job.source_job_id)}
                  saved={!!entry}
                  savedStage={entry?.stage}
                />
              );
            })}
          </div>

          {/* Pagination */}
          {total > 0 && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                onClick={handlePrevPage}
                disabled={page <= 1}
                className="btn-secondary btn-sm"
              >
                Previous
              </button>
              <span className="text-xs text-[var(--accents-4)]">
                Page {page} of {numPages}
              </span>
              <button
                onClick={handleNextPage}
                disabled={page >= numPages}
                className="btn-secondary btn-sm"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
