import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const DailySummary = sequelize.define("DailySummary", {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.BIGINT, allowNull: false },
  summary_date: { type: DataTypes.DATEONLY, allowNull: false },
  total_activities: { type: DataTypes.INTEGER, defaultValue: 0 },
  completed_activities: { type: DataTypes.INTEGER, defaultValue: 0 },
  reflection_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  ai_summary: DataTypes.TEXT,
}, { tableName: "daily_summaries" });