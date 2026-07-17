require('dotenv').config();
const bcrypt = require('bcryptjs');
const {
  sequelize, Role, User, Site, Department, SiteDepartment,
  Block, RotationAssignment, RotationWeek, ChangeRequest, Notification, AuditLog,
} = require('../models');
const { SITES, DEPARTMENTS, SITE_DEPARTMENTS } = require('./data');
const { paletteFor } = require('./colors');

const DEFAULT_PASSWORD = 'Passw0rd!'; // demo only - change in production

async function run() {
  console.log('Resetting schema (sync force) ...');
  await sequelize.sync({ force: true });

  // ---------- Roles ----------
  const roleDefs = [
    { key: 'admin', label: 'Hospital Administrator' },
    { key: 'scheduler', label: 'Master Scheduler' },
    { key: 'dept_head', label: 'Department Head' },
    { key: 'physician', label: 'Physician' },
  ];
  const roles = {};
  for (const r of roleDefs) roles[r.key] = await Role.create(r);
  console.log('Roles created');

  // ---------- Sites ----------
  const siteColors = paletteFor(SITES.length, { saturation: 70, lightness: 45 });
  const sites = {};
  for (let i = 0; i < SITES.length; i++) {
    sites[SITES[i].short_code] = await Site.create({ ...SITES[i], color_hex: siteColors[i] });
  }
  console.log('Sites created:', Object.keys(sites).length);

  // ---------- Departments ----------
  const deptColors = paletteFor(DEPARTMENTS.length, { saturation: 60, lightness: 55 });
  const departments = {};
  for (let i = 0; i < DEPARTMENTS.length; i++) {
    const d = DEPARTMENTS[i];
    departments[d.code] = await Department.create({
      code: d.code,
      name: d.name,
      color_hex: deptColors[i],
      is_critical_unit: !!d.critical,
    });
  }
  console.log('Departments created:', Object.keys(departments).length);

  // ---------- Site <-> Department (capacity per block) ----------
  const siteDepartments = {}; // key: `${siteCode}::${deptCode}` -> row
  for (const [siteCode, deptCodes] of Object.entries(SITE_DEPARTMENTS)) {
    for (const deptCode of deptCodes) {
      const sd = await SiteDepartment.create({
        site_id: sites[siteCode].id,
        department_id: departments[deptCode].id,
        capacity_per_block: 2 + Math.floor(Math.random() * 2), // 2-3 slots
      });
      siteDepartments[`${siteCode}::${deptCode}`] = sd;
    }
  }
  console.log('Site-Department links created:', Object.keys(siteDepartments).length);

  // ---------- Users ----------
  const password_hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  const admin = await User.create({
    full_name: 'Dr. Amina Al-Balushi', email: 'admin@obgyn-rotation.local', phone: '+96890000001',
    password_hash, role_id: roles.admin.id, language_pref: 'en',
  });

  const scheduler1 = await User.create({
    full_name: 'Yusuf Al-Rawahi', email: 'scheduler1@obgyn-rotation.local', phone: '+96890000002',
    password_hash, role_id: roles.scheduler.id, language_pref: 'en',
  });
  const scheduler2 = await User.create({
    full_name: 'Maha Al-Habsi', email: 'scheduler2@obgyn-rotation.local', phone: '+96890000003',
    password_hash, role_id: roles.scheduler.id, language_pref: 'ar',
  });

  // Department heads for a representative subset of departments
  const deptHeadCodes = ['GOBG, HRP & MFM', 'GY-ONC', 'URGY', 'MM & HRP', 'REI, INF & MIS', 'DS'];
  const deptHeads = {};
  for (const code of deptHeadCodes) {
    const dept = departments[code];
    const name = `Dr. Head-${code.replace(/[^A-Za-z]/g, '').slice(0, 6)}`;
    deptHeads[code] = await User.create({
      full_name: name,
      email: `depthead.${dept.id}@obgyn-rotation.local`,
      phone: `+9689000${1000 + dept.id}`,
      password_hash,
      role_id: roles.dept_head.id,
      home_department_id: dept.id,
      language_pref: 'en',
    });
  }

  // Physicians spread across sites/departments
  const physicianFirstNames = ['Layla', 'Salim', 'Fatma', 'Ahmed', 'Noura', 'Hamed', 'Aisha', 'Khalid', 'Zainab', 'Said', 'Mariam', 'Talal'];
  const siteCodesList = Object.keys(sites);
  const physicians = [];
  for (let i = 0; i < physicianFirstNames.length; i++) {
    const siteCode = siteCodesList[i % siteCodesList.length];
    const deptCodesAtSite = SITE_DEPARTMENTS[siteCode];
    const deptCode = deptCodesAtSite[i % deptCodesAtSite.length];
    const phy = await User.create({
      full_name: `Dr. ${physicianFirstNames[i]}`,
      email: `physician${i + 1}@obgyn-rotation.local`,
      phone: `+9689010${1000 + i}`,
      password_hash,
      role_id: roles.physician.id,
      home_site_id: sites[siteCode].id,
      home_department_id: departments[deptCode].id,
      language_pref: i % 5 === 0 ? 'ar' : 'en',
    });
    physicians.push({ user: phy, homeSiteCode: siteCode, homeDeptCode: deptCode });
  }
  console.log('Users created:', physicians.length + deptHeadCodes.length + 3);

  // ---------- Blocks (1-13), 4 weeks each, sequential from 2026-01-05 ----------
  const blockStart0 = new Date('2026-01-05'); // Monday
  const blocks = [];
  for (let n = 1; n <= 13; n++) {
    const start = new Date(blockStart0);
    start.setDate(start.getDate() + (n - 1) * 28);
    const end = new Date(start);
    end.setDate(end.getDate() + 27);
    // Publication timeliness varies: most published 14 days ahead, a couple late (only 2 days ahead)
    const publishLeadDays = n % 4 === 0 ? 2 : 14;
    const publishedAt = new Date(start);
    publishedAt.setDate(publishedAt.getDate() - publishLeadDays);

    const block = await Block.create({
      block_number: n,
      name: `Block ${n}`,
      start_date: start.toISOString().slice(0, 10),
      end_date: end.toISOString().slice(0, 10),
      total_weeks: 4,
      published_at: publishedAt,
    });
    blocks.push(block);
  }
  console.log('Blocks created: 13');

  // ---------- Rotation assignments + weeks for Blocks 1-3 (demo window) ----------
  const weekStatusScenarios = [
    ['attended', 'attended', 'attended', 'attended'],      // fully completed
    ['attended', 'attended', 'attended', 'pending'],       // in progress, will complete
    ['attended', 'maternity_leave', 'attended', 'attended'],// completed despite 1 leave week (3 attended)
    ['attended', 'maternity_leave', 'maternity_leave', 'attended'], // incomplete: only 2 attended
    ['attended', 'annual_leave', 'attended', 'pending'],   // in progress
    ['absent', 'attended', 'attended', 'attended'],        // completed (3 attended)
  ];

  let scenarioIdx = 0;
  for (const block of blocks.slice(0, 3)) {
    for (let i = 0; i < physicians.length; i++) {
      const { user, homeSiteCode, homeDeptCode } = physicians[i];
      // Rotate each physician through a different department at their home site each block
      const deptOptions = SITE_DEPARTMENTS[homeSiteCode];
      const deptCode = deptOptions[(i + block.block_number) % deptOptions.length];
      const sd = siteDepartments[`${homeSiteCode}::${deptCode}`];
      if (!sd) continue;

      const assignment = await RotationAssignment.create({
        physician_id: user.id,
        site_department_id: sd.id,
        block_id: block.id,
        start_date: block.start_date,
        end_date: block.end_date,
        status: 'scheduled',
      });

      const scenario = weekStatusScenarios[scenarioIdx % weekStatusScenarios.length];
      scenarioIdx++;
      const start = new Date(block.start_date);
      for (let w = 0; w < 4; w++) {
        const weekStart = new Date(start);
        weekStart.setDate(weekStart.getDate() + w * 7);
        await RotationWeek.create({
          rotation_assignment_id: assignment.id,
          week_number: w + 1,
          week_start_date: weekStart.toISOString().slice(0, 10),
          status: scenario[w],
        });
      }
      const attended = scenario.filter((s) => s === 'attended').length;
      const anyPending = scenario.includes('pending');
      assignment.status = anyPending && attended < 3 ? 'in_progress' : (attended >= 3 ? 'completed' : 'incomplete');
      await assignment.save();
    }
  }
  console.log('Rotation assignments + weeks created for Blocks 1-3');

  // ---------- Deliberate scheduling conflict for KPI demo ----------
  // Physician #0 double-booked at two different site-departments with overlapping dates in Block 1.
  const conflictPhysician = physicians[0].user;
  const altSiteCode = siteCodesList[1];
  const altDeptCode = SITE_DEPARTMENTS[altSiteCode][0];
  const altSd = siteDepartments[`${altSiteCode}::${altDeptCode}`];
  if (altSd) {
    const b1 = blocks[0];
    await RotationAssignment.create({
      physician_id: conflictPhysician.id,
      site_department_id: altSd.id,
      block_id: b1.id,
      start_date: b1.start_date,
      end_date: b1.end_date,
      status: 'scheduled',
    });
    console.log('Deliberate overlap conflict seeded for KPI demo');
  }

  // ---------- Change requests ----------
  const someAssignments = await RotationAssignment.findAll({ limit: 5 });
  for (let i = 0; i < someAssignments.length; i++) {
    const a = someAssignments[i];
    const requestedAt = new Date();
    requestedAt.setDate(requestedAt.getDate() - (5 - i));
    const isResolved = i < 3;
    const resolvedAt = isResolved ? new Date(requestedAt.getTime() + (4 + i) * 60 * 60 * 1000) : null;
    await ChangeRequest.create({
      rotation_assignment_id: a.id,
      requested_by_id: physicians[i % physicians.length].user.id,
      reason: 'Requesting swap due to personal scheduling conflict.',
      status: isResolved ? 'approved' : 'pending',
      requested_at: requestedAt,
      resolved_by_id: isResolved ? admin.id : null,
      resolved_at: resolvedAt,
    });
  }
  console.log('Sample change requests created');

  // ---------- Notifications ----------
  for (let i = 0; i < 8; i++) {
    const phy = physicians[i % physicians.length].user;
    await Notification.create({
      user_id: phy.id,
      channel: i % 3 === 0 ? 'sms' : i % 3 === 1 ? 'email' : 'system',
      title: 'Upcoming Rotation Change',
      message: `Reminder: your rotation block changes soon. Please review your schedule.`,
      status: 'mock_sent',
      sent_at: new Date(),
    });
  }
  console.log('Sample notifications created');

  // ---------- Audit log seed entries ----------
  await AuditLog.create({ user_id: admin.id, action: 'login', entity_type: 'auth', details: { note: 'seed bootstrap' } });

  console.log('\nSeed complete.');
  console.log(`Demo login (all roles use password: ${DEFAULT_PASSWORD}):`);
  console.log(`  Admin:       ${admin.email}`);
  console.log(`  Scheduler:   ${scheduler1.email}`);
  console.log(`  Dept Head:   depthead.<id>@obgyn-rotation.local (see DB)`);
  console.log(`  Physician:   ${physicians[0].user.email}`);

  await sequelize.close();
}

run().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
