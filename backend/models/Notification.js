module.exports = (sequelize, DataTypes) => {
  return sequelize.define('Notification', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    channel: { type: DataTypes.ENUM('email', 'sms', 'system'), allowNull: false },
    title: { type: DataTypes.STRING, allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: false },
    status: { type: DataTypes.ENUM('mock_sent', 'sent', 'failed'), defaultValue: 'mock_sent' },
    related_rotation_id: { type: DataTypes.INTEGER, allowNull: true },
    sent_at: { type: DataTypes.DATE, allowNull: true },
  }, { tableName: 'notifications' });
};
