import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const Tag = sequelize.define("Tag", {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.BIGINT, allowNull: false },
  name: { type: DataTypes.STRING(30), allowNull: false },
}, { tableName: "tags", updatedAt: false });