import { useEffect, useState, useCallback, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

import Navbar          from '../components/Navbar'
import StatsCard       from '../components/StatsCard'
import AttendanceTable from '../components/AttendanceTable'
import MemberTable     from '../components/MemberTable'
import ServiceCard     from '../components/ServiceCard'
import QRModal         from '../components/QRModal'
import NewServiceModal from '../components/NewServiceModal'
import AttendanceAnalysis from '../components/AttendanceAnalysis'
import FlierModal        from '../components/FlierModal'
import AppSettings       from '../components/AppSettings'

import { useAuth, useTheme } from '../App'
import { subscribeToServiceAttendance, getAttendanceForService } from '../firebase/attendance'
import { getAllServices, getActiveService, setActiveService, completeService, deleteService } from '../firebase/services'
import { getAllMembers, getMemberById }                           from '../firebase/members'
import { getAllAttendance, buildAnalytics }                        from '../firebase/analytics'
import { getAppConfig }                                           from '../firebase/settings'

const TABS = ['Live', 'Services', 'Members', 'Stats', 'Settings']

// ─── Theme-aware chart colors ─────────────────────────────────
function useChartColors() {
  const { theme } = useTheme()
  // Recharts can't read CSS variables, so these mirror src/styles/index.css.
  // Keep them in sync when the palette changes.
  return {
    bar:           theme === 'light' ? '#0E4D3C' : '#C9A84C',
    grid:          theme === 'light' ? '#D1D9CA' : '#303629',
    axis:          theme === 'light' ? '#5C6352' : '#9CA08F',
    tooltipBg:     theme === 'light' ? '#F6F8F3' : '#212520',
    tooltipBorder: theme === 'light' ? '#D1D9CA' : '#303629',
    accent:        theme === 'light' ? '#8A6A1F' : '#4E9E7E',
  }
}

// ─── CSV Export ──────────────────────────────────────────────
function exportCSV(records, allMembers, serviceName) {
  const memberMap = {}
  allMembers.forEach(m => { memberMap[m.id] = m })

  const checkedInIds = new Set(records.map(r => r.memberId))
  const rows = [['Name', 'Phone', 'Cohort', 'Role', 'Check-In Time', 'Status']]

  records.forEach(r => {
    const m    = memberMap[r.memberId] || {}
    const time = r.checkedInAt?.toDate
      ? r.checkedInAt.toDate().toLocaleTimeString('en-GB') : '—'
    rows.push([
      `${m.firstName || ''} ${m.lastName || ''}`.trim(),
      m.studentId || '—', m.cohort || '—', m.role || '—', time, 'Present',
    ])
  })

  allMembers.forEach(m => {
    if (!checkedInIds.has(m.id)) {
      rows.push([
        `${m.firstName || ''} ${m.lastName || ''}`.trim(),
        m.studentId || '—', m.cohort || '—', m.role || '—', '—', 'Absent',
      ])
    }
  })

  const csv  = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = `${serviceName || 'attendance'}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Recharts custom tooltip ──────────────────────────────────
function CustomTooltip({ active, payload, label, colors }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: colors.tooltipBg, border: `1px solid ${colors.tooltipBorder}`,
      borderRadius: '0.5rem', padding: '0.5rem 0.75rem', boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
    }}>
      <p style={{ color: colors.axis, fontSize: '0.75rem', marginBottom: '0.25rem' }}>{label}</p>
      <p style={{ color: colors.accent, fontWeight: 600, fontSize: '0.875rem' }}>
        {payload[0].value} attended
      </p>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────
export default function Admin() {
  const { memberRole, user } = useAuth()
  const isSuperAdmin    = memberRole === 'superadmin'
  const chartColors     = useChartColors()

  const [tab,             setTab]             = useState('Live')
  const [services,        setServices]        = useState([])
  const [activeService,   setActiveServiceS]  = useState(null)
  const [allMembers,      setAllMembers]       = useState([])
  const [liveRecords,     setLiveRecords]      = useState([])
  const [rawAttendance,   setRawAttendance]    = useState([])
  const [servicesLoading, setServicesLoading]  = useState(true)
  const [membersLoading,  setMembersLoading]   = useState(true)
  const [liveLoading,     setLiveLoading]      = useState(true)
  const [svcCounts,       setSvcCounts]        = useState({})
  const [qrService,       setQrService]        = useState(null)
  const [flierService,    setFlierService]     = useState(null)
  const [appConfig,       setAppConfig]        = useState(null)
  const [showNewSvc,      setShowNewSvc]       = useState(false)
  const [allAttendance,   setAllAttendance]    = useState([])
  const [analyticsLoading, setAnalyticsLoading] = useState(true)

  // ─── Data loading ───────────────────────────────────────────
  const loadServices = useCallback(async () => {
    setServicesLoading(true)
    try {
      const [svcs, active] = await Promise.all([getAllServices(), getActiveService()])
      setServices(svcs)
      setActiveServiceS(active)
      const counts = {}
      await Promise.all(svcs.map(async s => {
        const recs = await getAttendanceForService(s.id)
        counts[s.id] = { total: recs.length, newMembers: recs.filter(r => r.isNew).length }
      }))
      setSvcCounts(counts)
    } finally {
      setServicesLoading(false)
    }
  }, [])

  const loadMembers = useCallback(async () => {
    setMembersLoading(true)
    try { setAllMembers(await getAllMembers()) }
    finally { setMembersLoading(false) }
  }, [])

  const loadAttendance = useCallback(async () => {
    setAnalyticsLoading(true)
    try { setAllAttendance(await getAllAttendance()) }
    finally { setAnalyticsLoading(false) }
  }, [])

  useEffect(() => { getAppConfig().then(setAppConfig) }, [])

  useEffect(() => { loadServices(); loadMembers(); loadAttendance() },
    [loadServices, loadMembers, loadAttendance])

  // Recomputed in JS rather than queried — see src/firebase/analytics.js.
  const analytics = useMemo(
    () => buildAnalytics({
      members: allMembers, services, attendance: allAttendance,
      inactiveAfterMissedServices: appConfig?.inactiveAfterMissedServices,
    }),
    [allMembers, services, allAttendance, appConfig],
  )

  // ─── Real-time attendance ───────────────────────────────────
  useEffect(() => {
    if (!activeService) { setLiveLoading(false); return }
    setLiveLoading(true)

    const unsub = subscribeToServiceAttendance(activeService.id, async (records) => {
      setRawAttendance(records)
      const memberMap = {}
      allMembers.forEach(m => { memberMap[m.id] = m })

      const missingIds = [...new Set(records.filter(r => !memberMap[r.memberId]).map(r => r.memberId))]
      if (missingIds.length > 0) {
        const fetched = await Promise.all(missingIds.map(getMemberById))
        fetched.forEach(m => { if (m) memberMap[m.id] = m })
      }

      setLiveRecords(records.map(r => ({
        ...r, ...(memberMap[r.memberId] || {}),
        id: r.id, memberId: r.memberId, checkedInAt: r.checkedInAt, isNew: r.isNew,
      })))
      setLiveLoading(false)
    })

    return unsub
  }, [activeService?.id])

  // ─── Derived stats ──────────────────────────────────────────
  const chartData        = services.slice(0, 6).reverse().map(s => ({
    name: s.name.length > 14 ? s.name.slice(0, 14) + '…' : s.name,
    count: svcCounts[s.id]?.total ?? 0,
  }))
  const totalAttendance  = Object.values(svcCounts).reduce((a, b) => a + b.total, 0)
  const totalFirstTimers = Object.values(svcCounts).reduce((a, b) => a + b.newMembers, 0)
  const avgAttendance    = services.length > 0 ? Math.round(totalAttendance / services.length) : 0
  const liveFirstTimers  = liveRecords.filter(r => r.isNew).length
  const attendanceRate   = allMembers.length > 0
    ? `${Math.round((liveRecords.length / allMembers.length) * 100)}%` : '—'

  // ─── Handlers ──────────────────────────────────────────────
  const handleSetActive = async (serviceId) => {
    await setActiveService(serviceId)
    loadServices()
  }

  const handleComplete = async (serviceId) => {
    await completeService(serviceId)
    loadServices()
  }

  const handleDelete = async (serviceId) => {
    await deleteService(serviceId)
    loadServices()
  }

  const handleServiceCreated = (newServiceId) => {
    setShowNewSvc(false)
    loadServices().then(() => {
      getAllServices().then(svcs => {
        const s = svcs.find(s => s.id === newServiceId)
        if (s) setQrService(s)
      })
    })
  }

  // ─── Render ────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'rgb(var(--bg))' }}>
      <Navbar />

      <main className="shell py-9">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="font-display text-4xl font-semibold text-brand-text">Dashboard</h1>
            {activeService ? (
              <p className="text-brand-muted text-sm mt-1">
                Active: <span className="text-gold font-medium">{activeService.name}</span> · {activeService.date}
              </p>
            ) : (
              <p className="text-brand-muted text-sm mt-1">No active service. Create one to start tracking.</p>
            )}
          </div>
          <button onClick={() => setShowNewSvc(true)} className="btn-gold hidden sm:flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Service
          </button>
        </div>

        {/* Tabs */}
        <div className="tab-row mb-8">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} className={tab === t ? 'tab-btn-active' : 'tab-btn'}>
              {t}
            </button>
          ))}
        </div>

        {/* ── Live ── */}
        {tab === 'Live' && (
          <div className="space-y-6 animate-fade-in">
            {!activeService ? (
              <div className="text-center py-20">
                <p className="text-5xl mb-4">📭</p>
                <h2 className="font-display text-2xl text-brand-text mb-2">No active service</h2>
                <p className="text-brand-muted text-sm mb-6">Create a service to start live tracking.</p>
                <button onClick={() => setShowNewSvc(true)} className="btn-gold">Create Service</button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <StatsCard label="In Service"         value={liveRecords.length} highlight live />
                  <StatsCard label="Total Members"      value={allMembers.length} />
                  <StatsCard label="First Timers Today" value={liveFirstTimers} icon="" />
                  <StatsCard label="Attendance Rate"    value={attendanceRate} />
                </div>
                <AttendanceTable records={liveRecords} loading={liveLoading} />
              </>
            )}
          </div>
        )}

        {/* ── Services ── */}
        {tab === 'Services' && (
          <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-brand-muted text-sm">{services.length} service{services.length !== 1 ? 's' : ''}</p>
                {isSuperAdmin && (
                  <p className="text-brand-subtle text-xs mt-0.5">Superadmin — delete is enabled</p>
                )}
              </div>
              <button onClick={() => setShowNewSvc(true)} className="btn-gold flex items-center gap-2 text-sm py-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Service
              </button>
            </div>

            {servicesLoading ? (
              <div className="flex justify-center py-20">
                <div className="w-7 h-7 border-2 border-gold border-t-transparent rounded-full animate-spin" />
              </div>
            ) : services.length === 0 ? (
              <div className="text-center py-20 text-brand-muted">No services yet.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {services.map(s => (
                  <ServiceCard
                    key={s.id}
                    service={s}
                    attendanceCount={svcCounts[s.id]?.total ?? 0}
                    newMembersCount={svcCounts[s.id]?.newMembers ?? 0}
                    isSuperAdmin={isSuperAdmin}
                    onViewQR={setQrService}
                    onEditFlier={setFlierService}
                    config={appConfig}
                    onSetActive={handleSetActive}
                    onComplete={handleComplete}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Members ── */}
        {tab === 'Members' && (
          <div className="animate-fade-in">
            <MemberTable
              members={analytics.memberRows}
              loading={membersLoading}
              classOptions={appConfig?.classOptions || []}
            />
          </div>
        )}

        {/* ── Stats ── */}
        {tab === 'Stats' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex justify-end">
              <button
                onClick={() => {
                  if (!activeService) { alert('Select an active service first.'); return }
                  exportCSV(rawAttendance, allMembers, activeService.name)
                }}
                className="btn-ghost text-sm py-2 px-4 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export active service CSV
              </button>
            </div>

            {analyticsLoading
              ? <div className="card text-center py-16 text-brand-muted text-sm">Crunching attendance…</div>
              : <AttendanceAnalysis analytics={analytics} chartColors={chartColors} />}
          </div>
        )}

        {/* ── Settings ── */}
        {tab === 'Settings' && (
          <div className="animate-fade-in">
            <AppSettings canEdit={memberRole === 'admin' || memberRole === 'superadmin'} />
          </div>
        )}
      </main>

      {qrService    && <QRModal   service={qrService}    onClose={() => setQrService(null)} />}
      {flierService && <FlierModal service={flierService} uid={user?.uid} onClose={() => setFlierService(null)} />}
      {showNewSvc && <NewServiceModal onClose={() => setShowNewSvc(false)} onCreated={handleServiceCreated} />}
    </div>
  )
}
