"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("user_settings", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
      user_id: {
        type: Sequelize.BIGINT, allowNull: false, unique: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE", onDelete: "CASCADE",
      },
      reminder_enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      reminder_time: { type: Sequelize.TIME },
      language: { type: Sequelize.STRING(10), allowNull: false, defaultValue: "id" },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable("user_settings");
  },
};