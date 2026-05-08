import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import StatsCard from '../components/StatsCard';
import SectionHeader from '../components/SectionHeader';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';

const getErrorMessage = (err, fallback = 'Something went wrong') => {
  const detail = err?.response?.data?.detail;
  if (!detail) return fallback;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((e) => e.msg).join(', ');
  return fallback;
};

const STAGE_COLORS = {
  Saved: '#9ca3af',
  Applied: '#3b82f6',
  'Phone Screen': '#f59e0b',
  Onsite: '#8b5cf6',
  Offer: '#10b981',
  Rejected: '#ef4444',
};

const funnelSection = (data, dark) => (
  <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
    <SectionHeader
      accent="blue"
      icon={
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      }
      title="Application Funnel"
      description="Number of jobs at each stage."
    />
    {data.length === 0 ? (
      <p className="text-xs text-gray-400 dark:text-gray-600 py-8 text-center">No data yet</p>
    ) : (
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#374151' : '#e5e7eb'} />
          <XAxis type="number" tick={{ fontSize: 11, fill: dark ? '#9ca3af' : '#6b7280' }} allowDecimals={false} />
          <YAxis type="category" dataKey="stage" tick={{ fontSize: 11, fill: dark ? '#9ca3af' : '#6b7280' }} width={90} />
          <Tooltip
            contentStyle={{ fontSize: 12, backgroundColor: dark ? '#1f2937' : '#fff', border: dark ? '1px solid #374151' : '1px solid #e5e7eb', borderRadius: 8, color: dark ? '#f3f4f6' : '#111827' }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {data.map((entry, idx) => (
              <Cell key={idx} fill={STAGE_COLORS[entry.stage] || '#3b82f6'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    )}
  </div>
);

const responseRateSection = (data, dark) => {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const appliedCount = data.filter((d) => d.stage !== 'Saved').reduce((sum, d) => sum + d.count, 0);
  const savedCount = data.find((d) => d.stage === 'Saved')?.count || 0;
  const rate = total > 0 ? Math.round((appliedCount / total) * 100) : 0;

  const pieData = [
    { name: 'In Progress', value: appliedCount || 0 },
    { name: 'Saved', value: savedCount || 0 },
  ].filter((d) => d.value > 0);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
      <SectionHeader
        accent="green"
        icon={
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
          </svg>
        }
        title="Response Rate"
        description="Jobs that moved past 'Saved' stage."
      />
      {pieData.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-600 py-8 text-center">No data yet</p>
      ) : (
        <div className="flex flex-col items-center">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                <Cell fill="#10b981" />
                <Cell fill="#9ca3af" />
              </Pie>
              <Tooltip
                contentStyle={{ fontSize: 12, backgroundColor: dark ? '#1f2937' : '#fff', border: dark ? '1px solid #374151' : '1px solid #e5e7eb', borderRadius: 8, color: dark ? '#f3f4f6' : '#111827' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{rate}%</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">applications progressed</p>
        </div>
      )}
    </div>
  );
};

const timelineSection = (data, dark, groupBy, setGroupBy) => (
  <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
    <div className="flex items-center justify-between mb-2">
      <SectionHeader
        accent="indigo"
        icon={
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        }
        title="Applications Over Time"
        description="When you started applying."
      />
      <div className="flex gap-1">
        {['week', 'month'].map((g) => (
          <button
            key={g}
            onClick={() => setGroupBy(g)}
            className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
              groupBy === g
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            {g === 'week' ? 'By Week' : 'By Month'}
          </button>
        ))}
      </div>
    </div>
    {data.length === 0 ? (
      <p className="text-xs text-gray-400 dark:text-gray-600 py-8 text-center">No data yet — start applying to jobs</p>
    ) : (
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ left: 5, right: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#374151' : '#e5e7eb'} />
          <XAxis dataKey="period" tick={{ fontSize: 10, fill: dark ? '#9ca3af' : '#6b7280' }} />
          <YAxis tick={{ fontSize: 10, fill: dark ? '#9ca3af' : '#6b7280' }} allowDecimals={false} />
          <Tooltip
            contentStyle={{ fontSize: 12, backgroundColor: dark ? '#1f2937' : '#fff', border: dark ? '1px solid #374151' : '1px solid #e5e7eb', borderRadius: 8, color: dark ? '#f3f4f6' : '#111827' }}
          />
          <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6' }} />
        </LineChart>
      </ResponsiveContainer>
    )}
  </div>
);

const keywordsSection = (data, dark) => (
  <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
    <SectionHeader
      accent="purple"
      icon={
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      }
      title="Top Keywords"
      description="Most frequent terms in job descriptions."
    />
    {data.length === 0 ? (
      <p className="text-xs text-gray-400 dark:text-gray-600 py-8 text-center">Add job descriptions to see keyword trends</p>
    ) : (
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data.slice(0, 10)} layout="vertical" margin={{ left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#374151' : '#e5e7eb'} />
          <XAxis type="number" tick={{ fontSize: 10, fill: dark ? '#9ca3af' : '#6b7280' }} allowDecimals={false} />
          <YAxis type="category" dataKey="word" tick={{ fontSize: 10, fill: dark ? '#9ca3af' : '#6b7280' }} width={80} />
          <Tooltip
            contentStyle={{ fontSize: 12, backgroundColor: dark ? '#1f2937' : '#fff', border: dark ? '1px solid #374151' : '1px solid #e5e7eb', borderRadius: 8, color: dark ? '#f3f4f6' : '#111827' }}
          />
          <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    )}
  </div>
);

const timeInStageSection = (data, dark) => (
  <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
    <SectionHeader
      accent="green"
      icon={
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      }
      title="Average Time in Stage"
      description="Days since job was created, grouped by current stage."
    />
    {data.length === 0 ? (
      <p className="text-xs text-gray-400 dark:text-gray-600 py-8 text-center">No data yet</p>
    ) : (
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} layout="vertical" margin={{ left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#374151' : '#e5e7eb'} />
          <XAxis type="number" tick={{ fontSize: 10, fill: dark ? '#9ca3af' : '#6b7280' }} />
          <YAxis type="category" dataKey="stage" tick={{ fontSize: 10, fill: dark ? '#9ca3af' : '#6b7280' }} width={90} />
          <Tooltip
            contentStyle={{ fontSize: 12, backgroundColor: dark ? '#1f2937' : '#fff', border: dark ? '1px solid #374151' : '1px solid #e5e7eb', borderRadius: 8, color: dark ? '#f3f4f6' : '#111827' }}
            formatter={(val) => [`${val} days`, 'Avg Time']}
          />
          <Bar dataKey="avg_days" radius={[0, 4, 4, 0]}>
            {data.map((entry, idx) => (
              <Cell key={idx} fill={STAGE_COLORS[entry.stage] || '#10b981'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    )}
  </div>
);

const companyPipelineSection = (data, dark) => {
  // Flatten company pipeline data for stacked bar chart
  const stages = ['Saved', 'Applied', 'Phone Screen', 'Onsite', 'Offer', 'Rejected'];
  const chartData = data.map((item) => {
    const row = { company: item.company };
    stages.forEach((s) => { row[s] = item.stages[s] || 0; });
    return row;
  });

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
      <SectionHeader
        accent="blue"
        icon={
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        }
        title="Company Pipeline"
        description="Breakdown by company and stage."
      />
      {chartData.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-600 py-8 text-center">No data yet</p>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ left: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#374151' : '#e5e7eb'} />
            <XAxis dataKey="company" tick={{ fontSize: 10, fill: dark ? '#9ca3af' : '#6b7280' }} />
            <YAxis tick={{ fontSize: 10, fill: dark ? '#9ca3af' : '#6b7280' }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ fontSize: 12, backgroundColor: dark ? '#1f2937' : '#fff', border: dark ? '1px solid #374151' : '1px solid #e5e7eb', borderRadius: 8, color: dark ? '#f3f4f6' : '#111827' }}
            />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            {stages.map((s) => (
              <Bar key={s} dataKey={s} stackId="a" fill={STAGE_COLORS[s]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default function AnalyticsPage() {
  const { dark } = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timelineGroup, setTimelineGroup] = useState('week');

  useEffect(() => {
    setLoading(true);
    setError('');
    Promise.all([
      api.get('/api/analytics/funnel'),
      api.get('/api/analytics/timeline', { params: { group_by: timelineGroup } }),
      api.get('/api/analytics/keywords'),
      api.get('/api/analytics/time-in-stage'),
      api.get('/api/analytics/company-pipeline'),
    ])
      .then(([funnel, timeline, keywords, timeInStage, companyPipeline]) => {
        setData({
          funnel: funnel.data,
          timeline: timeline.data,
          keywords: keywords.data,
          timeInStage: timeInStage.data,
          companyPipeline: companyPipeline.data,
        });
      })
      .catch((err) => setError(getErrorMessage(err, 'Failed to load analytics')))
      .finally(() => setLoading(false));
  }, [timelineGroup]);

  const computedStats = data
    ? {
        total: data.funnel.reduce((s, d) => s + d.count, 0),
        active: data.funnel.filter((d) => d.stage !== 'Saved' && d.stage !== 'Rejected').reduce((s, d) => s + d.count, 0),
        offers: data.funnel.find((d) => d.stage === 'Offer')?.count || 0,
        rejected: data.funnel.find((d) => d.stage === 'Rejected')?.count || 0,
      }
    : { total: 0, active: 0, offers: 0, rejected: 0 };

  if (loading) {
    return (
      <div className="p-4 lg:p-6 space-y-6 max-w-5xl mx-auto w-full">
        <div className="h-6 w-36 bg-gray-200 dark:bg-gray-800 rounded animate-pulse mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 h-20 animate-pulse" />
          ))}
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 h-80 animate-pulse" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-4 lg:p-6 max-w-5xl mx-auto w-full">
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-xs text-red-700 dark:text-red-400">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-5xl mx-auto w-full">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Analytics</h1>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <StatsCard label="Total Jobs" value={computedStats.total} icon="💼" accent="blue" />
        <StatsCard label="Active" value={computedStats.active} icon="🔄" accent="indigo" />
        <StatsCard label="Offers" value={computedStats.offers} icon="🎉" accent="green" />
        <StatsCard label="Rejected" value={computedStats.rejected} icon="❌" accent="purple" />
      </div>

      {/* Funnel + Response Rate row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          {funnelSection(data.funnel, dark)}
        </div>
        <div>
          {responseRateSection(data.funnel, dark)}
        </div>
      </div>

      {/* Timeline */}
      {timelineSection(data.timeline, dark, timelineGroup, setTimelineGroup)}

      {/* Keywords + Time in Stage row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {keywordsSection(data.keywords, dark)}
        {timeInStageSection(data.timeInStage, dark)}
      </div>

      {/* Company Pipeline */}
      {companyPipelineSection(data.companyPipeline, dark)}
    </div>
  );
}
