const kpi = require('../services/kpiService');

exports.overview = async (req, res) => {
  try {
    const { blockId } = req.query;
    const [
      coverage, balance, siteUtil, curriculum, blockCompletion, conflicts,
      equity, capacity, siteCompliance, criticalCoverage, publication,
      changeRate, approvalTurnaround, notifSuccess, auditCompleteness,
    ] = await Promise.all([
      kpi.rotationCoverageRate(blockId),
      kpi.departmentAllocationBalance(blockId),
      kpi.siteUtilization(blockId),
      kpi.curriculumCompliance(),
      kpi.rotationBlockCompletion(blockId),
      kpi.conflictCount(blockId),
      kpi.rotationEquity(),
      kpi.departmentCapacityUtilization(blockId),
      kpi.siteRotationCompliance(blockId),
      kpi.criticalUnitCoverage(),
      kpi.schedulePublicationTimeliness(),
      kpi.changeRequestRate(blockId),
      kpi.approvalTurnaroundTime(),
      kpi.notificationSuccessRate(),
      kpi.auditLogCompleteness(),
    ]);

    res.json({
      rotationCoverageRate: coverage,
      departmentAllocationBalance: balance,
      siteUtilization: siteUtil,
      curriculumCompliance: curriculum,
      rotationBlockCompletion: blockCompletion,
      conflictFreeScheduling: conflicts,
      rotationEquity: equity,
      departmentCapacityUtilization: capacity,
      siteRotationCompliance: siteCompliance,
      criticalUnitCoverage: criticalCoverage,
      schedulePublicationTimeliness: publication,
      changeRequestRate: changeRate,
      approvalTurnaroundTime: approvalTurnaround,
      notificationSuccessRate: notifSuccess,
      auditLogCompleteness: auditCompleteness,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to compute KPIs', details: err.message });
  }
};

exports.physicianKpis = async (req, res) => {
  try {
    const physicianId = req.params.id;
    const [completion, exposure, notifDelivery] = await Promise.all([
      kpi.individualRotationCompletion(physicianId),
      kpi.specialtyExposure(physicianId),
      kpi.physicianNotificationDeliveryRate(physicianId),
    ]);
    res.json({
      individualRotationCompletion: completion,
      specialtyExposure: exposure,
      notificationDeliveryRate: notifDelivery,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to compute physician KPIs', details: err.message });
  }
};
