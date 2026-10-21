"use strict";

module.exports = {
  async up(q, S) {
    const cols = await q.describeTable("activities");
    const ref = (model) => ({
      type: S.BIGINT, allowNull: true,
      references: { model, key: "id" }, onUpdate: "CASCADE", onDelete: "SET NULL",
    });
    if (!cols.workspace_id) await q.addColumn("activities", "workspace_id", ref("workspaces"));
    if (!cols.workspace_task_id) await q.addColumn("activities", "workspace_task_id", ref("workspace_tasks"));
    if (!cols.workspace_meeting_id) await q.addColumn("activities", "workspace_meeting_id", ref("workspace_meetings"));

    // satu aktivitas tertaut per user per tugas/meeting
    await q.sequelize.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS activities_user_task_uq
         ON activities (user_id, workspace_task_id) WHERE workspace_task_id IS NOT NULL`);
    await q.sequelize.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS activities_user_meeting_uq
         ON activities (user_id, workspace_meeting_id) WHERE workspace_meeting_id IS NOT NULL`);

    const [rows] = await q.sequelize.query(`SELECT id FROM categories WHERE name = 'Kolaborasi' LIMIT 1`);
    if (!rows.length)
      await q.bulkInsert("categories", [{
        name: "Kolaborasi", description: "Tugas dan meeting dari Tallynote Together",
        is_active: true, created_at: new Date(),
      }]);
  },

  async down(q) {
    await q.sequelize.query(`DROP INDEX IF EXISTS activities_user_task_uq`);
    await q.sequelize.query(`DROP INDEX IF EXISTS activities_user_meeting_uq`);
    const cols = await q.describeTable("activities");
    for (const c of ["workspace_meeting_id", "workspace_task_id", "workspace_id"])
      if (cols[c]) await q.removeColumn("activities", c);
  },
};