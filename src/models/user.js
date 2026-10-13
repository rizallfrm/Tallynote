import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const User = sequelize.define(
  "User",
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(100), allowNull: false },
    email: { type: DataTypes.STRING(150), allowNull: false, unique: true },
    password_hash: { type: DataTypes.STRING(255), allowNull: true },
    google_id: { type: DataTypes.STRING(100), allowNull: true, unique: true },
    avatar_url: { type: DataTypes.STRING(500), allowNull: true },
    role: { type: DataTypes.STRING(30), defaultValue: "user" },
    timezone: { type: DataTypes.STRING(50), defaultValue: "Asia/Jakarta" },
    email_verified_at: DataTypes.DATE,
    phone: { type: DataTypes.STRING(20), allowNull: true },
    phone_verified_at: DataTypes.DATE,
  },
  { tableName: "users" },
);
