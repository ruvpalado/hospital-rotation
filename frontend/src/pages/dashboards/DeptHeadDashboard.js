import React from 'react';
import { useTranslation } from 'react-i18next';
import { Bar } from 'react-chartjs-2';
import './ChartSetup';
import { useKpiOverview } from './useKpis';
import KpiCard from '../../components/KpiCard';
import { useAuth } from '../../context/AuthContext';

// Department Head: Department Allocation Balance, Rotation Equity,
// Physician Rotation Compliance, Approval Turnaround Time
export default function DeptHeadDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data, loading } = useKpiOverview();

  if (loading || !data) return <div className="text-center mt-5">Loading KPIs...</div>;

  const myDeptCounts = data.departmentAllocationBalance.countsByDept;

  return (
    <div className="container-fluid py-4">
      <h4 className="mb-3">Department Head Dashboard{user?.homeDepartmentId ? '' : ''}</h4>
      <div className="row g-3 mb-4">
        <div className="col-md-3"><KpiCard label={t('departmentAllocationBalance')} value={data.departmentAllocationBalance.balancePct} suffix="%" subtext="balance across departments" accent="#4A90D9" /></div>
        <div className="col-md-3"><KpiCard label={t('rotationEquity')} value={data.rotationEquity.equityPct} suffix="%" subtext="fairness of workload across physicians" accent="#7FB37F" /></div>
        <div className="col-md-3"><KpiCard label={t('rotationBlockCompletion')} value={data.rotationBlockCompletion.pct} suffix="%" accent="#D9A84A" /></div>
        <div className="col-md-3"><KpiCard label={t('approvalTurnaroundTime')} value={data.approvalTurnaroundTime.avgHours} suffix="h" accent="#D95F4A" /></div>
      </div>

      <div className="row g-3">
        <div className="col-md-6">
          <div className="card shadow-sm p-3">
            <h6>{t('departmentAllocationBalance')} - counts by department</h6>
            <Bar data={{
              labels: Object.keys(myDeptCounts),
              datasets: [{ label: 'Assignments', data: Object.values(myDeptCounts), backgroundColor: '#4A90D9' }],
            }} options={{ responsive: true, plugins: { legend: { display: false } } }} />
          </div>
        </div>
        <div className="col-md-6">
          <div className="card shadow-sm p-3">
            <h6>{t('rotationEquity')} - completed rotations per physician</h6>
            <Bar data={{
              labels: data.rotationEquity.counts.map((_, i) => `Phys ${i + 1}`),
              datasets: [{ label: 'Completed rotations', data: data.rotationEquity.counts, backgroundColor: '#7FB37F' }],
            }} options={{ responsive: true, plugins: { legend: { display: false } } }} />
          </div>
        </div>
      </div>
    </div>
  );
}
