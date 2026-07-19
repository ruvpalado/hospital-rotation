import React from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { useAuth } from '../context/AuthContext';
import { useKpiOverview, usePhysicianKpis } from './dashboards/useKpis';
import './dashboards/ChartSetup';

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
 *
 * IMPORTANT: every row/chart shown on a role's live Dashboard is reproduced
 * here (same underlying figures, same breakdown-by-department/site/physician
 * charts), so the printed report is never missing something the user can see
 * on screen. Extra KPIs beyond what the dashboard shows (e.g. Audit Log
 * Completeness for Admin, Notification Delivery Rate for Physician) are kept
 * too, since the project spec calls for them at that role's level even
 * though the live dashboard chart area doesn't have room for every metric.
 * Charts come first in each section, with the detailed numeric figures
 * ("Detailed Figures") placed at the bottom for reference.
 *
 * Print layout: @page sets real page margins for the printed/PDF output
 * (2cm top/bottom, 2.54cm right, 1.5cm left), and #report-root gets its own
 * comfortable padding on screen so the content isn't flush against the
 * browser edges.
 *
 * Department Capacity Utilization is charted two ways: by site (filled
 * slots / capacity summed across that site's departments) and by department
 * (summed across all sites offering that department) -- one bar per
 * site/department combination was too dense to read at a glance.
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
        @page {
          margin-top: 2cm;
          margin-right: 2.54cm;
          margin-bottom: 2cm;
          margin-left: 1.5cm;
        }
        @media print {
          .no-print { display: none !important; }
          #report-root { padding: 0 !important; margin: 0 !important; max-width: none !important; }
          .chart-box { page-break-inside: avoid; }
          .report-section-title, h5, h6 { page-break-after: avoid; }
        }
        #report-root { padding: 24px; }
        .report-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #eee; }
        .report-row:last-child { border-bottom: none; }
        .report-section-title { margin-top: 24px; margin-bottom: 8px; border-bottom: 2px solid #333; padding-bottom: 4px; }
        .chart-box { position: relative; margin-bottom: 8px; }
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

/** Fixed-height wrapper so Chart.js's responsive canvas has a stable size to
 * measure both on screen and inside the print media query. */
function ChartBox({ height = 220, children }) {
  return <div className="chart-box" style={{ height }}>{children}</div>;
}

const pctHorizontalOptions = {
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: { x: { min: 0, max: 100, ticks: { callback: (v) => `${v}%` } } },
};

const pctVerticalOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: { y: { min: 0, max: 100, ticks: { callback: (v) => `${v}%` } } },
};

const countBarOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: { y: { beginAtZero: true } },
};

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: 'bottom' } },
};

