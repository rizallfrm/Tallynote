"use strict";
const bcrypt = require("bcryptjs");

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    await queryInterface.bulkInsert("users", [
      {
        name: "Demo User",
        email: "demo@example.com",
        password_hash: await bcrypt.hash("password123", 10),
        role: "user",
        timezone: "Asia/Jakarta",
        created_at: now,
        updated_at: now,
      },
    ]);
    const [[u]] = await queryInterface.sequelize.query(
      `SELECT id FROM users WHERE email = 'demo@example.com'`
    );
    await queryInterface.bulkInsert("user_settings", [
      {
        user_id: u.id, reminder_enabled: false, language: "id",
        created_at: now, updated_at: now,
      },
    ]);
  },
  async down(queryInterface) {
    await queryInterface.bulkDelete("users", { email: "demo@example.com" }, {});
  },
};