const sequelize = require('../config/db');
const { DataTypes } = require('sequelize');

const Role = require('./Role')(sequelize, DataTypes);
const User = require('./User')(sequelize, DataTypes);
const Site = require('./Site')(sequelize, DataTypes);
const Department = require('./Department')(sequelize, DataTypes);
const SiteDepartment = require('./SiteDepartment')(sequelize, DataTypes);
const Block = require('./Block')(sequelize, DataTypes);
const RotationAssignment = require('./RotationAssignment')(sequelize, DataTypes);
const RotationWeek = require('./RotationWeek')(sequelize, DataTypes);
const ChangeRequest = require('./ChangeRequest')(sequelize, DataTypes);
const Notification = require('./Notification')(sequelize, DataTypes);
const AuditLog = require('./AuditLog')(sequelize, DataTypes);
const PhysicianRoster = require('./PhysicianRoster')(sequelize, DataTypes);

// ---- Associations ----
Role.hasMany(User, { foreignKey: 'role_id' });
User.belongsTo(Role, { foreignKey: 'role_id' });

Site.hasMany(User, { foreignKey: 'home_site_id' });
User.belongsTo(Site, { foreignKey: 'home_site_id', as: 'homeSite' });

Department.hasMany(User, { foreignKey: 'home_department_id' });
User.belongsTo(Department, { foreignKey: 'home_department_id', as: 'homeDepartment' });

Site.belongsToMany(Department, { through: SiteDepartment, foreignKey: 'site_id', otherKey: 'department_id' });
Department.belongsToMany(Site, { through: SiteDepartment, foreignKey: 'department_id', otherKey: 'site_id' });
Site.hasMany(SiteDepartment, { foreignKey: 'site_id' });
Department.hasMany(SiteDepartment, { foreignKey: 'department_id' });
SiteDepartment.belongsTo(Site, { foreignKey: 'site_id' });
SiteDepartment.belongsTo(Department, { foreignKey: 'department_id' });

Block.hasMany(RotationAssignment, { foreignKey: 'block_id' });
RotationAssignment.belongsTo(Block, { foreignKey: 'block_id' });

User.hasMany(RotationAssignment, { foreignKey: 'physician_id', as: 'rotations' });
RotationAssignment.belongsTo(User, { foreignKey: 'physician_id', as: 'physician' });

SiteDepartment.hasMany(RotationAssignment, { foreignKey: 'site_department_id' });
RotationAssignment.belongsTo(SiteDepartment, { foreignKey: 'site_department_id' });

RotationAssignment.hasMany(RotationWeek, { foreignKey: 'rotation_assignment_id', as: 'weeks' });
RotationWeek.belongsTo(RotationAssignment, { foreignKey: 'rotation_assignment_id' });

RotationAssignment.hasMany(ChangeRequest, { foreignKey: 'rotation_assignment_id' });
ChangeRequest.belongsTo(RotationAssignment, { foreignKey: 'rotation_assignment_id' });
User.hasMany(ChangeRequest, { foreignKey: 'requested_by_id', as: 'requestedChanges' });
ChangeRequest.belongsTo(User, { foreignKey: 'requested_by_id', as: 'requestedBy' });
User.hasMany(ChangeRequest, { foreignKey: 'resolved_by_id', as: 'resolvedChanges' });
ChangeRequest.belongsTo(User, { foreignKey: 'resolved_by_id', as: 'resolvedBy' });

User.hasMany(Notification, { foreignKey: 'user_id' });
Notification.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(AuditLog, { foreignKey: 'user_id' });
AuditLog.belongsTo(User, { foreignKey: 'user_id' });

module.exports = {
  sequelize,
  Role,
  User,
  Site,
  Department,
  SiteDepartment,
  Block,
  RotationAssignment,
  RotationWeek,
  ChangeRequest,
  Notification,
  AuditLog,
  PhysicianRoster,
};
