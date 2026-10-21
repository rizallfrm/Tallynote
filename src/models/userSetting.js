import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const UserSetting = sequelize.define(
  "UserSetting",
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.BIGINT, allowNull: false, unique: true },
    reminder_enabled: { type: DataTypes.BOOLEAN, defaultValue: false },
    reminder_time: DataTypes.TIME,
    notify_email: { type: DataTypes.BOOLEAN, defaultValue: true },
    notify_whatsapp: { type: DataTypes.BOOLEAN, defaultValue: false },
    language: { type: DataTypes.STRING(10), defaultValue: "id" },
    collab_notify_task: { type: DataTypes.BOOLEAN, defaultValue: true },
    collab_notify_deadline: { type: DataTypes.BOOLEAN, defaultValue: true },
    collab_notify_meeting: { type: DataTypes.BOOLEAN, defaultValue: true },
    collab_notify_update: { type: DataTypes.BOOLEAN, defaultValue: true },
  },
  { tableName: "user_settings" },
);
