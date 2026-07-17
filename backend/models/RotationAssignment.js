// A physician assigned to a site+department for a given block
module.exports = (sequelize, DataTypes) => {
  return sequelize.define('RotationAssignment', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    physician_id: { type: DataTypes.INTEGER, allowNull: false },
    site_department_id: { type: DataTypes.INTEGER, allowNull: false },
    block_id: { type: DataTypes.INTEGER, allowNull: false },
    start_date: { type: DataTypes.DATEONLY, allowNull: false },
    end_date: { type: DataTypes.DATEONLY, allowNull: false },
    status: {
      type: DataTypes.ENUM('scheduled', 'in_progress', 'completed', 'incomplete'),
      defaultValue: 'scheduled',
    },
    approved_by_id: { type: DataTypes.INTEGER, allowNull: true },
    approved_at: { type: DataTypes.DATE, allowNull: true },
  }, { tableName: 'rotation_assignments' });
};
