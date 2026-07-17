require('dotenv').config();
const { Sequelize } = require('sequelize');

// Some managed MySQL hosts (Railway, PlanetScale, etc.) require SSL for public
// connections. Set DB_SSL=true in .env to enable it without touching this file.
const dialectOptions = process.env.DB_SSL === 'true'
  ? { ssl: { require: true, rejectUnauthorized: false } }
  : {};

const sequelize = new Sequelize(
  process.env.DB_NAME || 'hospital_rotation_db',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    dialectOptions,
    logging: false,
    define: {
      underscored: true,
      timestamps: true,
    },
  }
);

module.exports = sequelize;
