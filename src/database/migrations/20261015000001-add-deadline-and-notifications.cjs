"use strict";

module.exports = {
  async up(q, S) {
    const tables = await q.showAllTables();

    const act = await q.describeTable("activities");
    if (!act.deadline_at) {
      await q.addColumn("activities", "deadline_at", { type: S.DATE, allowNull: true });
      await q.addIndex("activities", ["deadline_at"], { name: "activities_deadline_idx" });
    }

    const users = await q.describeTable("users");
    if (!users.phone) await q.addColumn("users", "phone", { type: S.STRING(20), allowNull: true });

    const st = await q.describeTable("user_settings");
    if (!st.notify_email)
      await q.addColumn("user_settings", "notify_email", { type: S.BOOLEAN, allowNull: false, defaultValue: true });
    if (!st.notify_whatsapp)
      await q.addColumn("user_settings", "notify_whatsapp", { type: S.BOOLEAN, allowNull: false, defaultValue: false });

    if (!tables.includes("reminder_logs")) {
      await q.createTable("reminder_logs", {
        id: { type: S.BIGINT, primaryKey: true, autoIncrement: true },
        activity_id: {
          type: S.BIGINT, allowNull: false,
          references: { model: "activities", key: "id" }, onUpdate: "CASCADE", onDelete: "CASCADE",
        },
        stage: { type: S.STRING(10), allowNull: false },    // 24h | 2h | overdue
        channel: { type: S.STRING(10), allowNull: false },  // email | whatsapp
        status: { type: S.STRING(10), allowNull: false, defaultValue: "pending" }, // pending | sent | failed
        attempts: { type: S.INTEGER, allowNull: false, defaultValue: 0 },
        error: { type: S.TEXT },
        created_at: { type: S.DATE, allowNull: false, defaultValue: S.fn("NOW") },
        updated_at: { type: S.DATE, allowNull: false, defaultValue: S.fn("NOW") },
      });
      await q.addConstraint("reminder_logs", {
        fields: ["activity_id", "stage", "channel"], type: "unique", name: "reminder_logs_uq",
      });
    }
  },

  async down(q) {
    await q.dropTable("reminder_logs");
    await q.removeColumn("user_settings", "notify_whatsapp");
    await q.removeColumn("user_settings", "notify_email");
    await q.removeColumn("users", "phone");
    await q.removeColumn("activities", "deadline_at");
  },
};