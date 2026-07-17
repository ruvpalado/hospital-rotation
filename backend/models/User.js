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
  }, { tableName: 'users' });
};
