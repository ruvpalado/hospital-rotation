import React from 'react';
import { useTranslation } from 'react-i18next';
import { Doughnut } from 'react-chartjs-2';
import './ChartSetup';
import { usePhysicianKpis } from './useKpis';
import KpiCard from '../../components/KpiCard';
import { useAuth } from '../../context/AuthContext';

// Status -> colour for the Specialty Exposure donut segments.
const STATUS_COLORS = {
  completed: '#4caf50',    // green
  in_progress: '#4A90D9',  // blue
  scheduled: '#adb5bd',    // gray
  incomplete: '#D95F4A',   // red
};

// Human-friendly label for a rotation's derived status:
//   scheduled   -> planned, not started
//   in_progress -> started, ongoing
//   completed   -> finished, requirements met
//   incomplete  -> finished, requirements not met
function statusLabel(status) {
  switch (status) {
    case 'scheduled': return 'scheduled';
    case 'in_progress': return 'in progress';
    case 'completed': return 'completed';
    case 'incomplete': return 'incomplete';
    default: return status || 'unknown';
  }
}

// Physician: Individual Rotation Completion, Specialty Exposure,
// Upcoming Rotation Alerts, Notification Delivery Rate
export default function PhysicianDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const kpis = usePhysicianKpis(user?.id);

  if (!kpis) return <div className="text-center mt-5">Loading KPIs...</div>;

  const { individualRotationCompletion: irc, specialtyExposure: se } = kpis;

  return (
    <div className="container-fluid py-4">
      <h4 className="mb-3">My Rotation Progress</h4>
      <div className="row g-3 mb-4">
        <div className="col-md-4"><KpiCard label={t('individualRotationCompletion')} value={irc.pct} suffix="%" subtext={`${irc.completed}/${irc.totalRequired} blocks completed`} accent="#4A90D9" /></div>
        <div className="col-md-4"><KpiCard label={t('specialtyExposure')} value={se.pct} suffix="%" subtext={`${se.completedBlocks}/${se.totalBlocks} blocks completed across ${se.distinctDepartments} department(s)`} accent="#7FB37F" /></div>
      </div>

      <div className="row g-3">
        <div className="col-md-6">
          <div className="card shadow-sm p-3">
            <h6>{t('individualRotationCompletion')}</h6>
            <Doughnut
              data={{
                labels: ['Completed', 'Remaining'],
                datasets: [{ data: [irc.completed, Math.max(0, irc.totalRequired - irc.completed)], backgroundColor: ['#7FB37F', '#e0e0e0'] }],
              }}
              options={{
                plugins: {
                  legend: { position: 'top' },
                  tooltip: {
                    callbacks: {
                      // Slice value line, then each rotation's Block / Site / Department.
                      label: (ctx) => `${ctx.label}: ${ctx.parsed}`,
                      afterLabel: (ctx) => {
                        if (ctx.label === 'Completed') {
                          if (!irc.completedList?.length) return 'No completed rotations yet.';
                          return irc.completedList.map(
                            (r) => `Block ${r.blockNumber} — ${r.site || '—'} / ${r.department || '—'}`
                          );
                        }
                        // Remaining: each block labelled with its real status
                        // (Scheduled = not started, In progress = ongoing),
                        // plus any curriculum blocks with no assignment yet.
                        const lines = (irc.remainingList || []).map(
                          (r) => `Block ${r.blockNumber} — ${r.site || '—'} / ${r.department || '—'} (${statusLabel(r.status)})`
                        );
                        if (irc.unscheduledCount > 0) lines.push(`${irc.unscheduledCount} block(s) not scheduled yet`);
                        return lines.length ? lines : 'Nothing remaining.';
                      },
                    },
                  },
                },
              }}
            />
            <p className="text-muted small mb-0 mt-2">Hover a slice to see the site and department for each rotation.</p>
          </div>
        </div>
        <div className="col-md-6">
          <div className="card shadow-sm p-3">
            <h6>{t('specialtyExposure')} — departments by status</h6>
            {(se.rotations || []).length === 0 ? (
              <p className="text-muted small mb-0">No rotation assignments yet.</p>
            ) : (
              <>
                <Doughnut
                  data={{
                    // One equal segment per department rotation, coloured by
                    // its status so completed / in-progress / scheduled are
                    // visible at a glance.
                    labels: se.rotations.map((r) => `${r.department} (Block ${r.blockNumber})`),
                    datasets: [{
                      data: se.rotations.map(() => 1),
                      backgroundColor: se.rotations.map((r) => STATUS_COLORS[r.status] || '#adb5bd'),
                    }],
                  }}
                  options={{
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        callbacks: {
                          label: (ctx) => {
                            const r = se.rotations[ctx.dataIndex];
                            return `${r.department} — ${r.departmentName} (${statusLabel(r.status)})`;
                          },
                        },
                      },
                    },
                  }}
                />
                {/* Status colour key */}
                <div className="d-flex flex-wrap gap-3 justify-content-center mt-3 small">
                  <span><span className="badge" style={{ background: STATUS_COLORS.completed }}>&nbsp;</span> Completed</span>
                  <span><span className="badge" style={{ background: STATUS_COLORS.in_progress }}>&nbsp;</span> In Progress</span>
                  <span><span className="badge" style={{ background: STATUS_COLORS.scheduled }}>&nbsp;</span> Scheduled</span>
                  <span><span className="badge" style={{ background: STATUS_COLORS.incomplete }}>&nbsp;</span> Incomplete</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <p className="text-muted small mt-3">Go to Schedules to see your upcoming rotation blocks, dates, and weekly attendance. Go to Notifications for rotation change alerts.</p>
    </div>
  );
}
