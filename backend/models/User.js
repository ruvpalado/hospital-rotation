module.exports = (sequelize, DataTypes) => {
  return sequelize.define('User', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    full_name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true, validate: { isEmail: true } },
    phone: { type: DataTypes.STRING },
    password_hash: { type: DataTypes.STRING, allowNull: false },
    role_id: { type: DataTypes.INTEGER, allowNull: false },
    home_site_id: { type: DataTypes.INTEGER, allowNull: true },
    home_department_id: { type: DataTypes.INTEGER, allowNull: true },
    language_pref: { type: DataTypes.ENUM('en', 'ar'), defaultValue: 'en' },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    // Account Creation Policy: new self-registrations start 'pending' and
    // can't log in until an admin approves them (see authController). This
    // column defaults to 'approved' so every other path that creates a user
    // (admin-maintenance endpoints, seed.js, the future direct-create-by-admin
    // flow) doesn't need to be touched -- only authController.register
    // explicitly sets 'pending'.
    approval_status: { type: DataTypes.ENUM('pending', 'approved', 'rejected'), defaultValue: 'approved' },
    // Forgot Password: a bcrypt-hashed one-time code (never store the raw
    // code) plus its expiry. Both are cleared back to null once the code is
    // used successfully or superseded by a newer request. See
    // authController.forgotPassword/verifyResetCode/resetPassword.
    reset_code_hash: { type: DataTypes.STRING, allowNull: true },
    reset_code_expires_at: { type: DataTypes.DATE, allowNull: true },
  }, { tableName: 'users' });
};
