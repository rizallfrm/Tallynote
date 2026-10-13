"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("ai_generations", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
      activity_id: {
        type: Sequelize.BIGINT, allowNull: false,
        references: { model: "activities", key: "id" },
        onUpdate: "CASCADE", onDelete: "CASCADE",
      },
      input_text: { type: Sequelize.TEXT, allowNull: false },
      generated_description: { type: Sequelize.TEXT },
      generated_learning: { type: Sequelize.TEXT },
      generated_obstacle: { type: Sequelize.TEXT },
      model_name: { type: Sequelize.STRING(100) },
      prompt_version: { type: Sequelize.STRING(50) },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    });
    await queryInterface.addIndex("ai_generations", ["activity_id"]);
  },
  async down(queryInterface) {
    await queryInterface.dropTable("ai_generations");
  },
};