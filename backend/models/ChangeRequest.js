module.exports = (sequelize, DataTypes) => {
  return sequelize.define('ChangeRequest', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    rotation_assignment_id: { type: DataTypes.INTEGER, allowNull: false },
    requested_by_id: { type: DataTypes.INTEGER, allowNull: false },
    reason: { type: DataTypes.TEXT, allowNull: false },
    status: { type: DataTypes.ENUM('pending', 'approved', 'rejected'), defaultValue: 'pending' },
    requested_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    resolved_by_id: { type: DataTypes.INTEGER, allowNull: true },
    resolved_at: { type: DataTypes.DATE, allowNull: true },
  }, { tableName: 'change_requests' });
};
