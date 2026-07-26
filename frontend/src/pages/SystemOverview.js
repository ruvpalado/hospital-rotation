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

const ENTITIES = [
  ['User / Role', 'Accounts and their role (RBAC). Roles: developer, program_administrator, program_manager, hospital_admin, dept_head, physician.'],
  ['Site / Department / SiteDepartment', 'The 9 hospital sites, ~23 department/team codes, and the many-to-many mapping of which departments run at which site.'],
  ['Block', 'The 13 curriculum rotation blocks, each a 4-week period with start/end dates.'],
  ['RotationAssignment / RotationWeek', 'A physician assigned to a site-department for a block, split into 4 weekly rows each carrying an attendance status.'],
  ['ChangeRequest', 'A requested modification to an assignment, with requester, resolver and timestamps (feeds Change Request Rate & Approval Turnaround).'],
  ['Notification', 'Every email/SMS/system message, persisted with delivery status (mock or live).'],
  ['AuditLog', 'Immutable record of views, creates, edits, approvals, and role changes for accountability.'],
  ['PhysicianRoster', 'A name-only list (no login) that powers the Physician autocomplete on Add Schedule.'],
];

const STACK = [
  ['Backend', 'Node.js + Express, Sequelize ORM, MySQL 8'],
  ['Frontend', 'React 18 (Create React App), React Router, Chart.js, Bootstrap 5'],
  ['Auth & Security', 'JWT (8h), bcrypt hashing, Helmet, express-rate-limit, CORS allowlist'],
  ['Localization', 'i18next — English / Arabic with RTL support'],
  ['Notifications', 'Mock mode by default; Twilio (SMS) + SendGrid (email) in live mode'],
  ['Deployment', 'Docker images on Railway; separate development and production environments'],
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

      <Section title="Architecture & technology">
        <div className="table-responsive">
          <table className="table table-sm table-striped">
            <tbody>
              {STACK.map(([layer, detail]) => (
                <tr key={layer}><td style={{ width: '28%' }}><strong>{layer}</strong></td><td>{detail}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Data model">
        <div className="table-responsive">
          <table className="table table-sm table-striped">
            <thead><tr><th style={{ width: '32%' }}>Entity</th><th>Purpose</th></tr></thead>
            <tbody>
              {ENTITIES.map(([e, d]) => (
                <tr key={e}><td><strong>{e}</strong></td><td className="small">{d}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Security & access control">
        <ul>
          <li><strong>Authentication:</strong> JWT tokens (8-hour expiry), bcrypt-hashed passwords, password reset via one-time emailed codes.</li>
          <li><strong>RBAC:</strong> role checks enforced centrally; Developer and Program Administrator are supersets of the elevated admin permissions, so access is consistent across every route.</li>
          <li><strong>Brute-force protection:</strong> rate limiting on all auth endpoints (10 attempts / 15 min) and a lockout after 5 wrong reset-code guesses.</li>
          <li><strong>Hardening:</strong> Helmet headers, a CORS allowlist, no hardcoded credentials, and CSV-only roster upload to avoid vulnerable spreadsheet parsers.</li>
          <li><strong>Accountability:</strong> the Audit Log (developer-only) records every sensitive action, including all role changes.</li>
        </ul>
      </Section>

      <Section title="Deployment">
        <p>
          The backend and frontend are built as Docker images and deployed on Railway across two
          environments &mdash; <strong>development</strong> and <strong>production</strong> &mdash;
          each backed by its own MySQL database. Schema updates and reference data are provisioned
          automatically on startup, and configuration (database, JWT secret, API URL, notification
          credentials) is supplied through environment variables.
        </p>
      </Section>

      <p className="text-center text-muted small mt-4">
        {APP_NAME} v{APP_VERSION} &middot; &copy; {APP_YEAR} {APP_AUTHOR}
      </p>
    </div>
  );
}
