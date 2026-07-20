const { Site, Department, SiteDepartment } = require('../models');

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
