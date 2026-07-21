const { Op } = require('sequelize');
const {
  User, Role, Site, Department, SiteDepartment, Block,
  RotationAssignment, RotationWeek, ChangeRequest, Notification, AuditLog,
} = require('../models');
const { isRotationComplete, countAttendedWeeks } = require('../utils/rotationRules');

const TOTAL_CURRICULUM_BLOCKS = 13;

let _physicianRoleId = null;
/** Resolve and cache the 'physician' Role id so KPI denominators never
 * accidentally include admins/schedulers/dept heads. */
async function getPhysicianRoleId() {
  if (_physicianRoleId) return _physicianRoleId;
  const role = await Role.findOne({ where: { key: 'physician' } });
  _physicianRoleId = role ? role.id : -1;
  return _physicianRoleId;
}
/** siteId, when provided, scopes the physician count/list to physicians
 * whose home_site_id matches -- used by the Hospital Administrator role so
 * its KPIs only reflect physicians based at that one hospital. */
async function countPhysicians(siteId) {
  const where = { role_id: await getPhysicianRoleId() };
  if (siteId) where.home_site_id = siteId;
  return User.count({ where });
}
async function listPhysicians(siteId) {
  const where = { role_id: await getPhysicianRoleId() };
  if (siteId) where.home_site_id = siteId;
  return User.findAll({ where });
}

function stdev(values) {
  if (values.length === 0) return 0;
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}
function mean(values) {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

async function getAssignmentsWithWeeks(where = {}) {
  return RotationAssignment.findAll({
    where,
    include: [
      { model: RotationWeek, as: 'weeks' },
      { model: Block },
      {
        model: SiteDepartment,
        include: [Site, Department],
      },
      { model: User, as: 'physician' },
    ],
  });
}

/** Filters an already-fetched assignment list (each row includes
 * SiteDepartment -> Site via getAssignmentsWithWeeks) down to one site, when
 * siteId is provided. Shared by every KPI that needs Hospital Administrator
 * site-scoping but otherwise queries hospital-wide. */
function filterBySite(assignments, siteId) {
  if (!siteId) return assignments;
  return assignments.filter((a) => a.SiteDepartment.Site.id === Number(siteId));
}

/** 1. Rotation Coverage Rate = physicians with >=1 active assignment in block / total physicians * 100
 * siteId (optional) scopes both the physician denominator and the
 * assignments considered to one hospital site, for the Hospital
 * Administrator role. */
async function rotationCoverageRate(blockId, siteId) {
  const physicianCountTotal = await countPhysicians(siteId);
  const assignments = filterBySite(
    await getAssignmentsWithWeeks(blockId ? { block_id: blockId } : {}),
    siteId
  );
  // Free-typed physician names with no matching account (physician_id null)
  // aren't tied to a real physician, so they can't count toward "physicians
  // covered" -- exclude them from the distinct count.
  const distinctPhysicians = new Set(assignments.filter((a) => a.physician_id != null).map((a) => a.physician_id));
  const rate = physicianCountTotal > 0 ? (distinctPhysicians.size / physicianCountTotal) * 100 : 0;
  return { assignedPhysicians: distinctPhysicians.size, totalPhysicians: physicianCountTotal, ratePct: round(rate) };
}

/** 2. Department Allocation Balance = 1 - (stdev(counts)/mean(counts)) expressed as % (100% = perfectly balanced) */
async function departmentAllocationBalance(blockId) {
  const assignments = await getAssignmentsWithWeeks(blockId ? { block_id: blockId } : {});
  const countsByDept = {};
  assignments.forEach((a) => {
    const deptCode = a.SiteDepartment.Department.code;
    countsByDept[deptCode] = (countsByDept[deptCode] || 0) + 1;
  });
  const counts = Object.values(countsByDept);
  const m = mean(counts);
  const sd = stdev(counts);
  const cv = m > 0 ? sd / m : 0;
  const balancePct = round(Math.max(0, 1 - cv) * 100);
  return { countsByDept, balancePct };
}

/** 3. Site Utilization = number of rotations assigned per site */
async function siteUtilization(blockId) {
  const assignments = await getAssignmentsWithWeeks(blockId ? { block_id: blockId } : {});
  const countsBySite = {};
  assignments.forEach((a) => {
    const siteCode = a.SiteDepartment.Site.short_code;
    countsBySite[siteCode] = (countsBySite[siteCode] || 0) + 1;
  });
  return countsBySite;
}

/** 4. Curriculum Compliance = completed block-assignments / expected (physicians * 13 blocks) * 100
 * siteId (optional) scopes to one hospital's physicians/assignments. */
async function curriculumCompliance(siteId) {
  const physicians = await countPhysicians(siteId);
  const expected = physicians * TOTAL_CURRICULUM_BLOCKS;
  const assignments = filterBySite(await getAssignmentsWithWeeks(), siteId);
  const completed = assignments.filter((a) => isRotationComplete(a.weeks)).length;
  const pct = expected > 0 ? round((completed / expected) * 100) : 0;
  return { completed, expected, pct };
}

/** 5. Rotation Block Completion = completed assignments in block / total assignments in block * 100 */
async function rotationBlockCompletion(blockId) {
  const assignments = await getAssignmentsWithWeeks(blockId ? { block_id: blockId } : {});
  const completed = assignments.filter((a) => isRotationComplete(a.weeks)).length;
  const pct = assignments.length > 0 ? round((completed / assignments.length) * 100) : 0;
  return { completed, total: assignments.length, pct };
}

/** 6. Conflict-Free Scheduling = count of overlapping-date assignments for the same physician
 * siteId (optional) scopes conflicts to assignments at one hospital site. */
async function conflictCount(blockId, siteId) {
  const assignments = filterBySite(
    await getAssignmentsWithWeeks(blockId ? { block_id: blockId } : {}),
    siteId
  );
  const byPhysician = {};
  assignments.forEach((a) => {
    // Free-typed names with no matching account (physician_id null) can't be
    // reliably grouped -- two different unlinked names would otherwise both
    // land in a shared "null" bucket and look like the same person.
    if (a.physician_id == null) return;
    byPhysician[a.physician_id] = byPhysician[a.physician_id] || [];
    byPhysician[a.physician_id].push(a);
  });
  let conflicts = 0;
  const conflictDetails = [];
  Object.entries(byPhysician).forEach(([physId, list]) => {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        const overlap = a.start_date <= b.end_date && b.start_date <= a.end_date;
        if (overlap) {
          conflicts++;
          conflictDetails.push({ physicianId: physId, a: a.id, b: b.id });
        }
      }
    }
  });
  return { conflicts, conflictDetails };
}

