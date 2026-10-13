import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const WeeklyReflection = sequelize.define("WeeklyReflection", {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.BIGINT, allowNull: false },
  week_start: { type: DataTypes.DATEONLY, allowNull: false },
  content: { type: DataTypes.TEXT, allowNull: false },
}, { tableName: "weekly_reflections" });