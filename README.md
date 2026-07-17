# OBGYN Master Rotation Management System

A locally-run, role-based web app for scheduling and monitoring resident/physician
rotations across multiple hospital sites and departments, built to the uploaded
"Web-Based Hospital Rotation Management System (Local Deployment Guide)" spec and the
OBGYN Master Rotation KPI/curriculum requirements.

Stack: **Node.js/Express + Sequelize + MySQL** backend, **React** frontend, JWT auth,
role-based dashboards (Chart.js), English/Arabic i18n, mock-mode SMS/email notifications,
and full audit logging.

This backend has been functionally verified end-to-end in a test environment (seed
script, login, RBAC, all 16 KPI calculations, and week-status attendance updates all
confirmed working against a live running instance). The frontend has been verified with
a full module-resolution bundle check (every import/export across the app resolves
correctly). You will still need to `npm install` on your own machine — see below.

## 1. Prerequisites

- Node.js v18+
- MySQL 8.x (or use the provided `docker-compose.yml`)
- npm

## 2. Quick start with Docker (recommended)

```bash
docker-compose up --build
```

This starts MySQL, the backend on `http://localhost:5000`, and the frontend on
`http://localhost:3000`. Then seed the database once:

```bash
docker-compose exec backend npm run seed
```

## 3. Manual local setup

### Database

```sql
CREATE DATABASE hospital_rotation_db;
```

### Backend

```bash
cd backend
cp .env.example .env      # edit DB credentials / JWT secret as needed
npm install
npm run seed               # creates roles, sites, departments, demo users & rotations
npm run dev                 # http://localhost:5000
```

### Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm start                   # http://localhost:3000
```

## 4. Demo logins (after `npm run seed`)

All demo accounts use the password `Passw0rd!`.

| Role | Email |
|---|---|
| Hospital Administrator | admin@obgyn-rotation.local |
| Master Scheduler | scheduler1@obgyn-rotation.local |
| Physician | physician1@obgyn-rotation.local ... physician12@obgyn-rotation.local |
| Department Head | depthead.<department_id>@obgyn-rotation.local (see seed console output or `SELECT` from `users`) |

## 5. What's implemented

- **Auth**: JWT login/registration, bcrypt password hashing, role stored in the token.
- **RBAC**: middleware restricts API routes per role (`admin`, `scheduler`, `dept_head`, `physician`).
- **Rotation scheduling**: assignments span a 4-week curriculum block; each week has its
  own attendance status (`attended`, `maternity_leave`, `annual_leave`, `absent`, `pending`).
  A rotation is only "completed" once ≥3 of 4 weeks are `attended` — leave weeks never count
  (see `KPI_FORMULAS.md` for the full rule and every KPI formula).
- **Sites & departments**: seeded from the uploaded site list and department code table,
  each with a deterministically-generated, stable color for dashboard color coding.
- **KPI dashboards**: all 16 KPIs from the spec, role-filtered (Hospital Administrator,
  Master Scheduler, Department Head, Physician dashboards), rendered with Chart.js.
- **Notifications**: mock mode by default (logs + DB row, no external account needed);
  set `NOTIFY_MODE=live` and add Twilio/SendGrid credentials in `.env` to send real
  SMS/email. A daily cron job sends "upcoming rotation" reminders 3–5 days ahead.
- **Audit logging**: every schedule view/create/edit/approve is recorded and viewable
  by admins at `/audit-log`.
- **Change requests**: physicians/schedulers can file a change request against an
  assignment; admins/dept heads approve or reject, feeding Change Request Rate and
  Approval Turnaround Time.
- **Localization**: English/Arabic toggle in the navbar (RTL-aware).

## 6. Folder structure

```
hospital-rotation/
├── backend/
│   ├── config/          # Sequelize/MySQL connection
│   ├── models/           # Sequelize models + associations
│   ├── controllers/      # request handlers
│   ├── routes/           # Express routers
│   ├── middleware/        # JWT auth, RBAC, audit logging
│   ├── services/          # KPI calculations, notification service
│   ├── seed/               # reference data + seed script
│   └── server.js
├── frontend/
│   └── src/
│       ├── api/            # axios instance with auth interceptor
│       ├── context/         # AuthContext
│       ├── components/       # Navbar, KpiCard, RoleBasedRoute
│       ├── pages/             # Login, Register, Dashboards, ScheduleViewer, etc.
│       ├── i18n/                # en/ar translations
│       └── utils/                # color-coding hook
├── KPI_FORMULAS.md
└── docker-compose.yml
```

## 7. Notes & next steps

- The seed script uses `sequelize.sync({ force: true })` for convenience — for a real
  deployment, switch to `sequelize-cli` migrations so schema changes don't drop data.
- `NOTIFY_MODE=mock` is the default; every notification is still persisted to the
  `notifications` table so the Notification Success Rate KPI and Notifications Center
  work immediately without Twilio/SendGrid accounts.
- Department heads are currently seeded for 6 representative departments (not all 23);
  add more via `POST /api/register` with `roleKey: "dept_head"` as needed.
- Add HTTPS (self-signed cert locally) and rotate `JWT_SECRET` before using this beyond
  a local/demo environment, per the spec's Security & Compliance section.
