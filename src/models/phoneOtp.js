import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const PhoneOtp = sequelize.define("PhoneOtp", {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.BIGINT, allowNull: false },
  phone: { type: DataTypes.STRING(20), allowNull: false },
  code_hash: { type: DataTypes.STRING(100), allowNull: false },
  expires_at: { type: DataTypes.DATE, allowNull: false },
  attempts: { type: DataTypes.INTEGER, defaultValue: 0 },
}, { tableName: "phone_otps", updatedAt: false });