/** 7. Individual Rotation Completion = completed blocks / 13 * 100 (per physician) */
async function individualRotationCompletion(physicianId) {
  const assignments = await getAssignmentsWithWeeks({ physician_id: physicianId });
  const completed = assignments.filter((a) => isRotationComplete(a.weeks)).length;
  const pct = round((completed / TOTAL_CURRICULUM_BLOCKS) * 100);
  return { completed, totalRequired: TOTAL_CURRICULUM_BLOCKS, pct };
}

/** 8. Specialty Exposure = distinct departments rotated / total departments offered * 100 */
async function specialtyExposure(physicianId) {
  const totalDepartments = await Department.count();
  const assignments = await getAssignmentsWithWeeks({ physician_id: physicianId });
  const distinctDepts = new Set(assignments.map((a) => a.SiteDepartment.Department.id));
  const pct = totalDepartments > 0 ? round((distinctDepts.size / totalDepartments) * 100) : 0;
  return { distinctDepartments: distinctDepts.size, totalDepartments, pct };
}

/** 9. Rotation Equity = 1 - coefficient of variation of completed-rotation counts across physicians, as % */
async function rotationEquity() {
  const physicians = await listPhysicians();
  const assignments = await getAssignmentsWithWeeks();
  const completedByPhysician = {};
  assignments.forEach((a) => {
    if (isRotationComplete(a.weeks)) {
      completedByPhysician[a.physician_id] = (completedByPhysician[a.physician_id] || 0) + 1;
    }
  });
  const counts = physicians.map((p) => completedByPhysician[p.id] || 0);
  const m = mean(counts);
  const sd = stdev(counts);
  const cv = m > 0 ? sd / m : 0;
  const equityPct = round(Math.max(0, 1 - cv) * 100);
  return { counts, equityPct };
}

/** 10. Department Capacity Utilization = filled slots / capacity per block * 100
 * siteId (optional) restricts to one hospital's site-department slots. */
async function departmentCapacityUtilization(blockId, siteId) {
  const siteDepartments = await SiteDepartment.findAll({
    where: siteId ? { site_id: siteId } : {},
    include: [Site, Department],
  });
  const results = [];
  for (const sd of siteDepartments) {
    const filled = await RotationAssignment.count({
      where: { site_department_id: sd.id, ...(blockId ? { block_id: blockId } : {}) },
    });
    const pct = sd.capacity_per_block > 0 ? round((filled / sd.capacity_per_block) * 100) : 0;
    results.push({
      site: sd.Site.short_code,
      department: sd.Department.code,
      filled,
      capacity: sd.capacity_per_block,
      pct,
    });
  }
  return results;
}

/** 11. Site Rotation Compliance = required department rotations covered at site / required * 100
 * siteId (optional) restricts the result to just that one site's row. */
async function siteRotationCompliance(blockId, siteId) {
  const sites = await Site.findAll({ where: siteId ? { id: siteId } : {}, include: [Department] });
  const results = [];
  for (const site of sites) {
    const required = site.Departments.length;
    let covered = 0;
    for (const dept of site.Departments) {
      const sd = await SiteDepartment.findOne({ where: { site_id: site.id, department_id: dept.id } });
      if (!sd) continue;
      const count = await RotationAssignment.count({
        where: { site_department_id: sd.id, ...(blockId ? { block_id: blockId } : {}) },
      });
      if (count > 0) covered++;
    }
    results.push({ site: site.short_code, covered, required, pct: required > 0 ? round((covered / required) * 100) : 0 });
  }
  return results;
}

