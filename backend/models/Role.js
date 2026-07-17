module.exports = (sequelize, DataTypes) => {
  return sequelize.define('Role', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    key: { type: DataTypes.ENUM('admin', 'scheduler', 'dept_head', 'physician'), allowNull: false, unique: true },
    label: { type: DataTypes.STRING, allowNull: false },
  }, { tableName: 'roles' });
};
