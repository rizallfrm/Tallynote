import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const ActivityTag = sequelize.define("ActivityTag", {
  activity_id: { type: DataTypes.BIGINT, primaryKey: true },
  tag_id: { type: DataTypes.BIGINT, primaryKey: true },
}, { tableName: "activity_tags", timestamps: false });