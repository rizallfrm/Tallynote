"use strict";

module.exports = {
  async up(q, S) {
    const cols = await q.describeTable("users");
    if (!cols.phone_verified_at)
      await q.addColumn("users", "phone_verified_at", { type: S.DATE, allowNull: true });

    const tables = await q.showAllTables();
    if (!tables.includes("phone_otps")) {
      await q.createTable("phone_otps", {
        id: { type: S.BIGINT, primaryKey: true, autoIncrement: true },
        user_id: {
          type: S.BIGINT, allowNull: false,
          references: { model: "users", key: "id" }, onUpdate: "CASCADE", onDelete: "CASCADE",
        },
        phone: { type: S.STRING(20), allowNull: false },
        code_hash: { type: S.STRING(100), allowNull: false },
        expires_at: { type: S.DATE, allowNull: false },
        attempts: { type: S.INTEGER, allowNull: false, defaultValue: 0 },
        created_at: { type: S.DATE, allowNull: false, defaultValue: S.fn("NOW") },
      });
      await q.addIndex("phone_otps", ["user_id"]);
    }
  },
  async down(q) {
    await q.dropTable("phone_otps");
    await q.removeColumn("users", "phone_verified_at");
  },
};