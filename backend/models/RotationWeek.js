// Week-level attendance record within a rotation assignment.
// A block has 4 weeks; a rotation counts as COMPLETE only if >= MIN_WEEKS_FOR_COMPLETION (3)
// weeks have status = 'attended'. 'maternity_leave' and 'annual_leave' NEVER count toward completion.
module.exports = (sequelize, DataTypes) => {
  return sequelize.define('RotationWeek', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    rotation_assignment_id: { type: DataTypes.INTEGER, allowNull: false },
    week_number: { type: DataTypes.INTEGER, allowNull: false }, // 1-4 within the block
    week_start_date: { type: DataTypes.DATEONLY, allowNull: false },
    // Official, approved attendance status. Only changes once an admin
    // approves a physician's proposal, or when an admin sets it directly.
    status: {
      type: DataTypes.ENUM('attended', 'maternity_leave', 'annual_leave', 'absent', 'pending'),
      defaultValue: 'pending',
    },
    // Weekly Status Update workflow: when a physician updates their own week,
    // the new value lands here (awaiting admin approval) rather than
    // overwriting `status`. Admin approve -> status = proposed_status, this
    // cleared. Admin override sets `status` directly and clears this. Null
    // means there's no pending proposal.
    proposed_status: {
      type: DataTypes.ENUM('attended', 'maternity_leave', 'annual_leave', 'absent', 'pending'),
      allowNull: true,
    },
  }, {
    tableName: 'rotation_weeks',
    indexes: [{ unique: true, fields: ['rotation_assignment_id', 'week_number'] }],
  });
};
