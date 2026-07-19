import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useKpiOverview, usePhysicianKpis } from './dashboards/useKpis';

/**
 * "Generate Report" view, available to every role. Content is populated based
 * on the logged-in user's level, mirroring the User-Level KPI Dashboard table
 * from the project spec:
 *   Hospital Administrator -> Rotation Coverage Rate, Site Utilization,
 *     Department Capacity Utilization, Curriculum Compliance,
 *     Notification Success Rate, Audit Log Completeness
 *   Master Scheduler -> Schedule Publication Timeliness, Conflict-Free
 *     Scheduling, Rotation Block Completion, Change Request Rate,
 *     Approval Turnaround Time
 *   Department Head -> Department Allocation Balance, Rotation Equity,
 *     Rotation Block Completion, Approval Turnaround Time
 *   Physician -> Individual Rotation Completion, Specialty Exposure,
 *     Notification Delivery Rate
 * Uses the browser's native print dialog (Save as PDF) rather than a new
 * backend dependency, since this is the same data already served to the
 * dashboards -- just laid out for printing.
 */
export default function Report() {
  const { user } = useAuth();
  const { data: overview, loading: overviewLoading } = useKpiOverview();
  const physicianKpis = usePhysicianKpis(user?.role === 'physician' ? user.id : null);

  const loading = user?.role === 'physician' ? !physicianKpis : overviewLoading || !overview;

  if (loading) return <div className="text-center mt-5">Building report...</div>;

  const generatedAt = new Date().toLocaleString();

  return (
    <div className="container py-4" id="report-root">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          #report-root { padding: 0 !important; }
        }
        .report-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #eee; }
        .report-row:last-child { border-bottom: none; }
        .report-section-title { margin-top: 24px; margin-bottom: 8px; border-bottom: 2px solid #333; padding-bottom: 4px; }
      `}</style>

      <div className="d-flex justify-content-between align-items-center mb-2 no-print">
        <h4 className="mb-0">Generate Report</h4>
        <button className="btn btn-primary" onClick={() => window.print()}>Print / Save as PDF</button>
      </div>

      <h3 className="mb-0">OBGYN Master Rotation — {roleReportTitle(user?.role)}</h3>
      <p className="text-muted">
        Generated {generatedAt} for {user?.fullName} ({user?.roleLabel})
      </p>

      {user?.role === 'admin' && <AdminReport data={overview} />}
      {user?.role === 'scheduler' && <SchedulerReport data={overview} />}
      {user?.role === 'dept_head' && <DeptHeadReport data={overview} />}
      {user?.role === 'physician' && <PhysicianReport data={physicianKpis} />}
    </div>
  );
}

function roleReportTitle(role) {
  switch (role) {
    case 'admin': return 'Hospital Administrator Report';
    case 'scheduler': return 'Master Scheduler Report';
    case 'dept_head': return 'Department Head Report';
    case 'physician': return 'Physician Report';
    default: return 'Report';
  }
}

function Row({ label, value, subtext }) {
  return (
    <div className="report-row">
      <span>{label}</span>
      <span className="text-end">
        <strong>{value}</strong>
        {subtext && <div className="text-muted small">{subtext}</div>}
      </span>
    </div>
  );
}

function AdminReport({ data }) {
  return (
    <div>
      <h5 className="report-section-title">Overall Hospital Performance &amp; Compliance</h5>
      <Row label="Rotation Coverage Rate" value={`${data.rotationCoverageRate.ratePct}%`}
        subtext={`${data.rotationCoverageRate.assignedPhysicians}/${data.rotationCoverageRate.totalPhysicians} physicians assigned`} />
      <Row label="Site Utilization (rotations per site)" value={Object.entries(data.siteUtilization).map(([s, v]) => `${s}: ${v}`).join(', ')} />
      <Row label="Department Capacity Utilization (avg)" value={`${avgPct(data.departmentCapacityUtilization)}%`}
        subtext={`${data.departmentCapacityUtilization.length} site/department slots tracked`} />
      <Row label="Curriculum Compliance" value={`${data.curriculumCompliance.pct}%`}
        subtext={`${data.curriculumCompliance.completed}/${data.curriculumCompliance.expected} block-assignments completed`} />
      <Row label="Notification Success Rate" value={`${data.notificationSuccessRate.pct}%`}
        subtext={`${data.notificationSuccessRate.succeeded}/${data.notificationSuccessRate.total} notifications`} />
      <Row label="Audit Log Completeness" value={`${data.auditLogCompleteness.pct}%`}
        subtext={`${data.auditLogCompleteness.attributed}/${data.auditLogCompleteness.total} log entries properly attributed`} />
    </div>
  );
}

function SchedulerReport({ data }) {
  return (
    <div>
      <h5 className="report-section-title">Scheduling Efficiency &amp; Accuracy</h5>
      <Row label="Schedule Publication Timeliness" value={`${data.schedulePublicationTimeliness.avgDaysAhead} days ahead (avg)`}
        subtext={`across ${data.schedulePublicationTimeliness.sampleSize} published blocks`} />
      <Row label="Conflict-Free Scheduling" value={`${data.conflictFreeScheduling.conflicts} conflicts`}
        subtext="overlapping assignments for the same physician" />
      <Row label="Rotation Block Completion" value={`${data.rotationBlockCompletion.pct}%`}
        subtext={`${data.rotationBlockCompletion.completed}/${data.rotationBlockCompletion.total} assignments completed`} />
      <Row label="Change Request Rate" value={`${data.changeRequestRate.pct}%`}
        subtext={`${data.changeRequestRate.changeRequests}/${data.changeRequestRate.totalAssignments} assignments had a change request`} />
      <Row label="Approval Turnaround Time" value={`${data.approvalTurnaroundTime.avgHours} hours (avg)`}
        subtext={`across ${data.approvalTurnaroundTime.sampleSize} resolved change requests`} />
    </div>
  );
}

function DeptHeadReport({ data }) {
  return (
    <div>
      <h5 className="report-section-title">Department-Level Rotation Management</h5>
      <Row label="Department Allocation Balance" value={`${data.departmentAllocationBalance.balancePct}%`}
        subtext="100% = perfectly even distribution across departments" />
      <Row label="Rotation Equity" value={`${data.rotationEquity.equityPct}%`}
        subtext="100% = perfectly equal completed-rotation workload across physicians" />
      <Row label="Rotation Block Completion" value={`${data.rotationBlockCompletion.pct}%`}
        subtext={`${data.rotationBlockCompletion.completed}/${data.rotationBlockCompletion.total} assignments completed`} />
      <Row label="Approval Turnaround Time" value={`${data.approvalTurnaroundTime.avgHours} hours (avg)`} />
      <p className="text-muted small mt-2">
        Figures above are hospital-wide; department-scoped filtering can be added if you need
        numbers restricted to just your own department.
      </p>
    </div>
  );
}

function PhysicianReport({ data }) {
  const { individualRotationCompletion: irc, specialtyExposure: se, notificationDeliveryRate: nd } = data;
  return (
    <div>
      <h5 className="report-section-title">Personal Rotation Progress</h5>
      <Row label="Individual Rotation Completion" value={`${irc.pct}%`} subtext={`${irc.completed}/${irc.totalRequired} curriculum blocks completed`} />
      <Row label="Specialty Exposure" value={`${se.pct}%`} subtext={`${se.distinctDepartments}/${se.totalDepartments} departments rotated through`} />
      <Row label="Notification Delivery Rate" value={`${nd.pct}%`} subtext={`${nd.succeeded}/${nd.total} notifications delivered`} />
    </div>
  );
}

function avgPct(rows) {
  if (!rows || rows.length === 0) return 0;
  const sum = rows.reduce((acc, r) => acc + r.pct, 0);
  return Math.round((sum / rows.length) * 10) / 10;
}