/** 12. Critical Unit Coverage = % of blocks where NICU/ICU/EM/Research depts have >=1 assignment
 * siteId (optional) restricts to one hospital's critical-unit slots. */
async function criticalUnitCoverage(siteId) {
  const criticalDepts = await Department.findAll({ where: { is_critical_unit: true } });
  const blocks = await Block.findAll();
  const results = [];
  for (const dept of criticalDepts) {
    const sdWhere = { department_id: dept.id };
    if (siteId) sdWhere.site_id = siteId;
    const siteDepts = await SiteDepartment.findAll({ where: sdWhere });
    const sdIds = siteDepts.map((sd) => sd.id);
    let coveredBlocks = 0;
    for (const block of blocks) {
      const count = await RotationAssignment.count({
        where: { block_id: block.id, site_department_id: { [Op.in]: sdIds.length ? sdIds : [-1] } },
      });
      if (count > 0) coveredBlocks++;
    }
    results.push({ department: dept.code, coveredBlocks, totalBlocks: blocks.length, pct: blocks.length ? round((coveredBlocks / blocks.length) * 100) : 0 });
  }
  return results;
}

/** 13. Schedule Publication Timeliness = avg(days between publish date and block start date)
 * Only meaningful once real rotation schedules exist -- with an empty
 * Schedules page there is nothing to be "on time" or "late" for, so this
 * returns null (rendered as N/A) until at least one RotationAssignment has
 * been created. */
async function schedulePublicationTimeliness() {
  const totalAssignments = await RotationAssignment.count();
  if (totalAssignments === 0) {
    return { avgDaysAhead: null, sampleSize: 0 };
  }

  const blocks = await Block.findAll({ where: { published_at: { [Op.ne]: null } } });
  const daysArr = blocks.map((b) => {
    const start = new Date(b.start_date);
    const published = new Date(b.published_at);
    return (start - published) / (1000 * 60 * 60 * 24);
  });
  return { avgDaysAhead: round(mean(daysArr)), sampleSize: daysArr.length };
}

/** 14. Change Request Rate = change requests / total assignments in block * 100 */
async function changeRequestRate(blockId) {
  const totalAssignments = await RotationAssignment.count(blockId ? { where: { block_id: blockId } } : {});
  const changeRequests = await ChangeRequest.count({
    include: blockId ? [{ model: RotationAssignment, where: { block_id: blockId } }] : [],
  });
  const pct = totalAssignments > 0 ? round((changeRequests / totalAssignments) * 100) : 0;
  return { changeRequests, totalAssignments, pct };
}

/** 15. Approval Turnaround Time = avg(resolved_at - requested_at) in hours, for resolved change requests */
async function approvalTurnaroundTime() {
  const resolved = await ChangeRequest.findAll({ where: { resolved_at: { [Op.ne]: null } } });
  const hoursArr = resolved.map((cr) => (new Date(cr.resolved_at) - new Date(cr.requested_at)) / (1000 * 60 * 60));
  return { avgHours: round(mean(hoursArr)), sampleSize: hoursArr.length };
}

/** 16. Notification Success/Delivery Rate = sent (or mock_sent) / total notifications * 100 */
async function notificationSuccessRate() {
  const total = await Notification.count();
  const succeeded = await Notification.count({ where: { status: { [Op.in]: ['sent', 'mock_sent'] } } });
  return { succeeded, total, pct: total > 0 ? round((succeeded / total) * 100) : 0 };
}

/** 17. Audit Log Completeness = audit log rows with a properly attributed user_id / total rows * 100 */
async function auditLogCompleteness() {
  const total = await AuditLog.count();
  const attributed = await AuditLog.count({ where: { user_id: { [Op.ne]: null } } });
  return { attributed, total, pct: total > 0 ? round((attributed / total) * 100) : 0 };
}

/** Notification Delivery Rate for a single physician (used in the Physician-level report) */
async function physicianNotificationDeliveryRate(physicianId) {
  const total = await Notification.count({ where: { user_id: physicianId } });
  const succeeded = await Notification.count({ where: { user_id: physicianId, status: { [Op.in]: ['sent', 'mock_sent'] } } });
  return { succeeded, total, pct: total > 0 ? round((succeeded / total) * 100) : 0 };
}

function round(n) {
  return Math.round(n * 10) / 10;
}

module.exports = {
  rotationCoverageRate,
  departmentAllocationBalance,
  siteUtilization,
  curriculumCompliance,
  rotationBlockCompletion,
  conflictCount,
  individualRotationCompletion,
  specialtyExposure,
  rotationEquity,
  departmentCapacityUtilization,
  siteRotationCompliance,
  criticalUnitCoverage,
  schedulePublicationTimeliness,
  changeRequestRate,
  approvalTurnaroundTime,
  notificationSuccessRate,
  auditLogCompleteness,
  physicianNotificationDeliveryRate,
};
