import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const ReminderLog = sequelize.define("ReminderLog", {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  activity_id: { type: DataTypes.BIGINT, allowNull: false },
  stage: { type: DataTypes.STRING(10), allowNull: false },
  channel: { type: DataTypes.STRING(10), allowNull: false },
  status: { type: DataTypes.STRING(10), defaultValue: "pending" },
  attempts: { type: DataTypes.INTEGER, defaultValue: 0 },
  error: DataTypes.TEXT,
}, { tableName: "reminder_logs" });