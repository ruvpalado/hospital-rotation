// Join table: which departments/teams operate at which site, plus block capacity (slots)
module.exports = (sequelize, DataTypes) => {
  return sequelize.define('SiteDepartment', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    site_id: { type: DataTypes.INTEGER, allowNull: false },
    department_id: { type: DataTypes.INTEGER, allowNull: false },
    capacity_per_block: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 2 },
  }, {
    tableName: 'site_departments',
    indexes: [{ unique: true, fields: ['site_id', 'department_id'] }],
  });
};
