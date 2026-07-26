/**
 * Standalone API smoke test -- no test framework needed. Hits a running API
 * and checks the critical paths (health, auth, reference data, KPIs, and the
 * weekly-status propose/approve workflow), printing PASS/FAIL per check and a
 * final summary with a non-zero exit code on any failure.
 *
 * Usage:
 *   node scripts/smoke-test.js [baseUrl]
 * Examples:
 *   node scripts/smoke-test.js                      # defaults to the dev API
 *   node scripts/smoke-test.js https://master-rotation.up.railway.app/api
 *
 * Credentials can be overridden via env: DEV_EMAIL / DEV_PASSWORD.
 */
const BASE = (process.argv[2] || 'https://hospital-rotation-development.up.railway.app/api').replace(/\/$/, '');
const DEV_EMAIL = process.env.DEV_EMAIL || 'ruvpalado@gmail.com';
const DEV_PASSWORD = process.env.DEV_PASSWORD || 'DevAccess#2026!';

let passed = 0;
let failed = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  ok ? passed++ : failed++;
}

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, json };
}

async function run() {
  console.log(`Smoke testing: ${BASE}\n`);

  const health = await api('/health');
  check('GET /health returns ok', health.status === 200 && health.json?.status === 'ok');

  const login = await api('/login', { method: 'POST', body: { email: DEV_EMAIL, password: DEV_PASSWORD } });
  const token = login.json?.token;
  check('POST /login (developer) returns a token', login.status === 200 && !!token);
  if (!token) return finish();

  for (const ep of ['/sites', '/departments', '/blocks', '/kpis/overview', '/users']) {
    const r = await api(ep, { token });
    check(`GET ${ep} authorized`, r.status === 200);
  }

  // Weekly-status workflow: create -> physician proposes -> admin approves.
  const physicians = (await api('/users?role=physician', { token })).json || [];
  const sd = (await api('/sites/site-departments', { token })).json?.[0];
  const block = (await api('/blocks', { token })).json?.[0];
  if (physicians.length && sd && block) {
    const p = physicians[0];
    const created = await api('/schedules', {
      method: 'POST', token,
      body: { physicianId: p.id, physicianName: p.fullName, siteDepartmentId: sd.id, blockId: block.id, startDate: block.start_date, endDate: block.end_date },
    });
    const week = created.json?.weeks?.[0];
    // 201 or 409 (already has this block) are both acceptable for the smoke run.
    check('POST /schedules creates or reports duplicate', created.status === 201 || created.status === 409, `status ${created.status}`);

    if (week) {
      const login2 = await api('/login', { method: 'POST', body: { email: p.email, password: 'Passw0rd!' } });
      const ptoken = login2.json?.token;
      if (ptoken) {
        const prop = await api(`/schedules/weeks/${week.id}/propose`, { method: 'PATCH', token: ptoken, body: { status: 'attended' } });
        check('Physician can propose a week status', prop.status === 200 && prop.json?.week?.proposed_status === 'attended');
        const appr = await api(`/schedules/weeks/${week.id}/approve`, { method: 'POST', token, body: { approve: true } });
        check('Admin can approve, official status updates', appr.status === 200 && appr.json?.week?.status === 'attended' && appr.json?.week?.proposed_status === null);
        check('Approval records approver id', !!appr.json?.week?.approved_by_id);
      } else {
        check('Physician login for workflow', false, 'could not log in as physician (seed password?)');
      }
    }
  } else {
    check('Workflow prerequisites (physician/site/block) present', false, 'reference data missing');
  }

  finish();
}

function finish() {
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => { console.error('Smoke test crashed:', err.message); process.exit(1); });
