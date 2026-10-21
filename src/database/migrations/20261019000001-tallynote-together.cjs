"use strict";

module.exports = {
  async up(q, S) {
    const tables = await q.showAllTables();
    const has = (n) => tables.includes(n);
    const now = { type: S.DATE, allowNull: false, defaultValue: S.fn("NOW") };
    const id = { type: S.BIGINT, primaryKey: true, autoIncrement: true };
    const fk = (model, o = {}) => ({
      type: S.BIGINT, allowNull: false,
      references: { model, key: "id" }, onUpdate: "CASCADE", onDelete: "CASCADE", ...o,
    });
    const setNull = { allowNull: true, onDelete: "SET NULL" };

    if (!has("workspaces")) {
      await q.createTable("workspaces", {
        id,
        name: { type: S.STRING(100), allowNull: false },
        description: { type: S.TEXT },
        created_by: fk("users", setNull),
        created_at: now, updated_at: now,
      });
    }

    if (!has("workspace_members")) {
      await q.createTable("workspace_members", {
        id,
        workspace_id: fk("workspaces"),
        user_id: fk("users"),
        role: { type: S.STRING(10), allowNull: false, defaultValue: "member" }, // owner | admin | member
        created_at: now,
      });
      await q.addConstraint("workspace_members", {
        fields: ["workspace_id", "user_id"], type: "unique", name: "workspace_members_uq",
      });
      await q.addIndex("workspace_members", ["user_id"]);
    }

    if (!has("workspace_invites")) {
      await q.createTable("workspace_invites", {
        id,
        workspace_id: fk("workspaces"),
        created_by: fk("users", setNull),
        token_hash: { type: S.STRING(64), allowNull: false, unique: true }, // SHA-256 dari token
        expires_at: { type: S.DATE, allowNull: false },
        max_uses: { type: S.INTEGER, allowNull: true }, // null = tanpa batas
        uses: { type: S.INTEGER, allowNull: false, defaultValue: 0 },
        revoked_at: { type: S.DATE, allowNull: true },
        created_at: now,
      });
      await q.addIndex("workspace_invites", ["workspace_id"]);
    }

    if (!has("workspace_posts")) {
      await q.createTable("workspace_posts", {
        id,
        workspace_id: fk("workspaces"),
        user_id: fk("users", setNull),
        parent_id: fk("workspace_posts", { allowNull: true }),
        kind: { type: S.STRING(10), allowNull: false, defaultValue: "message" }, // message | activity
        body: { type: S.TEXT, allowNull: false },
        created_at: now, updated_at: now,
      });
      await q.addIndex("workspace_posts", ["workspace_id", "id"]);
    }

    if (!has("workspace_tasks")) {
      await q.createTable("workspace_tasks", {
        id,
        workspace_id: fk("workspaces"),
        created_by: fk("users", setNull),
        title: { type: S.STRING(200), allowNull: false },
        description: { type: S.TEXT },
        priority: { type: S.STRING(10), allowNull: false, defaultValue: "medium" }, // low | medium | high
        status: { type: S.STRING(12), allowNull: false, defaultValue: "todo" },     // todo | in_progress | done
        progress: { type: S.INTEGER, allowNull: false, defaultValue: 0 },
        deadline_at: { type: S.DATE, allowNull: true },
        completed_at: { type: S.DATE, allowNull: true },
        created_at: now, updated_at: now,
      });
      await q.addIndex("workspace_tasks", ["workspace_id"]);
      await q.addIndex("workspace_tasks", ["deadline_at"]);
    }

    if (!has("workspace_task_assignees")) {
      await q.createTable("workspace_task_assignees", {
        task_id: { ...fk("workspace_tasks"), primaryKey: true },
        user_id: { ...fk("users"), primaryKey: true },
      });
      await q.addIndex("workspace_task_assignees", ["user_id"]);
    }

    if (!has("workspace_meetings")) {
      await q.createTable("workspace_meetings", {
        id,
        workspace_id: fk("workspaces"),
        created_by: fk("users", setNull),
        title: { type: S.STRING(200), allowNull: false },
        agenda: { type: S.TEXT },
        starts_at: { type: S.DATE, allowNull: false },
        ends_at: { type: S.DATE, allowNull: false },
        meeting_url: { type: S.STRING(500) },
        status: { type: S.STRING(12), allowNull: false, defaultValue: "scheduled" }, // scheduled | cancelled
        created_at: now, updated_at: now,
      });
      await q.addIndex("workspace_meetings", ["workspace_id", "starts_at"]);
    }

    if (!has("workspace_meeting_attendees")) {
      await q.createTable("workspace_meeting_attendees", {
        meeting_id: { ...fk("workspace_meetings"), primaryKey: true },
        user_id: { ...fk("users"), primaryKey: true },
        rsvp: { type: S.STRING(10), allowNull: false, defaultValue: "pending" }, // pending | accepted | declined
      });
    }

    if (!has("notification_outbox")) {
      await q.createTable("notification_outbox", {
        id,
        user_id: fk("users"),
        workspace_id: fk("workspaces", { allowNull: true }),
        type: { type: S.STRING(12), allowNull: false }, // task | deadline | meeting | update
        event_key: { type: S.STRING(120), allowNull: false },
        text: { type: S.TEXT, allowNull: false },
        status: { type: S.STRING(10), allowNull: false, defaultValue: "pending" }, // pending | sending | sent | skipped | failed
        attempts: { type: S.INTEGER, allowNull: false, defaultValue: 0 },
        next_attempt_at: { ...now },
        error: { type: S.TEXT },
        created_at: now, updated_at: now,
      });
      await q.addConstraint("notification_outbox", {
        fields: ["user_id", "event_key"], type: "unique", name: "notification_outbox_uq", // mencegah notifikasi ganda
      });
      await q.addIndex("notification_outbox", ["status", "next_attempt_at"]);
    }

    const st = await q.describeTable("user_settings");
    for (const c of ["collab_notify_task", "collab_notify_deadline", "collab_notify_meeting", "collab_notify_update"]) {
      if (!st[c]) await q.addColumn("user_settings", c, { type: S.BOOLEAN, allowNull: false, defaultValue: true });
    }
  },

  async down(q) {
    for (const t of [
      "notification_outbox", "workspace_meeting_attendees", "workspace_meetings",
      "workspace_task_assignees", "workspace_tasks", "workspace_posts",
      "workspace_invites", "workspace_members", "workspaces",
    ]) await q.dropTable(t);
    for (const c of ["collab_notify_task", "collab_notify_deadline", "collab_notify_meeting", "collab_notify_update"])
      await q.removeColumn("user_settings", c);
  },
};