function AdminReport({ data }) {
  const metricsBarData = {
    labels: ['Rotation Coverage', 'Curriculum Compliance', 'Notification Success', 'Audit Log Completeness'],
    datasets: [{
      label: '%',
      data: [
        data.rotationCoverageRate.ratePct,
        data.curriculumCompliance.pct,
        data.notificationSuccessRate.pct,
        data.auditLogCompleteness.pct,
      ],
      backgroundColor: ['#4A90D9', '#7FB37F', '#D9A84A', '#8E7CC3'],
    }],
  };

  const siteUtilData = {
    labels: Object.keys(data.siteUtilization),
    datasets: [{ label: 'Rotations', data: Object.values(data.siteUtilization), backgroundColor: '#4A90D9' }],
  };

  // Department Capacity Utilization, two ways: by site and by department.
  const capacityBySite = aggregateCapacity(data.departmentCapacityUtilization, 'site');
  const capacityBySiteData = {
    labels: capacityBySite.map((c) => c.key),
    datasets: [{ label: '% filled', data: capacityBySite.map((c) => c.pct), backgroundColor: '#D95F4A' }],
  };
  const capacityByDept = aggregateCapacity(data.departmentCapacityUtilization, 'department');
  const capacityByDeptData = {
    labels: capacityByDept.map((c) => c.key),
    datasets: [{ label: '% filled', data: capacityByDept.map((c) => c.pct), backgroundColor: '#8E7CC3' }],
  };

  // Same countsByDept breakdown the Admin Dashboard shows as a doughnut.
  const deptAllocData = {
    labels: Object.keys(data.departmentAllocationBalance.countsByDept),
    datasets: [{
      data: Object.values(data.departmentAllocationBalance.countsByDept),
      backgroundColor: Object.keys(data.departmentAllocationBalance.countsByDept).map((_, i) => `hsl(${(i * 37) % 360},65%,55%)`),
    }],
  };

  // Same conflict count the Admin Dashboard shows as a KPI card, visualized
  // against total assignments for context.
  const totalAssignments = data.rotationBlockCompletion.total;
  const conflictData = {
    labels: ['Conflicting', 'Clean'],
    datasets: [{
      data: [data.conflictFreeScheduling.conflicts, Math.max(totalAssignments - data.conflictFreeScheduling.conflicts, 0)],
      backgroundColor: ['#D95F4A', '#7FB37F'],
    }],
  };

  // Same charts the Admin Dashboard shows: Critical Unit Coverage and Site
  // Rotation Compliance (both Bar charts, by department / by site).
  const criticalUnitData = {
    labels: data.criticalUnitCoverage.map((c) => c.department),
    datasets: [{ label: '% of blocks covered', data: data.criticalUnitCoverage.map((c) => c.pct), backgroundColor: '#D95F4A' }],
  };
  const siteComplianceData = {
    labels: data.siteRotationCompliance.map((c) => c.site),
    datasets: [{ label: '% compliant', data: data.siteRotationCompliance.map((c) => c.pct), backgroundColor: '#7FB37F' }],
  };

  return (
    <div>
      <h5 className="report-section-title">Overall Hospital Performance &amp; Compliance</h5>

      <h6 className="mt-2 mb-2">Key Compliance &amp; Coverage Metrics</h6>
      <ChartBox height={200}><Bar data={metricsBarData} options={pctHorizontalOptions} /></ChartBox>

      <div className="row mt-3">
        <div className="col-md-6">
          <h6 className="mb-2">Site Utilization (rotations per site)</h6>
          <ChartBox><Bar data={siteUtilData} options={countBarOptions} /></ChartBox>
        </div>
        <div className="col-md-6">
          <h6 className="mb-2">Department Capacity Utilization (% filled, by site)</h6>
          <ChartBox><Bar data={capacityBySiteData} options={pctVerticalOptions} /></ChartBox>
        </div>
      </div>

      <div className="row mt-3">
        <div className="col-md-6">
          <h6 className="mb-2">Department Capacity Utilization (% filled, by department)</h6>
          <ChartBox><Bar data={capacityByDeptData} options={pctVerticalOptions} /></ChartBox>
        </div>
        <div className="col-md-6">
          <h6 className="mb-2">Department Allocation Balance — counts by department</h6>
          <ChartBox><Doughnut data={deptAllocData} options={doughnutOptions} /></ChartBox>
        </div>
      </div>

      <div className="row mt-3">
        <div className="col-md-6">
          <h6 className="mb-2">Conflict-Free Scheduling</h6>
          <ChartBox><Doughnut data={conflictData} options={doughnutOptions} /></ChartBox>
        </div>
        <div className="col-md-6">
          <h6 className="mb-2">Critical Unit Coverage (NICU / ICU / Emergency / Research)</h6>
          <ChartBox><Bar data={criticalUnitData} options={pctVerticalOptions} /></ChartBox>
        </div>
      </div>

      <div className="row mt-3">
        <div className="col-md-6">
          <h6 className="mb-2">Site Rotation Compliance</h6>
          <ChartBox><Bar data={siteComplianceData} options={pctVerticalOptions} /></ChartBox>
        </div>
      </div>

      <h6 className="mt-4 mb-2">Detailed Figures</h6>
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
      <Row label="Department Allocation Balance" value={`${data.departmentAllocationBalance.balancePct}%`}
        subtext="100% = perfectly even distribution across departments" />
      <Row label="Conflict-Free Scheduling" value={`${data.conflictFreeScheduling.conflicts} conflicts`}
        subtext="overlapping assignments for the same physician" />
    </div>
  );
}

