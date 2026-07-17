// Represents one of the 13 OBGYN curriculum blocks for a given academic cycle
module.exports = (sequelize, DataTypes) => {
  return sequelize.define('Block', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    block_number: { type: DataTypes.INTEGER, allowNull: false }, // 1-13
    name: { type: DataTypes.STRING, allowNull: false },
    start_date: { type: DataTypes.DATEONLY, allowNull: false },
    end_date: { type: DataTypes.DATEONLY, allowNull: false },
    total_weeks: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 4 },
    published_at: { type: DataTypes.DATE, allowNull: true }, // for Schedule Publication Timeliness KPI
  }, { tableName: 'blocks' });
};
