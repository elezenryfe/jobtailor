import { useState, useEffect } from 'react';

const EMPLOYMENT_OPTIONS = [
  { value: 'FULLTIME', label: 'Full-time' },
  { value: 'PARTTIME', label: 'Part-time' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'INTERN', label: 'Internship' },
  { value: 'TEMPORARY', label: 'Temporary' },
];

export default function JobSearchFilters({ onSearch, loading, initialValues }) {
  const [keywords, setKeywords] = useState(initialValues?.keywords || '');
  const [location, setLocation] = useState(initialValues?.location || '');
  const [employmentTypes, setEmploymentTypes] = useState(initialValues?.employment_types || []);
  const [remoteOnly, setRemoteOnly] = useState(initialValues?.remote_only || false);
  const [salaryMin, setSalaryMin] = useState(initialValues?.salary_min || '');
  const [salaryMax, setSalaryMax] = useState(initialValues?.salary_max || '');
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialValues) {
      setKeywords(initialValues.keywords || '');
      setLocation(initialValues.location || '');
      setEmploymentTypes(initialValues.employment_types || []);
      setRemoteOnly(initialValues.remote_only || false);
      setSalaryMin(initialValues.salary_min || '');
      setSalaryMax(initialValues.salary_max || '');
    }
  }, [initialValues]);

  const toggleEmploymentType = (value) => {
    setEmploymentTypes((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!keywords.trim()) {
      setError('Please enter job keywords');
      return;
    }
    setError('');
    onSearch({
      keywords: keywords.trim(),
      location: location.trim(),
      employment_types: employmentTypes,
      remote_only: remoteOnly,
      salary_min: salaryMin ? parseInt(salaryMin) : undefined,
      salary_max: salaryMax ? parseInt(salaryMax) : undefined,
    });
  };

  const handleReset = () => {
    setKeywords('');
    setLocation('');
    setEmploymentTypes([]);
    setRemoteOnly(false);
    setSalaryMin('');
    setSalaryMax('');
    setError('');
  };

  return (
    <form onSubmit={handleSubmit} className="card p-4 space-y-3">
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {/* Keywords */}
        <div className="sm:col-span-2 lg:col-span-2">
          <label className="block text-xs font-medium text-[var(--accents-5)] mb-1">
            Keywords *
          </label>
          <input
            type="text"
            value={keywords}
            onChange={(e) => { setKeywords(e.target.value); setError(''); }}
            placeholder="e.g. Software Engineer, React, Python"
            className="input-geist"
          />
          {error && (
            <p className="text-[11px] text-[var(--geist-error)] mt-0.5">{error}</p>
          )}
        </div>

        {/* Location */}
        <div>
          <label className="block text-xs font-medium text-[var(--accents-5)] mb-1">
            Location
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="City, State, or country"
            className="input-geist"
          />
        </div>

        {/* Search / Reset */}
        <div className="flex items-end gap-2">
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? 'Searching...' : 'Search'}
          </button>
          <button type="button" onClick={handleReset} className="btn-ghost btn-sm">
            Reset
          </button>
        </div>
      </div>

      {/* Advanced filters row */}
      <div className="flex flex-wrap items-center gap-4 pt-1">
        {/* Employment type chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-[var(--accents-4)] mr-1">Type:</span>
          {EMPLOYMENT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleEmploymentType(opt.value)}
              className={`text-[11px] font-medium px-2.5 py-1 rounded-full transition-colors ${
                employmentTypes.includes(opt.value)
                  ? 'bg-[var(--geist-foreground)] text-[var(--geist-background)]'
                  : 'bg-[var(--accents-1)] text-[var(--accents-5)] hover:bg-[var(--accents-2)]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Remote only */}
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={remoteOnly}
            onChange={(e) => setRemoteOnly(e.target.checked)}
            className="h-3.5 w-3.5 accent-[var(--geist-foreground)]"
          />
          <span className="text-[11px] text-[var(--accents-5)]">Remote only</span>
        </label>

        {/* Salary range (client-side filter) */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-[var(--accents-4)]">Salary:</span>
          <input
            type="number"
            value={salaryMin}
            onChange={(e) => setSalaryMin(e.target.value)}
            placeholder="Min"
            className="w-20 px-2 py-1 text-[11px] rounded-md border border-[var(--accents-2)] bg-[var(--geist-background)] text-[var(--geist-foreground)]"
          />
          <span className="text-[11px] text-[var(--accents-4)]">-</span>
          <input
            type="number"
            value={salaryMax}
            onChange={(e) => setSalaryMax(e.target.value)}
            placeholder="Max"
            className="w-20 px-2 py-1 text-[11px] rounded-md border border-[var(--accents-2)] bg-[var(--geist-background)] text-[var(--geist-foreground)]"
          />
        </div>
      </div>
    </form>
  );
}
