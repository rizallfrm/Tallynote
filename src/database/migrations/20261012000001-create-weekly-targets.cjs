"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("weekly_targets", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
      user_id: {
        type: Sequelize.BIGINT, allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE", onDelete: "CASCADE",
      },
      title: { type: Sequelize.STRING(150), allowNull: false },
      // activities | active_days | completed
      metric: { type: Sequelize.STRING(30), allowNull: false },
      target_value: { type: Sequelize.INTEGER, allowNull: false },
      category_id: {
        type: Sequelize.BIGINT, allowNull: true,
        references: { model: "categories", key: "id" },
        onUpdate: "CASCADE", onDelete: "SET NULL",
      },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    });
    await queryInterface.addIndex("weekly_targets", ["user_id"]);
  },
  async down(queryInterface) {
    await queryInterface.dropTable("weekly_targets");
  },
};