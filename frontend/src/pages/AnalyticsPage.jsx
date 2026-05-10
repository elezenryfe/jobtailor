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
  Applied: '#0a72ef',
  'Phone Screen': '#de1d8d',
  Onsite: '#7928ca',
  Offer: '#10b981',
  Rejected: '#ff5b4f',
};

const statsIcons = {
  total: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  active: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  offers: 'M5 13l4 4L19 7',
  rejected: 'M6 18L18 6M6 6l12 12',
};

const tooltipStyle = (dark) => ({
  fontSize: 12,
  backgroundColor: dark ? '#1a1a1a' : '#ffffff',
  border: 'none',
  borderRadius: 8,
  color: dark ? '#fafafa' : '#171717',
  boxShadow: '0 0 0 1px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.12)',
});

const Section = ({ accent, icon, title, description, children }) => (
  <div className="card p-5">
    <SectionHeader accent={accent} icon={icon} title={title} description={description} />
    {children}
  </div>
);

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
      <div className="p-5 lg:p-8 space-y-6 max-w-5xl mx-auto w-full">
        <div className="h-7 w-28 bg-[var(--accents-2)] rounded animate-pulse mb-5" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card h-20 animate-pulse" />
          ))}
        </div>
        <div className="card h-80 animate-pulse" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-5 lg:p-8 max-w-5xl mx-auto w-full">
        <div className="rounded-lg p-3 text-xs" style={{ background: 'rgba(255,91,79,0.08)', color: '#ff5b4f' }}>
          {error}
        </div>
      </div>
    );
  }

  const funnelData = data.funnel;
  const totalForRate = funnelData.reduce((sum, d) => sum + d.count, 0);
  const appliedCount = funnelData.filter((d) => d.stage !== 'Saved').reduce((sum, d) => sum + d.count, 0);
  const savedCount = funnelData.find((d) => d.stage === 'Saved')?.count || 0;
  const rate = totalForRate > 0 ? Math.round((appliedCount / totalForRate) * 100) : 0;
  const pieData = [
    { name: 'In Progress', value: appliedCount || 0 },
    { name: 'Saved', value: savedCount || 0 },
  ].filter((d) => d.value > 0);

  // Flatten company pipeline for stacked bar
  const stages = ['Saved', 'Applied', 'Phone Screen', 'Onsite', 'Offer', 'Rejected'];
  const companyChartData = (data.companyPipeline || []).map((item) => {
    const row = { company: item.company };
    stages.forEach((s) => { row[s] = item.stages[s] || 0; });
    return row;
  });

  return (
    <div className="p-5 lg:p-8 space-y-6 max-w-5xl mx-auto w-full">
      <h1 className="text-xl font-semibold text-[var(--geist-foreground)] tracking-[-0.025em]">Analytics</h1>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatsCard label="Total Jobs" value={computedStats.total} icon={statsIcons.total} accent="success" />
        <StatsCard label="Active" value={computedStats.active} icon={statsIcons.active} accent="success" />
        <StatsCard label="Offers" value={computedStats.offers} icon={statsIcons.offers} accent="success" />
        <StatsCard label="Rejected" value={computedStats.rejected} icon={statsIcons.rejected} accent="error" />
      </div>

      {/* Funnel + Response Rate row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <Section
            accent="success"
            icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
            title="Application Funnel"
            description="Number of jobs at each stage."
          >
            {funnelData.length === 0 ? (
              <p className="text-xs text-[var(--accents-3)] py-8 text-center">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={funnelData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#333' : '#eaeaea'} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: dark ? '#888' : '#666' }} allowDecimals={false} />
                  <YAxis type="category" dataKey="stage" tick={{ fontSize: 11, fill: dark ? '#888' : '#666' }} width={90} />
                  <Tooltip contentStyle={tooltipStyle(dark)} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {funnelData.map((entry, idx) => (
                      <Cell key={idx} fill={STAGE_COLORS[entry.stage] || '#0a72ef'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Section>
        </div>
        <div>
          <Section
            accent="success"
            icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" /></svg>}
            title="Response Rate"
            description="Jobs that moved past 'Saved' stage."
          >
            {pieData.length === 0 ? (
              <p className="text-xs text-[var(--accents-3)] py-8 text-center">No data yet</p>
            ) : (
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                      <Cell fill="#10b981" />
                      <Cell fill="#9ca3af" />
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle(dark)} />
                  </PieChart>
                </ResponsiveContainer>
                <p className="text-2xl font-bold text-[var(--geist-foreground)]">{rate}%</p>
                <p className="text-xs text-[var(--accents-4)]">applications progressed</p>
              </div>
            )}
          </Section>
        </div>
      </div>

      {/* Timeline */}
      <Section
        accent="neutral"
        icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
        title="Applications Over Time"
        description="When you started applying."
      >
        <div className="flex gap-1 mb-3">
          {['week', 'month'].map((g) => (
            <button
              key={g}
              onClick={() => setTimelineGroup(g)}
              className={`text-xs font-medium px-3 py-1 rounded-md transition-colors ${
                timelineGroup === g
                  ? 'bg-[var(--geist-foreground)] text-[var(--geist-background)]'
                  : 'btn-ghost'
              }`}
            >
              {g === 'week' ? 'By Week' : 'By Month'}
            </button>
          ))}
        </div>
        {(!data.timeline || data.timeline.length === 0) ? (
          <p className="text-xs text-[var(--accents-3)] py-8 text-center">No data yet — start applying to jobs</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.timeline} margin={{ left: 5, right: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#333' : '#eaeaea'} />
              <XAxis dataKey="period" tick={{ fontSize: 10, fill: dark ? '#888' : '#666' }} />
              <YAxis tick={{ fontSize: 10, fill: dark ? '#888' : '#666' }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle(dark)} />
              <Line type="monotone" dataKey="count" stroke="#0a72ef" strokeWidth={2} dot={{ r: 3, fill: '#0a72ef' }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Section>

      {/* Keywords + Time in Stage row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Section
          accent="warning"
          icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>}
          title="Top Keywords"
          description="Most frequent terms in job descriptions."
        >
          {!data.keywords || data.keywords.length === 0 ? (
            <p className="text-xs text-[var(--accents-3)] py-8 text-center">Add job descriptions to see keyword trends</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.keywords.slice(0, 10)} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#333' : '#eaeaea'} />
                <XAxis type="number" tick={{ fontSize: 10, fill: dark ? '#888' : '#666' }} allowDecimals={false} />
                <YAxis type="category" dataKey="word" tick={{ fontSize: 10, fill: dark ? '#888' : '#666' }} width={80} />
                <Tooltip contentStyle={tooltipStyle(dark)} />
                <Bar dataKey="count" fill="#de1d8d" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>

        <Section
          accent="success"
          icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          title="Average Time in Stage"
          description="Days since job was created, grouped by current stage."
        >
          {!data.timeInStage || data.timeInStage.length === 0 ? (
            <p className="text-xs text-[var(--accents-3)] py-8 text-center">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.timeInStage} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#333' : '#eaeaea'} />
                <XAxis type="number" tick={{ fontSize: 10, fill: dark ? '#888' : '#666' }} />
                <YAxis type="category" dataKey="stage" tick={{ fontSize: 10, fill: dark ? '#888' : '#666' }} width={90} />
                <Tooltip contentStyle={tooltipStyle(dark)} formatter={(val) => [`${val} days`, 'Avg Time']} />
                <Bar dataKey="avg_days" radius={[0, 4, 4, 0]}>
                  {data.timeInStage.map((entry, idx) => (
                    <Cell key={idx} fill={STAGE_COLORS[entry.stage] || '#10b981'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>
      </div>

      {/* Company Pipeline */}
      <Section
        accent="success"
        icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
        title="Company Pipeline"
        description="Breakdown by company and stage."
      >
        {companyChartData.length === 0 ? (
          <p className="text-xs text-[var(--accents-3)] py-8 text-center">No data yet</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={companyChartData} margin={{ left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#333' : '#eaeaea'} />
              <XAxis dataKey="company" tick={{ fontSize: 10, fill: dark ? '#888' : '#666' }} />
              <YAxis tick={{ fontSize: 10, fill: dark ? '#888' : '#666' }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle(dark)} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {stages.map((s) => (
                <Bar key={s} dataKey={s} stackId="a" fill={STAGE_COLORS[s]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </Section>
    </div>
  );
}
