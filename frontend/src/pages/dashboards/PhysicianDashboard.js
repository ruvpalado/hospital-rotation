import React from 'react';
import { useTranslation } from 'react-i18next';
import { Doughnut } from 'react-chartjs-2';
import './ChartSetup';
import { usePhysicianKpis } from './useKpis';
import KpiCard from '../../components/KpiCard';
import { useAuth } from '../../context/AuthContext';

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
        <div className="col-md-4"><KpiCard label={t('specialtyExposure')} value={se.pct} suffix="%" subtext={`${se.distinctDepartments}/${se.totalDepartments} departments rotated through`} accent="#7FB37F" /></div>
      </div>

      <div className="row g-3">
        <div className="col-md-6">
          <div className="card shadow-sm p-3">
            <h6>{t('individualRotationCompletion')}</h6>
            <Doughnut data={{
              labels: ['Completed', 'Remaining'],
              datasets: [{ data: [irc.completed, Math.max(0, irc.totalRequired - irc.completed)], backgroundColor: ['#7FB37F', '#e0e0e0'] }],
            }} />
          </div>
        </div>
        <div className="col-md-6">
          <div className="card shadow-sm p-3">
            <h6>{t('specialtyExposure')}</h6>
            <Doughnut data={{
              labels: ['Exposed', 'Not yet'],
              datasets: [{ data: [se.distinctDepartments, Math.max(0, se.totalDepartments - se.distinctDepartments)], backgroundColor: ['#4A90D9', '#e0e0e0'] }],
            }} />
          </div>
        </div>
      </div>
      <p className="text-muted small mt-3">Go to Schedules to see your upcoming rotation blocks, dates, and weekly attendance. Go to Notifications for rotation change alerts.</p>
    </div>
  );
}
