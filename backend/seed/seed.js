require('dotenv').config();
const bcrypt = require('bcryptjs');
const {
  sequelize, Role, User, Site, Department, SiteDepartment,
  Block, RotationAssignment, RotationWeek, ChangeRequest, Notification, AuditLog,
} = require('../models');
const { SITES, DEPARTMENTS, SITE_DEPARTMENTS } = require('./data');
const { paletteFor } = require('./colors');
const { BLOCK_DEFS } = require('./blockDefs');

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

  // ---------- Blocks (1-13), Sept 2026 - Aug 2027 curriculum cycle ----------
  // Exact dates from the approved rotation schedule: Block 1 starts Sept 1,
  // 2026; Block 2 starts Sept 27, 2026; each block is a 4-week cycle except
  // Block 13, which is the 5-week exception. See ./blockDefs.js.
  const blocks = [];
  for (const def of BLOCK_DEFS) {
    const publishLeadDays = def.n % 4 === 0 ? 2 : 14;
    const startDateObj = new Date(def.start);
    const publishedAt = new Date(startDateObj);
    publishedAt.setDate(publishedAt.getDate() - publishLeadDays);

    const block = await Block.create({
      block_number: def.n,
      name: `Block ${def.n}`,
      start_date: def.start,
      end_date: def.end,
      total_weeks: def.weeks,
      published_at: publishedAt,
    });
    blocks.push(block);
  }
  console.log('Blocks created: 13 (Sept 2026 - Aug 2027 curriculum cycle)');

  // ---------- Rotation assignments / weeks / change requests ----------
  // Intentionally NOT seeded. Real rotation schedules should be created by
  // the Master Scheduler through the app (Schedules -> + Add Schedule) once
  // the reference data above (roles, sites, departments, users, curriculum
  // blocks) is in place. This keeps the Schedules page free of fake demo
  // assignments in every environment that runs this seed script.

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
