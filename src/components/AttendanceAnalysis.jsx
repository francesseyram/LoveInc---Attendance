import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import StatsCard from './StatsCard'
import { formatLastSeen } from '../firebase/analytics'

/**
 * The attendance picture for fellowship leads: how the trend is moving, who has
 * stopped coming, and whether new people stay. Pure presentation — every number
 * arrives already computed from buildAnalytics().
 */

const LIST_TABS = [
  ['inactive',      'Not seen recently'],
  ['drops',         'Dropped off'],
  ['regulars',      'Regulars'],
  ['neverAttended', 'Never attended'],
]

const EMPTY_COPY = {
  inactive:      'Everyone has checked in recently. ',
  drops:         'Nobody who used to come has stopped. ',
  regulars:      'No one has made every recent service yet.',
  neverAttended: 'Every member has checked in at least once.',
}

function MemberList({ rows, emptyText }) {
  if (!rows.length) {
    return <div className="text-center py-10 text-brand-muted text-sm">{emptyText}</div>
  }
  return (
    <div className="table-container">
      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Class</th>
            <th>Last seen</th>
            <th>Times</th>
            <th>Rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 100).map(m => (
            <tr key={m.id}>
              <td>
                <p className="font-medium text-brand-text text-sm">{m.firstName} {m.lastName}</p>
                {m.hostel && <p className="text-brand-subtle text-xs">{m.hostel}</p>}
              </td>
              <td className="text-brand-muted text-sm">{m.cohort || '—'}</td>
              <td className="text-brand-muted text-sm">
                {formatLastSeen(m)}
                {m.lastSeenService && <span className="block text-brand-subtle text-xs">{m.lastSeenService}</span>}
              </td>
              <td className="text-brand-muted text-sm">{m.timesAttended}</td>
              <td>
                <span className={m.rate >= 60 ? 'badge badge-green' : m.rate >= 25 ? 'badge badge-gold' : 'badge badge-red'}>
                  {m.rate}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 100 && (
        <p className="text-brand-subtle text-xs text-center py-3">
          Showing the first 100 of {rows.length}.
        </p>
      )}
    </div>
  )
}

export default function AttendanceAnalysis({ analytics, chartColors }) {
  const [listTab, setListTab] = useState('inactive')
  const { trend, totals, lists, recentWindow, activityRule } = analytics

  if (!totals.servicesHeld) {
    return (
      <div className="card text-center py-16">
        <p className="text-4xl mb-3">📊</p>
        <h3 className="font-display text-xl text-brand-text mb-2">No services held yet</h3>
        <p className="text-brand-muted text-sm">
          Create a service and take a check-in — trends, activity and retention appear here.
        </p>
      </div>
    )
  }

  // Recharts needs a shortened label; the full name lives in the tooltip.
  const chartData = trend.map(t => ({
    ...t,
    label: (t.name || '').length > 12 ? `${t.name.slice(0, 12)}…` : t.name,
  }))

  return (
    <div className="space-y-6">
      {/* ── Health at a glance ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatsCard label="Active Members"  value={`${totals.active}`} highlight />
        <StatsCard label="Inactive"        value={`${totals.inactive}`} />
        <StatsCard label="Active Rate"     value={`${totals.activeRate}%`} />
        <StatsCard label="Avg per Service" value={`${totals.avgPerService}`} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatsCard label="Services Held"   value={`${totals.servicesHeld}`} />
        <StatsCard label="Total Check-Ins" value={`${totals.totalCheckIns}`} />
        <StatsCard label="Regulars"        value={`${totals.regulars}`} />
        <StatsCard label="New Retained"    value={`${totals.retentionRate}%`} />
      </div>

      {/* ── Trend across every service, not just a recent slice ── */}
      <div className="card">
        <div className="mb-5">
          <h3 className="font-display text-xl font-semibold text-brand-text">Attendance Over Time</h3>
          <p className="text-brand-muted text-xs mt-0.5">
            All {trend.length} services held · first-timers shown separately
          </p>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: chartColors.axis, fontSize: 11, fontFamily: 'DM Sans' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fill: chartColors.axis, fontSize: 11, fontFamily: 'DM Sans' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: `${chartColors.bar}18` }}
              contentStyle={{
                background: chartColors.tooltipBg,
                border: `1px solid ${chartColors.tooltipBorder}`,
                borderRadius: '0.5rem', fontSize: '0.8rem',
              }}
              labelFormatter={(_, p) => p?.[0]?.payload?.name || ''}
            />
            <Legend wrapperStyle={{ fontSize: '0.75rem', color: chartColors.axis }} />
            <Bar dataKey="returning" name="Returning" stackId="a" fill={chartColors.bar} radius={[0, 0, 0, 0]} maxBarSize={54} />
            <Bar dataKey="newcomers" name="First-timers" stackId="a" fill={chartColors.accent} fillOpacity={0.45} radius={[6, 6, 0, 0]} maxBarSize={54} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Who is actually showing up ── */}
      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="font-display text-xl font-semibold text-brand-text">Member Activity</h3>
            <p className="text-brand-muted text-xs mt-0.5">
              {activityRule}
              {recentWindow.length > 0 && (
                <span className="text-brand-subtle">
                  {' '}({recentWindow.map(s => s.name).join(', ')})
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {LIST_TABS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setListTab(key)}
              className={listTab === key ? 'tab-btn tab-btn-active' : 'tab-btn'}
            >
              {label} <span className="opacity-60">({lists[key].length})</span>
            </button>
          ))}
        </div>

        <MemberList rows={lists[listTab]} emptyText={EMPTY_COPY[listTab]} />
      </div>

      {/* ── Per-service breakdown ── */}
      <div className="card">
        <h3 className="font-display text-xl font-semibold text-brand-text mb-4">Per-Service Breakdown</h3>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Date</th>
                <th>Total</th>
                <th>First-timers</th>
                <th>Turnout</th>
              </tr>
            </thead>
            <tbody>
              {[...trend].reverse().map(t => (
                <tr key={t.id}>
                  <td>
                    <p className="font-medium text-brand-text text-sm">{t.name}</p>
                    {t.type && <p className="text-brand-subtle text-xs">{t.type}</p>}
                  </td>
                  <td className="text-brand-muted text-sm">{t.date || '—'}</td>
                  <td className="text-brand-text text-sm font-medium">{t.total}</td>
                  <td className="text-brand-muted text-sm">{t.newcomers}</td>
                  <td>
                    <span className={t.rate >= 50 ? 'badge badge-green' : t.rate >= 20 ? 'badge badge-gold' : 'badge badge-red'}>
                      {t.rate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
