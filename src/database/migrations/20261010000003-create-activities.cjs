"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("activities", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
      user_id: {
        type: Sequelize.BIGINT, allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE", onDelete: "CASCADE",
      },
      category_id: {
        type: Sequelize.BIGINT, allowNull: false,
        references: { model: "categories", key: "id" },
        onUpdate: "CASCADE", onDelete: "RESTRICT",
      },
      activity_date: { type: Sequelize.DATEONLY, allowNull: false },
      title: { type: Sequelize.STRING(200), allowNull: false },
      activity_input: { type: Sequelize.TEXT, allowNull: false },
      description: { type: Sequelize.TEXT },
      learning: { type: Sequelize.TEXT },
      obstacle: { type: Sequelize.TEXT },
      status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: "in_progress" },
      ai_generated: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      ai_generated_at: { type: Sequelize.DATE },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    });
    await queryInterface.addIndex("activities", ["user_id", "activity_date"], {
      name: "activities_user_date_idx",
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable("activities");
  },
};