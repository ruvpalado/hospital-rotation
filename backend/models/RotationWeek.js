// Week-level attendance record within a rotation assignment.
// A block has 4 weeks; a rotation counts as COMPLETE only if >= MIN_WEEKS_FOR_COMPLETION (3)
// weeks have status = 'attended'. 'maternity_leave' and 'annual_leave' NEVER count toward completion.
module.exports = (sequelize, DataTypes) => {
  return sequelize.define('RotationWeek', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    rotation_assignment_id: { type: DataTypes.INTEGER, allowNull: false },
    week_number: { type: DataTypes.INTEGER, allowNull: false }, // 1-4 within the block
    week_start_date: { type: DataTypes.DATEONLY, allowNull: false },
    status: {
      type: DataTypes.ENUM('attended', 'maternity_leave', 'annual_leave', 'absent', 'pending'),
      defaultValue: 'pending',
    },
  }, {
    tableName: 'rotation_weeks',
    indexes: [{ unique: true, fields: ['rotation_assignment_id', 'week_number'] }],
  });
};
