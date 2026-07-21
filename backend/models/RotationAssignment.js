// A physician assigned to a site+department for a given block
module.exports = (sequelize, DataTypes) => {
  return sequelize.define('RotationAssignment', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    // Nullable: the Physician field on Add Rotation Schedule accepts free
    // typed names, not just registered physician accounts. When the typed
    // name matches an existing physician, physician_id is set (and that
    // physician gets the account-linked features -- their own dashboard
    // view, per-physician KPIs, reminder notifications). When it doesn't
    // match anyone, physician_id stays null and physician_name holds the
    // typed text as a plain display-only label.
    physician_id: { type: DataTypes.INTEGER, allowNull: true },
    physician_name: { type: DataTypes.STRING, allowNull: true },
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
