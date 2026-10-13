"use strict";

module.exports = {
  async up(q, S) {
    const cols = await q.describeTable("users");
    if (!cols.email_verified_at) {
      await q.addColumn("users", "email_verified_at", { type: S.DATE, allowNull: true });
      // user yang sudah ada dianggap terverifikasi
      await q.sequelize.query(`UPDATE users SET email_verified_at = NOW() WHERE email_verified_at IS NULL`);
    }

    const tables = await q.showAllTables();
    if (!tables.includes("email_otps")) {
      await q.createTable("email_otps", {
        id: { type: S.BIGINT, primaryKey: true, autoIncrement: true },
        user_id: {
          type: S.BIGINT, allowNull: false,
          references: { model: "users", key: "id" }, onUpdate: "CASCADE", onDelete: "CASCADE",
        },
        code_hash: { type: S.STRING(100), allowNull: false },
        expires_at: { type: S.DATE, allowNull: false },
        attempts: { type: S.INTEGER, allowNull: false, defaultValue: 0 },
        created_at: { type: S.DATE, allowNull: false, defaultValue: S.fn("NOW") },
      });
      await q.addIndex("email_otps", ["user_id"]);
    }
  },
  async down(q) {
    await q.dropTable("email_otps");
    await q.removeColumn("users", "email_verified_at");
  },
};