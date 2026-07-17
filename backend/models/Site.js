module.exports = (sequelize, DataTypes) => {
  return sequelize.define('Site', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false },
    short_code: { type: DataTypes.STRING, allowNull: false, unique: true },
    color_hex: { type: DataTypes.STRING, allowNull: false, defaultValue: '#4A90D9' },
  }, { tableName: 'sites' });
};
