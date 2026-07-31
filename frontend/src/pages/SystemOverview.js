import React from 'react';
import { APP_NAME, APP_VERSION, APP_AUTHOR, APP_YEAR } from '../version';

/**
 * System Overview -- an in-app reference module describing the whole system:
 * its purpose, functions, roles, KPIs, data model, architecture, security and
 * deployment. Content is sourced from the project's README.md and
 * KPI_FORMULAS.md so it stays faithful to what's actually implemented.
 * Available to every authenticated user (informational, no role gating).
 */

const ROLES = [
  ['Developer', 'System owner / maintainer. Superset of Program Administrator. Exclusive access to the Audit Log, Physician List management, and role editing.'],
  ['Program Administrator', 'The elevated operational role (successor to the retired "Admin"). Full access to scheduling, approvals, user management, reports and all KPIs.'],
  ['Program Manager', 'Hospital-wide oversight. Sees the same elevated dashboard and KPI set as the Program Administrator.'],
  ['Hospital Administrator', 'Site-scoped administrator. Same KPI set, filtered to a single hospital.'],
  ['Department Head', 'Department-level oversight: rotation coverage, equity and approvals for their department.'],
  ['Physician', 'Personal view: individual rotation progress, specialty exposure, upcoming rotations, and self-reported weekly attendance.'],
];

// How each module behaves per role. Kept faithful to the current access rules
// (RBAC middleware + route gating). "PA" = Program Administrator.
const MODULE_ACCESS = [
  ['Dashboard', 'Loads automatically based on the signed-in role.', [
    ['PA / Program Manager / Developer', 'Full hospital-wide KPI dashboard.'],
    ['Hospital Administrator', 'Same KPI set, scoped to their hospital.'],
    ['Department Head', 'Department-level coverage, equity, and approvals.'],
    ['Physician', 'Personal progress, specialty exposure, and upcoming rotations.'],
  ]],
  ['Schedules', 'View and manage physician rotation assignments by block, site, and department.', [
    ['Program Administrator', 'Full: view, add, edit, delete (except completed), set & approve weekly attendance.'],
    ['Developer', 'View, edit, and delete (except completed). Cannot add schedules or change weekly attendance.'],
    ['Program Manager / Hospital Administrator / Department Head', 'View only.'],
    ['Physician', 'Views their own schedule; proposes weekly attendance via My Attendance.'],
  ]],
  ['Approvals', 'Two flows: Department Approval (rotation change requests) and User Approval (pending registrations).', [
    ['Program Administrator', 'Resolves change requests and approves/rejects account requests.'],
    ['Department Head', 'Resolves change requests for their department.'],
    ['Developer', 'Views both; approves/rejects accounts (required for Program Administrator account requests); cannot resolve change requests.'],
    ['Physician / others', 'No approval access.'],
  ]],
  ['Reports', 'On-demand KPI reports; content is scoped to the role.', [
    ['PA / Program Manager / Developer', 'Full hospital-wide report set.'],
    ['Hospital Administrator', 'Same set, scoped to their hospital.'],
    ['Department Head / Physician', 'Scoped to their department / themselves.'],
  ]],
  ['Notifications', 'Registration, approval, and upcoming-rotation messages.', [
    ['All roles', 'See their own notifications.'],
    ['Program Administrator', 'Can also view all notifications.'],
  ]],
  ['Users', 'User account management.', [
    ['Program Administrator', 'View accounts; deactivate / reactivate; approve / reject.'],
    ['Developer', 'All of the above, plus Edit Role (developer-only). Cannot run the destructive maintenance actions.'],
    ['Other roles', 'No access.'],
  ]],
  ['Physician List', 'The name-only roster that powers the physician autocomplete and the KPI physician total.', [
    ['Developer', 'Exclusive: CSV upload, manual add, and delete.'],
    ['Other roles', 'No access.'],
  ]],
  ['Audit Log', 'Immutable record of sensitive actions for compliance/forensics.', [
    ['Developer', 'Exclusive: view the full audit trail.'],
    ['Other roles', 'No access.'],
  ]],
  ['My Attendance', 'Physician self-service weekly attendance.', [
    ['Physician', 'Proposes a weekly status (attended / leave / absent) for admin approval.'],
    ['Other roles', 'Not applicable.'],
  ]],
  ['System Overview', 'This reference page.', [
    ['All roles', 'Read access.'],
  ]],
];

const KPI_GROUPS = [
  ['Coverage & Distribution', [
    ['Rotation Coverage Rate', 'Physicians with ≥1 assignment in the block ÷ total physicians × 100'],
    ['Department Allocation Balance', 'Evenness of assignments across departments (100% = perfectly even)'],
    ['Site Utilization', 'Count of rotation assignments per site'],
  ]],
  ['Accuracy & Compliance', [
    ['Curriculum Compliance', 'Completed block-assignments ÷ (physicians × 13 blocks) × 100'],
    ['Rotation Block Completion', 'Completed assignments in the block ÷ total assignments × 100'],
    ['Conflict-Free Scheduling', 'Count of overlapping assignment pairs for the same physician (target 0)'],
  ]],
  ['Physician-Level', [
    ['Individual Rotation Completion', 'Completed blocks for the physician ÷ 13 × 100'],
    ['Specialty Exposure', 'Distinct departments rotated through ÷ total departments × 100'],
    ['Rotation Equity', 'Evenness of completed-rotation counts across physicians (100% = equal)'],
  ]],
  ['Department & Site', [
    ['Department Capacity Utilization', 'Filled slots ÷ capacity per block × 100'],
    ['Site Rotation Compliance', 'Departments at the site with ≥1 assignment ÷ departments required × 100'],
    ['Critical Unit Coverage', 'Blocks covered ÷ 13 for each critical unit (NICU, ICU, Emergency, Gyne-Onc Research)'],
  ]],
  ['Operational', [
    ['Schedule Publication Timeliness', 'Avg (block start − published date), in days'],
    ['Change Request Rate', 'Change requests ÷ total assignments in the block × 100'],
    ['Approval Turnaround Time', 'Avg (resolved − requested) across change requests, in hours'],
    ['Notification Success Rate', 'Notifications sent / mock-sent ÷ total notifications × 100'],
  ]],
];

