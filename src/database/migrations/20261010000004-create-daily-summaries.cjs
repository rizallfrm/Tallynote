"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("daily_summaries", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
      user_id: {
        type: Sequelize.BIGINT, allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE", onDelete: "CASCADE",
      },
      summary_date: { type: Sequelize.DATEONLY, allowNull: false },
      total_activities: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      completed_activities: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      reflection_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      ai_summary: { type: Sequelize.TEXT },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    });
    await queryInterface.addConstraint("daily_summaries", {
      fields: ["user_id", "summary_date"],
      type: "unique",
      name: "daily_summaries_user_date_uq",
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable("daily_summaries");
  },
};