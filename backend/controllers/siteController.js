const {
  sequelize, Site, Department, SiteDepartment, RotationAssignment, RotationWeek, ChangeRequest,
} = require('../models');
const { DEPARTMENTS, SITE_DEPARTMENTS } = require('../seed/data');
const { paletteFor } = require('../seed/colors');

exports.listSites = async (req, res) => {
  const sites = await Site.findAll({ include: [Department] });
  res.json(sites);
};

/**
 * List departments. Public (no auth) since the pre-login Registration form
 * needs this. Optionally filtered to just the departments actually offered
 * at one site via ?siteId=, so Register.js can make its Department dropdown
 * depend on the chosen Site without needing the authenticated
 * /sites/site-departments endpoint (which also exposes capacity numbers that
 * stay behind login).
 */
exports.listDepartments = async (req, res) => {
  const { siteId } = req.query;
  if (siteId) {
    const links = await SiteDepartment.findAll({ where: { site_id: siteId }, include: [Department] });
    return res.json(links.map((l) => l.Department));
  }
  const departments = await Department.findAll();
  res.json(departments);
};

exports.listSiteDepartments = async (req, res) => {
  const rows = await SiteDepartment.findAll({ include: [Site, Department] });
  res.json(rows);
};

/**
 * Admin-only maintenance action: rename a department's display name by its
 * unchanging `code` (e.g. 'CLINIC'), without touching the code itself or any
 * SiteDepartment links that reference it. Lets a department name be
 * corrected on the live database without a destructive full reseed.
 */
exports.renameDepartment = async (req, res) => {
  try {
    const { code, name } = req.body;
    if (!code || !name) return res.status(400).json({ error: 'code and name are required' });

    const dept = await Department.findOne({ where: { code } });
    if (!dept) return res.status(404).json({ error: `No department found with code '${code}'` });

    const previousName = dept.name;
    dept.name = name;
    await dept.save();

    res.json({ message: 'Department renamed', code, previousName, newName: dept.name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to rename department', details: err.message });
  }
};

/**
 * One-time / repeatable maintenance action: brings the live Department and
 * SiteDepartment tables up to date with backend/seed/data.js (rebuilt from
 * the authoritative "Site and Department" guideline document) WITHOUT
 * touching Users, Sites, or Blocks and without a destructive full reseed.
 *
 * Steps:
 *   1. Delete anything that references a SiteDepartment row (rotation weeks,
 *      change requests, rotation assignments) since every SiteDepartment
 *      link is being rebuilt from scratch. Safe today because there are no
 *      live schedules yet, but written defensively in case that changes.
 *   2. Delete all existing SiteDepartment rows.
 *   3. Delete Department rows whose code is no longer in DEPARTMENTS (the
 *      old/obsolete codes this doc superseded).
 *   4. Upsert every department in DEPARTMENTS (create if missing, otherwise
 *      refresh name + is_critical_unit; existing color_hex is left alone so
 *      previously-assigned colors don't shuffle on repeat runs, new ones get
 *      a color assigned from the palette).
 *   5. Recreate SiteDepartment rows per SITE_DEPARTMENTS.
 * Idempotent -- safe to call more than once.
 */
exports.syncDepartments = async (req, res) => {
  try {
    const existingSiteDepts = await SiteDepartment.findAll({ attributes: ['id'] });
    const existingSiteDeptIds = existingSiteDepts.map((sd) => sd.id);

    if (existingSiteDeptIds.length > 0) {
      const orphanedAssignments = await RotationAssignment.findAll({
        where: { site_department_id: existingSiteDeptIds },
        attributes: ['id'],
      });
      const orphanedAssignmentIds = orphanedAssignments.map((a) => a.id);
      if (orphanedAssignmentIds.length > 0) {
        await RotationWeek.destroy({ where: { rotation_assignment_id: orphanedAssignmentIds } });
        await ChangeRequest.destroy({ where: { rotation_assignment_id: orphanedAssignmentIds } });
        await RotationAssignment.destroy({ where: { id: orphanedAssignmentIds } });
      }
    }
    await SiteDepartment.destroy({ where: {} });

    const keptCodes = DEPARTMENTS.map((d) => d.code);
    const allExistingDepts = await Department.findAll();
    const obsoleteDepts = allExistingDepts.filter((d) => !keptCodes.includes(d.code));
    const removedCodes = obsoleteDepts.map((d) => d.code);
    if (obsoleteDepts.length > 0) {
      await Department.destroy({ where: { id: obsoleteDepts.map((d) => d.id) } });
    }

    const deptColors = paletteFor(DEPARTMENTS.length, { saturation: 60, lightness: 55 });
    const departments = {};
    const createdCodes = [];
    for (let i = 0; i < DEPARTMENTS.length; i++) {
      const d = DEPARTMENTS[i];
      const [dept, created] = await Department.findOrCreate({
        where: { code: d.code },
        defaults: { name: d.name, color_hex: deptColors[i], is_critical_unit: !!d.critical },
      });
      if (!created) {
        dept.name = d.name;
        dept.is_critical_unit = !!d.critical;
        await dept.save();
      } else {
        createdCodes.push(d.code);
      }
      departments[d.code] = dept;
    }

    const sites = await Site.findAll();
    const siteByCode = {};
    for (const s of sites) siteByCode[s.short_code] = s;

    let linkCount = 0;
    const missingSites = [];
    for (const [siteCode, deptCodes] of Object.entries(SITE_DEPARTMENTS)) {
      const site = siteByCode[siteCode];
      if (!site) { missingSites.push(siteCode); continue; }
      for (const deptCode of deptCodes) {
        await SiteDepartment.create({
          site_id: site.id,
          department_id: departments[deptCode].id,
          capacity_per_block: 2,
        });
        linkCount++;
      }
    }

    res.json({
      message: 'Departments and site-department links synced to the authoritative Site and Department guideline',
      departmentsTotal: DEPARTMENTS.length,
      departmentsCreated: createdCodes,
      departmentsRemoved: removedCodes,
      siteDepartmentLinksCreated: linkCount,
      missingSites,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to sync departments', details: err.message });
  }
};
