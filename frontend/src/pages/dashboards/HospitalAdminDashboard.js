import React from 'react';
import { useTranslation } from 'react-i18next';
import { Bar } from 'react-chartjs-2';
import './ChartSetup';
import { useKpiOverview } from './useKpis';
import KpiCard from '../../components/KpiCard';

// Hospital Administrator: a view-only dashboard scoped to just this user's
// own hospital (their home_site_id). The backend (kpiController.overview)
// detects the 'hospital_admin' role and filters every KPI below to that one
// site automatically -- this component never sends a siteId itself, it just
// renders whatever scoped data comes back. Deliberately omits
// hospital-wide-only concepts (Notification Success Rate, Audit Log
// Completeness, Department Allocation Balance across all departments) since
// those don't have a clean single-hospital reading; see AdminDashboard for
// the unscoped, full-hospital-network view (Admin / Program Manager).
export default function HospitalAdminDashboard() {
  const { t } = useTranslation();
  const { data, loading } = useKpiOverview();

  if (loading || !data) return <div className="text-center mt-5">Loading KPIs...</div>;

  // siteUtilization/departmentCapacityUtilization/etc. are already
  // site-filtered server-side, so this object/array effectively describes
  // just one hospital.
  const siteLabels = Object.keys(data.siteUtilization);
  const siteValues = Object.values(data.siteUtilization);

  const conflictIds = [...new Set((data.conflictFreeScheduling.conflictDetails || []).flatMap((c) => [c.a, c.b]))];
  const conflictLink = conflictIds.length ? `/schedules?conflictIds=${conflictIds.join(',')}` : undefined;

  const capacityData = {
    labels: data.departmentCapacityUtilization.map((r) => r.department),
    datasets: [{ label: '% filled', data: data.departmentCapacityUtilization.map((r) => r.pct), backgroundColor: '#4A90D9' }],
  };

  return (
    <div className="container-fluid py-4">
      <h4 className="mb-3">Hospital Administrator Dashboard</h4>
      <p className="text-muted small mb-3">Showing data for your hospital only.</p>

      <div className="row g-3 mb-4">
        <div className="col-md-3"><KpiCard label={t('rotationCoverageRate')} value={data.rotationCoverageRate.ratePct} suffix="%" subtext={`${data.rotationCoverageRate.assignedPhysicians}/${data.rotationCoverageRate.totalPhysicians} physicians`} /></div>
        <div className="col-md-3"><KpiCard label={t('curriculumCompliance')} value={data.curriculumCompliance.pct} suffix="%" subtext={`${data.curriculumCompliance.completed}/${data.curriculumCompliance.expected} block-assignments`} accent="#7FB37F" /></div>
        <div className="col-md-3"><KpiCard label={t('conflictFreeScheduling')} value={data.conflictFreeScheduling.conflicts} subtext="overlapping assignments detected" accent="#D95F4A" to={conflictLink} /></div>
        <div className="col-md-3"><KpiCard label="Rotations at this hospital" value={siteValues.reduce((a, b) => a + b, 0)} accent="#D9A84A" /></div>
      </div>

      <div className="row g-3">
        <div className="col-md-6">
          <div className="card shadow-sm p-3">
            <h6>{t('departmentCapacityUtilization')}</h6>
            <Bar data={capacityData} options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { max: 100, ticks: { callback: (v) => `${v}%` } } } }} />
          </div>
        </div>
        <div className="col-md-6">
          <div className="card shadow-sm p-3">
            <h6>{t('criticalUnitCoverage')}</h6>
            <Bar data={{
              labels: data.criticalUnitCoverage.map((c) => c.department),
              datasets: [{ label: '% of blocks covered', data: data.criticalUnitCoverage.map((c) => c.pct), backgroundColor: '#D95F4A' }],
            }} options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { max: 100 } } }} />
          </div>
        </div>
      </div>

      <div className="row g-3 mt-1">
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
