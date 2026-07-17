const { Site, Department, SiteDepartment } = require('../models');

exports.listSites = async (req, res) => {
  const sites = await Site.findAll({ include: [Department] });
  res.json(sites);
};

exports.listDepartments = async (req, res) => {
  const departments = await Department.findAll();
  res.json(departments);
};

exports.listSiteDepartments = async (req, res) => {
  const rows = await SiteDepartment.findAll({ include: [Site, Department] });
  res.json(rows);
};
