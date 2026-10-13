"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable("users");

    if (!cols.google_id) {
      await queryInterface.addColumn("users", "google_id", {
        type: Sequelize.STRING(100), allowNull: true, unique: true,
      });
    }
    if (!cols.avatar_url) {
      await queryInterface.addColumn("users", "avatar_url", {
        type: Sequelize.STRING(500), allowNull: true,
      });
    }
    await queryInterface.changeColumn("users", "password_hash", {
      type: Sequelize.STRING(255), allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable("users");
    if (cols.avatar_url) await queryInterface.removeColumn("users", "avatar_url");
    if (cols.google_id) await queryInterface.removeColumn("users", "google_id");
    await queryInterface.changeColumn("users", "password_hash", {
      type: Sequelize.STRING(255), allowNull: false,
    });
  },
};