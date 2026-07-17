import React from 'react';
import { useTranslation } from 'react-i18next';
import { Bar, Doughnut } from 'react-chartjs-2';
import './ChartSetup';
import { useKpiOverview } from './useKpis';
import KpiCard from '../../components/KpiCard';

// Hospital Administrator: Rotation Coverage Rate, Site Utilization, Department
// Capacity Utilization, Curriculum Compliance, Notification Success Rate, Audit Log Completeness
export default function AdminDashboard() {
  const { t } = useTranslation();
  const { data, loading } = useKpiOverview();

  if (loading || !data) return <div className="text-center mt-5">Loading KPIs...</div>;

  const siteLabels = Object.keys(data.siteUtilization);
  const siteValues = Object.values(data.siteUtilization);

  return (
    <div className="container-fluid py-4">
      <h4 className="mb-3">Hospital Administrator Dashboard</h4>
      <div className="row g-3 mb-4">
        <div className="col-md-3"><KpiCard label={t('rotationCoverageRate')} value={data.rotationCoverageRate.ratePct} suffix="%" subtext={`${data.rotationCoverageRate.assignedPhysicians}/${data.rotationCoverageRate.totalPhysicians} physicians`} /></div>
        <div className="col-md-3"><KpiCard label={t('curriculumCompliance')} value={data.curriculumCompliance.pct} suffix="%" subtext={`${data.curriculumCompliance.completed}/${data.curriculumCompliance.expected} block-assignments`} accent="#7FB37F" /></div>
        <div className="col-md-3"><KpiCard label={t('notifications') + ' success'} value={data.notificationSuccessRate.pct} suffix="%" subtext={`${data.notificationSuccessRate.succeeded}/${data.notificationSuccessRate.total}`} accent="#D9A84A" /></div>
        <div className="col-md-3"><KpiCard label={t('conflictFreeScheduling')} value={data.conflictFreeScheduling.conflicts} subtext="overlapping assignments detected" accent="#D95F4A" /></div>
      </div>

      <div className="row g-3">
        <div className="col-md-6">
          <div className="card shadow-sm p-3">
            <h6>{t('siteUtilization')}</h6>
            <Bar data={{ labels: siteLabels, datasets: [{ label: 'Rotations', data: siteValues, backgroundColor: '#4A90D9' }] }} options={{ responsive: true, plugins: { legend: { display: false } } }} />
          </div>
        </div>
        <div className="col-md-6">
          <div className="card shadow-sm p-3">
            <h6>{t('departmentAllocationBalance')} ({data.departmentAllocationBalance.balancePct}%)</h6>
            <Doughnut data={{
              labels: Object.keys(data.departmentAllocationBalance.countsByDept),
              datasets: [{ data: Object.values(data.departmentAllocationBalance.countsByDept), backgroundColor: Object.keys(data.departmentAllocationBalance.countsByDept).map((_, i) => `hsl(${(i * 37) % 360},65%,55%)`) }],
            }} />
          </div>
        </div>
      </div>

      <div className="row g-3 mt-1">
        <div className="col-md-6">
          <div className="card shadow-sm p-3">
            <h6>{t('criticalUnitCoverage')}</h6>
            <Bar data={{
              labels: data.criticalUnitCoverage.map((c) => c.department),
              datasets: [{ label: '% of blocks covered', data: data.criticalUnitCoverage.map((c) => c.pct), backgroundColor: '#D95F4A' }],
            }} options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { max: 100 } } }} />
          </div>
        </div>
        <div className="col-md-6">
          <div className="card shadow-sm p-3">
            <h6>{t('siteRotationCompliance')}</h6>
            <Bar data={{
              labels: data.siteRotationCompliance.map((c) => c.site),
              datasets: [{ label: '% compliant', data: data.siteRotationCompliance.map((c) => c.pct), backgroundColor: '#7FB37F' }],
            }} options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { max: 100 } } }} />
          </div>
        </div>
      </div>
    </div>
  );
}
