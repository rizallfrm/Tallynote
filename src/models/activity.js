import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const Activity = sequelize.define(
  "Activity",
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.BIGINT, allowNull: false },
    category_id: { type: DataTypes.BIGINT, allowNull: false },
    activity_date: { type: DataTypes.DATEONLY, allowNull: false },
    title: { type: DataTypes.STRING(200), allowNull: false },
    activity_input: { type: DataTypes.TEXT, allowNull: false },
    description: DataTypes.TEXT,
    learning: DataTypes.TEXT,
    obstacle: DataTypes.TEXT,
    status: { type: DataTypes.STRING(30), defaultValue: "in_progress" },
    ai_generated: { type: DataTypes.BOOLEAN, defaultValue: false },
    ai_generated_at: DataTypes.DATE,
    deadline_at: DataTypes.DATE,
    is_favorite: { type: DataTypes.BOOLEAN, defaultValue: false },
    workspace_id: { type: DataTypes.BIGINT, allowNull: true },
    workspace_task_id: { type: DataTypes.BIGINT, allowNull: true },
    workspace_meeting_id: { type: DataTypes.BIGINT, allowNull: true },
  },
  { tableName: "activities" },
);