function SchedulerReport({ data }) {
  const pctData = {
    labels: ['Rotation Block Completion', 'Change Request Rate'],
    datasets: [{
      label: '%',
      data: [data.rotationBlockCompletion.pct, data.changeRequestRate.pct],
      backgroundColor: ['#7FB37F', '#D9A84A'],
    }],
  };

  const publicationData = {
    labels: ['Days ahead (avg)'],
    datasets: [{ label: 'Days', data: [data.schedulePublicationTimeliness.avgDaysAhead], backgroundColor: '#4A90D9' }],
  };

  const turnaroundData = {
    labels: ['Hours (avg)'],
    datasets: [{ label: 'Hours', data: [data.approvalTurnaroundTime.avgHours], backgroundColor: '#8E7CC3' }],
  };

  const totalAssignments = data.rotationBlockCompletion.total;
  const conflicts = data.conflictFreeScheduling.conflicts;
  const conflictData = {
    labels: ['Conflicting', 'Clean'],
    datasets: [{
      data: [conflicts, Math.max(totalAssignments - conflicts, 0)],
      backgroundColor: ['#D95F4A', '#7FB37F'],
    }],
  };

  // Same Department Capacity Utilization charts the Scheduler Dashboard
  // shows: by site and by department.
  const capacityBySite = aggregateCapacity(data.departmentCapacityUtilization, 'site');
  const capacityBySiteData = {
    labels: capacityBySite.map((c) => c.key),
    datasets: [{ label: '% filled', data: capacityBySite.map((c) => c.pct), backgroundColor: '#4A90D9' }],
  };
  const capacityByDept = aggregateCapacity(data.departmentCapacityUtilization, 'department');
  const capacityByDeptData = {
    labels: capacityByDept.map((c) => c.key),
    datasets: [{ label: '% filled', data: capacityByDept.map((c) => c.pct), backgroundColor: '#8E7CC3' }],
  };

  return (
    <div>
      <h5 className="report-section-title">Scheduling Efficiency &amp; Accuracy</h5>

      <h6 className="mt-2 mb-2">Block Completion &amp; Change Request Rate</h6>
      <ChartBox height={200}><Bar data={pctData} options={pctHorizontalOptions} /></ChartBox>

      <div className="row mt-3">
        <div className="col-md-4">
          <h6 className="mb-2">Publication Timeliness</h6>
          <ChartBox><Bar data={publicationData} options={countBarOptions} /></ChartBox>
        </div>
        <div className="col-md-4">
          <h6 className="mb-2">Approval Turnaround</h6>
          <ChartBox><Bar data={turnaroundData} options={countBarOptions} /></ChartBox>
        </div>
        <div className="col-md-4">
          <h6 className="mb-2">Conflict-Free Scheduling</h6>
          <ChartBox><Doughnut data={conflictData} options={doughnutOptions} /></ChartBox>
        </div>
      </div>

      <div className="row mt-3">
        <div className="col-md-6">
          <h6 className="mb-2">Department Capacity Utilization (by site)</h6>
          <ChartBox><Bar data={capacityBySiteData} options={pctVerticalOptions} /></ChartBox>
        </div>
        <div className="col-md-6">
          <h6 className="mb-2">Department Capacity Utilization (by department)</h6>
          <ChartBox><Bar data={capacityByDeptData} options={pctVerticalOptions} /></ChartBox>
        </div>
      </div>

      <h6 className="mt-4 mb-2">Detailed Figures</h6>
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
      <Row label="Department Capacity Utilization (avg)" value={`${avgPct(data.departmentCapacityUtilization)}%`}
        subtext={`${data.departmentCapacityUtilization.length} site/department slots tracked`} />
    </div>
  );
}

