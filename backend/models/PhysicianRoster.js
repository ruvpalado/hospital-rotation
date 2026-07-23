// A lightweight name-only roster, distinct from real User accounts. Entries
// exist purely to populate the Physician autocomplete when creating a
// rotation schedule (see AddScheduleModal.js) -- they have no login, no
// email, no password. Uploaded in bulk via CSV by the developer account (see
// physicianRosterController.uploadRoster / routes/physicianRoster.js).
module.exports = (sequelize, DataTypes) => {
  return sequelize.define('PhysicianRoster', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    full_name: { type: DataTypes.STRING, allowNull: false },
  }, { tableName: 'physician_roster' });
};
