import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const AiGeneration = sequelize.define("AiGeneration", {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  activity_id: { type: DataTypes.BIGINT, allowNull: false },
  input_text: { type: DataTypes.TEXT, allowNull: false },
  generated_description: DataTypes.TEXT,
  generated_learning: DataTypes.TEXT,
  generated_obstacle: DataTypes.TEXT,
  model_name: DataTypes.STRING(100),
  prompt_version: DataTypes.STRING(50),
}, { tableName: "ai_generations", updatedAt: false });