function DeptHeadReport({ data }) {
  const pctData = {
    labels: ['Department Allocation Balance', 'Rotation Equity', 'Rotation Block Completion'],
    datasets: [{
      label: '%',
      data: [data.departmentAllocationBalance.balancePct, data.rotationEquity.equityPct, data.rotationBlockCompletion.pct],
      backgroundColor: ['#4A90D9', '#7FB37F', '#D9A84A'],
    }],
  };

  const turnaroundData = {
    labels: ['Hours (avg)'],
    datasets: [{ label: 'Hours', data: [data.approvalTurnaroundTime.avgHours], backgroundColor: '#8E7CC3' }],
  };

  // Same two breakdown charts the Department Head Dashboard shows.
  const deptCountsData = {
    labels: Object.keys(data.departmentAllocationBalance.countsByDept),
    datasets: [{ label: 'Assignments', data: Object.values(data.departmentAllocationBalance.countsByDept), backgroundColor: '#4A90D9' }],
  };
  const equityCountsData = {
    labels: data.rotationEquity.counts.map((_, i) => `Phys ${i + 1}`),
    datasets: [{ label: 'Completed rotations', data: data.rotationEquity.counts, backgroundColor: '#7FB37F' }],
  };

  return (
    <div>
      <h5 className="report-section-title">Department-Level Rotation Management</h5>

      <div className="row mt-2">
        <div className="col-md-8">
          <h6 className="mb-2">Allocation Balance, Equity &amp; Block Completion</h6>
          <ChartBox><Bar data={pctData} options={pctHorizontalOptions} /></ChartBox>
        </div>
        <div className="col-md-4">
          <h6 className="mb-2">Approval Turnaround</h6>
          <ChartBox><Bar data={turnaroundData} options={countBarOptions} /></ChartBox>
        </div>
      </div>

      <div className="row mt-3">
        <div className="col-md-6">
          <h6 className="mb-2">Department Allocation Balance — counts by department</h6>
          <ChartBox><Bar data={deptCountsData} options={countBarOptions} /></ChartBox>
        </div>
        <div className="col-md-6">
          <h6 className="mb-2">Rotation Equity — completed rotations per physician</h6>
          <ChartBox><Bar data={equityCountsData} options={countBarOptions} /></ChartBox>
        </div>
      </div>

      <h6 className="mt-4 mb-2">Detailed Figures</h6>
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

  const ircData = {
    labels: ['Completed', 'Remaining'],
    datasets: [{ data: [irc.completed, Math.max(irc.totalRequired - irc.completed, 0)], backgroundColor: ['#7FB37F', '#e9ecef'] }],
  };
  const seData = {
    labels: ['Rotated through', 'Remaining'],
    datasets: [{ data: [se.distinctDepartments, Math.max(se.totalDepartments - se.distinctDepartments, 0)], backgroundColor: ['#4A90D9', '#e9ecef'] }],
  };
  const ndData = {
    labels: ['Delivered', 'Missed'],
    datasets: [{ data: [nd.succeeded, Math.max(nd.total - nd.succeeded, 0)], backgroundColor: ['#D9A84A', '#e9ecef'] }],
  };

  return (
    <div>
      <h5 className="report-section-title">Personal Rotation Progress</h5>

      <div className="row mt-2">
        <div className="col-md-4 text-center">
          <h6 className="mb-2">Rotation Completion</h6>
          <ChartBox><Doughnut data={ircData} options={doughnutOptions} /></ChartBox>
          <div className="text-muted small">{irc.completed}/{irc.totalRequired} blocks ({irc.pct}%)</div>
        </div>
        <div className="col-md-4 text-center">
          <h6 className="mb-2">Specialty Exposure</h6>
          <ChartBox><Doughnut data={seData} options={doughnutOptions} /></ChartBox>
          <div className="text-muted small">{se.distinctDepartments}/{se.totalDepartments} departments ({se.pct}%)</div>
        </div>
        <div className="col-md-4 text-center">
          <h6 className="mb-2">Notification Delivery</h6>
          <ChartBox><Doughnut data={ndData} options={doughnutOptions} /></ChartBox>
          <div className="text-muted small">{nd.succeeded}/{nd.total} delivered ({nd.pct}%)</div>
        </div>
      </div>

      <h6 className="mt-4 mb-2">Detailed Figures</h6>
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

/** Roll the per-site/department capacity rows up to one figure per site OR
 * per department (pass 'site' or 'department' as groupKey): total filled
 * slots / total capacity summed across the grouped rows. */
function aggregateCapacity(rows, groupKey) {
  const grouped = {};
  (rows || []).forEach((r) => {
    const key = r[groupKey];
    if (!grouped[key]) grouped[key] = { filled: 0, capacity: 0 };
    grouped[key].filled += r.filled;
    grouped[key].capacity += r.capacity;
  });
  return Object.entries(grouped).map(([key, v]) => ({
    key,
    pct: v.capacity > 0 ? Math.round((v.filled / v.capacity) * 1000) / 10 : 0,
  }));
}
