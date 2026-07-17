module.exports = (sequelize, DataTypes) => {
  return sequelize.define('Department', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false },
    code: { type: DataTypes.STRING, allowNull: false },
    color_hex: { type: DataTypes.STRING, allowNull: false, defaultValue: '#7FB37F' },
    is_critical_unit: { type: DataTypes.BOOLEAN, defaultValue: false },
  }, { tableName: 'departments' });
};
