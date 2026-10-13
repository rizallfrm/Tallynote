import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const WeeklyTarget = sequelize.define("WeeklyTarget", {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.BIGINT, allowNull: false },
  title: { type: DataTypes.STRING(150), allowNull: false },
  metric: { type: DataTypes.STRING(30), allowNull: false },
  target_value: { type: DataTypes.INTEGER, allowNull: false },
  category_id: { type: DataTypes.BIGINT, allowNull: true },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: "weekly_targets" });