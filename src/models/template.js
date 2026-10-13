import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const Template = sequelize.define("Template", {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.BIGINT, allowNull: false },
  name: { type: DataTypes.STRING(100), allowNull: false },
  title: { type: DataTypes.STRING(200), allowNull: false },
  category_id: { type: DataTypes.BIGINT, allowNull: true },
  activity_input: DataTypes.TEXT,
}, { tableName: "templates" });