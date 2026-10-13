import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const EmailOtp = sequelize.define("EmailOtp", {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.BIGINT, allowNull: false },
  code_hash: { type: DataTypes.STRING(100), allowNull: false },
  expires_at: { type: DataTypes.DATE, allowNull: false },
  attempts: { type: DataTypes.INTEGER, defaultValue: 0 },
}, { tableName: "email_otps", updatedAt: false });