function Section({ title, subtitle, children }) {
  return (
    <section className="mb-4">
      <h5 className="border-bottom pb-2 mb-3">{title}</h5>
      {subtitle && <p className="text-muted">{subtitle}</p>}
      {children}
    </section>
  );
}

export default function SystemOverview() {
  return (
    <div className="container py-4" style={{ maxWidth: 960 }}>
      <div className="mb-4">
        <h3 className="mb-1">{APP_NAME}</h3>
        <p className="text-muted mb-1">System Overview &mdash; version {APP_VERSION}</p>
        <span className="badge bg-primary">Role-based rotation management for OBGYN residency training</span>
      </div>

      <Section title="Purpose">
        <p>
          {APP_NAME} is a role-based web application for scheduling and monitoring resident
          physician rotations across multiple hospital sites and departments, aligned with the
          OBGYN Master Rotation curriculum (13 four-week blocks). It gives scheduling and clinical
          leadership a single source of truth for who is rotating where, whether coverage and
          curriculum requirements are being met, and how the program is performing against a
          defined set of KPIs.
        </p>
      </Section>

      <Section title="Core rule: when a rotation counts as complete">
        <div className="alert alert-info">
          A rotation is <strong>complete</strong> only when the physician has at least
          <strong> 3 of the 4 weeks</strong> in a block marked <em>attended</em>.
          <strong> Maternity and annual leave never count</strong> toward completion, even though
          they occupy a slot. Every completion-based KPI derives from this rule.
        </div>
      </Section>

      <Section title="What the system does">
        <ul>
          <li><strong>Rotation scheduling</strong> &mdash; assign physicians to site-departments for each curriculum block, week by week.</li>
          <li><strong>Weekly attendance workflow</strong> &mdash; physicians propose a weekly status; an administrator approves it, with a full audit trail.</li>
          <li><strong>Approvals</strong> &mdash; department and user-account approvals, with elevated (Program Administrator) requests routed to the developer account.</li>
          <li><strong>KPI dashboards</strong> &mdash; 16 KPIs rendered as role-specific dashboards and reports.</li>
          <li><strong>Change requests</strong> &mdash; file, track and resolve modifications to assignments.</li>
          <li><strong>Notifications</strong> &mdash; registration, approval and upcoming-rotation reminders (a daily job alerts 3&ndash;5 days ahead).</li>
          <li><strong>Audit logging</strong> &mdash; every sensitive action, including role changes, is recorded.</li>
          <li><strong>Localization</strong> &mdash; English / Arabic toggle with right-to-left support.</li>
        </ul>
      </Section>

      <Section title="User roles & permissions" subtitle="The dashboard and available modules adjust automatically to the signed-in user's role.">
        <div className="table-responsive">
          <table className="table table-sm table-striped align-middle">
            <thead><tr><th style={{ width: '30%' }}>Role</th><th>Access</th></tr></thead>
            <tbody>
              {ROLES.map(([r, d]) => (
                <tr key={r}><td><span className="badge bg-secondary">{r}</span></td><td>{d}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="How each module works by role" subtitle="What each module does and how access differs by role. The dashboard and menus adjust automatically to the signed-in role.">
        {MODULE_ACCESS.map(([name, desc, roles]) => (
          <div key={name} className="mb-3">
            <h6 className="text-primary mb-1">{name}</h6>
            <p className="text-muted small mb-2">{desc}</p>
            <table className="table table-sm mb-0">
              <tbody>
                {roles.map(([role, access]) => (
                  <tr key={role}>
                    <td style={{ width: '38%' }}>{role}</td>
                    <td className="small">{access}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </Section>

      <Section title="Sites & departments">
        <p>
          Nine hospital sites &mdash; SQUH, Royal Hospital, Khoula, Nizwa, Sohar, Medical City
          (MOD), Local Health Centers, SQCCCRC, and the National Genetics Center &mdash; each
          offering a defined set of the ~23 department/team codes (e.g. GOBG/HRP/MFM, RE&amp;MIS,
          Gyne-Oncology, Urogynecology, Delivery Suite, OT, Clinic, plus critical units NICU, ICU,
          Emergency and Research). Each site and department carries a stable colour for dashboard
          colour-coding.
        </p>
      </Section>

      <Section title="Key performance indicators (16)" subtitle="Computed server-side and exposed at /api/kpis. See KPI_FORMULAS.md for full definitions.">
        {KPI_GROUPS.map(([group, items]) => (
          <div key={group} className="mb-3">
            <h6 className="text-primary">{group}</h6>
            <table className="table table-sm mb-0">
              <tbody>
                {items.map(([name, formula]) => (
                  <tr key={name}>
                    <td style={{ width: '35%' }}><strong>{name}</strong></td>
                    <td className="text-muted small">{formula}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </Section>

      <p className="text-center text-muted small mt-4">
        {APP_NAME} v{APP_VERSION} &middot; &copy; {APP_YEAR} {APP_AUTHOR}
      </p>
    </div>
  );
}
