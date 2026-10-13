import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const Category = sequelize.define("Category", {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  description: DataTypes.TEXT,
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: "categories", updatedAt: false });