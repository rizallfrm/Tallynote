"use strict";

module.exports = {
  async up(q, S) {
    const tables = await q.showAllTables();
    const has = (n) => tables.includes(n);
    const now = { type: S.DATE, allowNull: false, defaultValue: S.fn("NOW") };
    const fk = (model, onDelete = "CASCADE", allowNull = false) => ({
      type: S.BIGINT, allowNull,
      references: { model, key: "id" }, onUpdate: "CASCADE", onDelete,
    });

    const act = await q.describeTable("activities");
    if (!act.is_favorite)
      await q.addColumn("activities", "is_favorite", { type: S.BOOLEAN, allowNull: false, defaultValue: false });

    if (!has("templates")) {
      await q.createTable("templates", {
        id: { type: S.BIGINT, primaryKey: true, autoIncrement: true },
        user_id: fk("users"),
        name: { type: S.STRING(100), allowNull: false },
        title: { type: S.STRING(200), allowNull: false },
        category_id: fk("categories", "SET NULL", true),
        activity_input: { type: S.TEXT },
        created_at: now, updated_at: now,
      });
      await q.addIndex("templates", ["user_id"]);
    }

    if (!has("tags")) {
      await q.createTable("tags", {
        id: { type: S.BIGINT, primaryKey: true, autoIncrement: true },
        user_id: fk("users"),
        name: { type: S.STRING(30), allowNull: false },
        created_at: now,
      });
      await q.addConstraint("tags", { fields: ["user_id", "name"], type: "unique", name: "tags_user_name_uq" });
    }

    if (!has("activity_tags")) {
      await q.createTable("activity_tags", {
        activity_id: { ...fk("activities"), primaryKey: true },
        tag_id: { ...fk("tags"), primaryKey: true },
      });
      await q.addIndex("activity_tags", ["tag_id"]);
    }

    if (!has("weekly_reflections")) {
      await q.createTable("weekly_reflections", {
        id: { type: S.BIGINT, primaryKey: true, autoIncrement: true },
        user_id: fk("users"),
        week_start: { type: S.DATEONLY, allowNull: false },
        content: { type: S.TEXT, allowNull: false },
        created_at: now, updated_at: now,
      });
      await q.addConstraint("weekly_reflections", {
        fields: ["user_id", "week_start"], type: "unique", name: "weekly_reflections_user_week_uq",
      });
    }
  },

  async down(q) {
    for (const t of ["weekly_reflections", "activity_tags", "tags", "templates"]) await q.dropTable(t);
    await q.removeColumn("activities", "is_favorite");
  },
};