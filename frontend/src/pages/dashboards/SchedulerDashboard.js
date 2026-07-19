import React from 'react';
import { useTranslation } from 'react-i18next';
import { Bar } from 'react-chartjs-2';
import './ChartSetup';
import { useKpiOverview } from './useKpis';
import KpiCard from '../../components/KpiCard';

// Master Scheduler: Schedule Creation Time (proxied via publication timeliness),
// Conflict-Free Scheduling, Rotation Block Completion, Change Request Rate, Approval Turnaround Time
export default function SchedulerDashboard() {
  const { t } = useTranslation();
  const { data, loading } = useKpiOverview();

  if (loading || !data) return <div className="text-center mt-5">Loading KPIs...</div>;

  // Link the conflict count straight to the schedules involved so the
  // scheduler can jump from "1 conflict" to the actual overlapping records.
  const conflictIds = [...new Set((data.conflictFreeScheduling.conflictDetails || []).flatMap((c) => [c.a, c.b]))];
  const conflictLink = conflictIds.length ? `/schedules?conflictIds=${conflictIds.join(',')}` : undefined;

  return (
    <div className="container-fluid py-4">
      <h4 className="mb-3">Master Scheduler Dashboard</h4>
      <div className="row g-3 mb-4">
        <div className="col-md-3"><KpiCard label={t('schedulePublicationTimeliness')} value={data.schedulePublicationTimeliness.avgDaysAhead} suffix=" days ahead" accent="#4A90D9" /></div>
        <div className="col-md-3"><KpiCard label={t('conflictFreeScheduling')} value={data.conflictFreeScheduling.conflicts} subtext="conflicts to resolve" accent="#D95F4A" to={conflictLink} /></div>
        <div className="col-md-3"><KpiCard label={t('rotationBlockCompletion')} value={data.rotationBlockCompletion.pct} suffix="%" subtext={`${data.rotationBlockCompletion.completed}/${data.rotationBlockCompletion.total}`} accent="#7FB37F" /></div>
        <div className="col-md-3"><KpiCard label={t('changeRequestRate')} value={data.changeRequestRate.pct} suffix="%" subtext={`${data.changeRequestRate.changeRequests} requests`} accent="#D9A84A" /></div>
      </div>

      <div className="row g-3">
        <div className="col-md-6">
          <div className="card shadow-sm p-3">
            <h6>{t('approvalTurnaroundTime')}</h6>
            <p className="fs-2 fw-bold mb-0">{data.approvalTurnaroundTime.avgHours}h</p>
            <p className="text-muted small">average across {data.approvalTurnaroundTime.sampleSize} resolved change requests</p>
          </div>
        </div>
        <div className="col-md-6">
          <div className="card shadow-sm p-3">
            <h6>{t('departmentCapacityUtilization')}</h6>
            <Bar data={{
              labels: data.departmentCapacityUtilization.map((c) => `${c.site}/${c.department}`),
              datasets: [{ label: '% filled', data: data.departmentCapacityUtilization.map((c) => c.pct), backgroundColor: '#4A90D9' }],
            }} options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { max: 100 } } }} />
          </div>
        </div>
      </div>
    </div>
  );
}
