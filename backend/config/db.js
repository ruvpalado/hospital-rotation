require('dotenv').config();
const { Sequelize } = require('sequelize');

// Database connection is fully configured via environment variables:
//   DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
// See /backend/.env.example for local development defaults.
//
// On Railway, these are automatically provided when the backend service is
// linked to a MySQL service via reference variables, e.g.:
//   DB_HOST=${{ MySQL.MYSQLHOST }}
//   DB_PORT=${{ MySQL.MYSQLPORT }}
//   DB_NAME=${{ MySQL.MYSQLDATABASE }}
//   DB_USER=${{ MySQL.MYSQLUSER }}
//   DB_PASSWORD=${{ MySQL.MYSQLPASSWORD }}
// Without these set, the app falls back to localhost:3306 and will crash with
// ECONNREFUSED if no local MySQL instance is running.
//
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
