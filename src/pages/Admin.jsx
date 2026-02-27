import { useEffect, useState, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

import Navbar          from '../components/Navbar'
import StatsCard       from '../components/StatsCard'
import AttendanceTable from '../components/AttendanceTable'
import MemberTable     from '../components/MemberTable'
import ServiceCard     from '../components/ServiceCard'
import QRModal         from '../components/QRModal'
import NewServiceModal from '../components/NewServiceModal'

import { subscribeToServiceAttendance, getAttendanceForService } from '../firebase/attendance'
import { getAllServices, getActiveService, setActiveService }     from '../firebase/services'
import { getAllMembers, getMemberById }                           from '../firebase/members'

const TABS = ['Live', 'Services', 'Members', 'Stats']

// ─── CSV Export ──────────────────────────────────────────────
function exportCSV(records, allMembers, serviceName) {
  const memberMap = {}
  allMembers.forEach(m => { memberMap[m.id] = m })

  const checkedInIds = new Set(records.map(r => r.memberId))
  const rows = [['Name', 'Student ID', 'Role', 'Check-In Time', 'Status']]

  // Checked-in members
  records.forEach(r => {
    const m = memberMap[r.memberId] || {}
    const time = r.checkedInAt?.toDate
      ? r.checkedInAt.toDate().toLocaleTimeString('en-GB')
      : '—'
    rows.push([
      `${m.firstName || ''} ${m.lastName || ''}`.trim(),
      m.studentId  || '—',
      m.role       || '—',
      time,
      'Present',
    ])
  })

  // Absent members (registered but not checked in)
  allMembers.forEach(m => {
    if (!checkedInIds.has(m.id)) {
      rows.push([
        `${m.firstName || ''} ${m.lastName || ''}`.trim(),
        m.studentId || '—',
        m.role      || '—',
        '—',
        'Absent',
      ])
    }
  })

  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${serviceName || 'attendance'}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Custom tooltip for recharts ─────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface-elevated border border-brand-border rounded-lg px-3 py-2 text-sm shadow-xl">
      <p className="text-brand-muted mb-1">{label}</p>
      <p className="text-gold font-semibold">{payload[0].value} attended</p>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────
export default function Admin() {
  const [tab,            setTab]            = useState('Live')
  const [services,       setServices]       = useState([])
  const [activeService,  setActiveServiceS] = useState(null)
  const [allMembers,     setAllMembers]     = useState([])
  const [liveRecords,    setLiveRecords]    = useState([])   // joined with member data
  const [rawAttendance,  setRawAttendance]  = useState([])   // raw attendance docs
  const [servicesLoading, setServicesLoading] = useState(true)
  const [membersLoading,  setMembersLoading]  = useState(true)
  const [liveLoading,     setLiveLoading]     = useState(true)

  const [qrService,   setQrService]   = useState(null)  // service to show in QR modal
  const [showNewSvc,  setShowNewSvc]  = useState(false)

  // Per-service attendance counts for ServiceCards
  const [svcCounts, setSvcCounts] = useState({}) // { serviceId: { total, newMembers } }

  // ─── Fetch core data ────────────────────────────────────────
  const loadServices = useCallback(async () => {
    setServicesLoading(true)
    try {
      const [svcs, active] = await Promise.all([getAllServices(), getActiveService()])
      setServices(svcs)
      setActiveServiceS(active)

      // Fetch attendance counts for each service
      const counts = {}
      await Promise.all(svcs.map(async s => {
        const records = await getAttendanceForService(s.id)
        counts[s.id] = {
          total:      records.length,
          newMembers: records.filter(r => r.isNew).length,
        }
      }))
      setSvcCounts(counts)
    } finally {
      setServicesLoading(false)
    }
  }, [])

  const loadMembers = useCallback(async () => {
    setMembersLoading(true)
    try {
      const members = await getAllMembers()
      setAllMembers(members)
    } finally {
      setMembersLoading(false)
    }
  }, [])

  useEffect(() => {
    loadServices()
    loadMembers()
  }, [loadServices, loadMembers])

  // ─── Real-time live attendance ───────────────────────────────
  useEffect(() => {
    if (!activeService) {
      setLiveLoading(false)
      return
    }

    setLiveLoading(true)

    const unsub = subscribeToServiceAttendance(activeService.id, async (records) => {
      setRawAttendance(records)

      // Join with member data
      const memberMap = {}
      allMembers.forEach(m => { memberMap[m.id] = m })

      // Fetch any members not yet loaded
      const missing = records.filter(r => !memberMap[r.memberId]).map(r => r.memberId)
      if (missing.length > 0) {
        const fetched = await Promise.all(missing.map(getMemberById))
        fetched.forEach(m => { if (m) memberMap[m.id] = m })
      }

      const joined = records.map(r => ({
        ...r,
        ...(memberMap[r.memberId] || {}),
        id: r.id,
        memberId: r.memberId,
      }))

      setLiveRecords(joined)
      setLiveLoading(false)
    })

    return unsub
  }, [activeService, allMembers])

  // ─── Stats chart data (last 6 services) ─────────────────────
  const chartData = services.slice(0, 6).reverse().map(s => ({
    name:    s.name.length > 14 ? s.name.slice(0, 14) + '…' : s.name,
    date:    s.date,
    count:   svcCounts[s.id]?.total ?? 0,
  }))

  const totalAttendance  = Object.values(svcCounts).reduce((a, b) => a + b.total, 0)
  const totalFirstTimers = Object.values(svcCounts).reduce((a, b) => a + b.newMembers, 0)
  const avgAttendance    = services.length > 0 ? Math.round(totalAttendance / services.length) : 0

  // ─── Live tab stats ──────────────────────────────────────────
  const liveFirstTimers  = liveRecords.filter(r => r.isNew).length
  const attendanceRate   = allMembers.length > 0
    ? `${Math.round((liveRecords.length / allMembers.length) * 100)}%`
    : '—'

  // ─── Handlers ────────────────────────────────────────────────
  const handleSetActive = async (serviceId) => {
    await setActiveService(serviceId)
    loadServices()
  }

  const handleServiceCreated = (newServiceId) => {
    setShowNewSvc(false)
    loadServices().then(() => {
      // Open QR for newly created service
      getAllServices().then(svcs => {
        const newSvc = svcs.find(s => s.id === newServiceId)
        if (newSvc) setQrService(newSvc)
      })
    })
  }

  // ─── Render ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-brand-bg">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="font-display text-4xl font-semibold text-brand-text">Dashboard</h1>
            {activeService ? (
              <p className="text-brand-muted text-sm mt-1">
                Active: <span className="text-gold">{activeService.name}</span> · {activeService.date}
              </p>
            ) : (
              <p className="text-brand-muted text-sm mt-1">No active service. Create one to start tracking attendance.</p>
            )}
          </div>
          <button
            onClick={() => setShowNewSvc(true)}
            className="btn-gold hidden sm:flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Service
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-brand-border mb-6 flex gap-0 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={tab === t ? 'tab-btn-active' : 'tab-btn'}
            >
              {t}
            </button>
          ))}
        </div>

        {/* ── Tab: Live ── */}
        {tab === 'Live' && (
          <div className="space-y-6 animate-fade-in">
            {!activeService ? (
              <div className="text-center py-20">
                <p className="text-5xl mb-4">📋</p>
                <h2 className="font-display text-2xl text-brand-text mb-2">No active service</h2>
                <p className="text-brand-muted text-sm mb-6">Create a service to start live attendance tracking.</p>
                <button onClick={() => setShowNewSvc(true)} className="btn-gold">
                  Create Service
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <StatsCard label="In Service"       value={liveRecords.length} highlight live />
                  <StatsCard label="Total Members"    value={allMembers.length}              />
                  <StatsCard label="First Timers Today" value={liveFirstTimers}  icon="🎉"  />
                  <StatsCard label="Attendance Rate"  value={attendanceRate}                 />
                </div>
                <AttendanceTable records={liveRecords} loading={liveLoading} />
              </>
            )}
          </div>
        )}

        {/* ── Tab: Services ── */}
        {tab === 'Services' && (
          <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <p className="text-brand-muted text-sm">{services.length} service{services.length !== 1 ? 's' : ''} total</p>
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
                    onViewQR={setQrService}
                    onSetActive={handleSetActive}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Members ── */}
        {tab === 'Members' && (
          <div className="animate-fade-in">
            <MemberTable members={allMembers} loading={membersLoading} />
          </div>
        )}

        {/* ── Tab: Stats ── */}
        {tab === 'Stats' && (
          <div className="space-y-6 animate-fade-in">
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatsCard label="Total Members"     value={allMembers.length}   icon="👥" />
              <StatsCard label="Total Services"    value={services.length}     icon="📋" />
              <StatsCard label="Total Attendance"  value={totalAttendance}     icon="✅" />
              <StatsCard label="Avg per Service"   value={avgAttendance}       icon="📊" />
            </div>

            {/* Bar chart */}
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-display text-xl font-semibold text-brand-text">Attendance Trend</h3>
                  <p className="text-brand-muted text-xs mt-0.5">Last {Math.min(6, services.length)} services</p>
                </div>
                <button
                  onClick={() => {
                    if (!activeService) return alert('Select an active service first.')
                    exportCSV(rawAttendance, allMembers, activeService.name)
                  }}
                  className="btn-ghost text-sm py-2 px-4 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export CSV
                </button>
              </div>

              {chartData.length === 0 ? (
                <div className="text-center py-12 text-brand-muted">No service data yet.</div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#9CA3AF', fontSize: 11, fontFamily: 'DM Sans' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#9CA3AF', fontSize: 11, fontFamily: 'DM Sans' }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(201,168,76,0.05)' }} />
                    <Bar
                      dataKey="count"
                      fill="#C9A84C"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={60}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Per-service breakdown table */}
            <div className="card">
              <h3 className="font-display text-xl font-semibold text-brand-text mb-4">Per-Service Breakdown</h3>
              {services.length === 0 ? (
                <div className="text-center py-8 text-brand-muted">No services yet.</div>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Service</th>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Attendance</th>
                        <th>First Timers</th>
                      </tr>
                    </thead>
                    <tbody>
                      {services.map(s => (
                        <tr key={s.id}>
                          <td>
                            <span className="font-medium text-brand-text">{s.name}</span>
                            {s.isActive && (
                              <span className="ml-2 badge-green text-xs">Active</span>
                            )}
                          </td>
                          <td className="text-brand-muted text-sm">{s.date}</td>
                          <td className="text-brand-muted text-sm">{s.type}</td>
                          <td>
                            <span className="font-display text-lg text-brand-text">{svcCounts[s.id]?.total ?? 0}</span>
                          </td>
                          <td>
                            <span className="font-display text-lg text-gold">{svcCounts[s.id]?.newMembers ?? 0}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* All-time totals row */}
              {services.length > 0 && (
                <div className="mt-4 pt-4 border-t border-brand-border flex items-center gap-8 text-sm">
                  <div>
                    <span className="text-brand-subtle">Total first-timers: </span>
                    <span className="text-gold font-semibold font-display text-xl">{totalFirstTimers}</span>
                  </div>
                  <div>
                    <span className="text-brand-subtle">Avg attendance: </span>
                    <span className="text-brand-text font-semibold font-display text-xl">{avgAttendance}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      {qrService  && <QRModal         service={qrService} onClose={() => setQrService(null)} />}
      {showNewSvc && <NewServiceModal  onClose={() => setShowNewSvc(false)} onCreated={handleServiceCreated} />}
    </div>
  )
}
