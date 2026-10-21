import { DataTypes as D } from "sequelize";
import { sequelize } from "../config/database.js";

const pk = () => ({ type: D.BIGINT, primaryKey: true, autoIncrement: true });
const big = (allowNull = false) => ({ type: D.BIGINT, allowNull });

export const Workspace = sequelize.define("Workspace", {
  id: pk(), name: { type: D.STRING(100), allowNull: false }, description: D.TEXT, created_by: big(true),
}, { tableName: "workspaces" });

export const WorkspaceMember = sequelize.define("WorkspaceMember", {
  id: pk(), workspace_id: big(), user_id: big(), role: { type: D.STRING(10), defaultValue: "member" },
}, { tableName: "workspace_members", updatedAt: false });

export const WorkspaceInvite = sequelize.define("WorkspaceInvite", {
  id: pk(), workspace_id: big(), created_by: big(true),
  token_hash: { type: D.STRING(64), allowNull: false },
  expires_at: { type: D.DATE, allowNull: false },
  max_uses: D.INTEGER, uses: { type: D.INTEGER, defaultValue: 0 }, revoked_at: D.DATE,
}, { tableName: "workspace_invites", updatedAt: false });

export const WorkspacePost = sequelize.define("WorkspacePost", {
  id: pk(), workspace_id: big(), user_id: big(true), parent_id: big(true),
  kind: { type: D.STRING(10), defaultValue: "message" }, body: { type: D.TEXT, allowNull: false },
}, { tableName: "workspace_posts" });

export const WorkspaceTask = sequelize.define("WorkspaceTask", {
  id: pk(), workspace_id: big(), created_by: big(true),
  title: { type: D.STRING(200), allowNull: false }, description: D.TEXT,
  priority: { type: D.STRING(10), defaultValue: "medium" },
  status: { type: D.STRING(12), defaultValue: "todo" },
  progress: { type: D.INTEGER, defaultValue: 0 },
  deadline_at: D.DATE, completed_at: D.DATE,
}, { tableName: "workspace_tasks" });

export const TaskAssignee = sequelize.define("TaskAssignee", {
  task_id: { type: D.BIGINT, primaryKey: true }, user_id: { type: D.BIGINT, primaryKey: true },
}, { tableName: "workspace_task_assignees", timestamps: false });

export const WorkspaceMeeting = sequelize.define("WorkspaceMeeting", {
  id: pk(), workspace_id: big(), created_by: big(true),
  title: { type: D.STRING(200), allowNull: false }, agenda: D.TEXT,
  starts_at: { type: D.DATE, allowNull: false }, ends_at: { type: D.DATE, allowNull: false },
  meeting_url: D.STRING(500), status: { type: D.STRING(12), defaultValue: "scheduled" },
}, { tableName: "workspace_meetings" });

export const MeetingAttendee = sequelize.define("MeetingAttendee", {
  meeting_id: { type: D.BIGINT, primaryKey: true }, user_id: { type: D.BIGINT, primaryKey: true },
  rsvp: { type: D.STRING(10), defaultValue: "pending" },
}, { tableName: "workspace_meeting_attendees", timestamps: false });

export const NotificationOutbox = sequelize.define("NotificationOutbox", {
  id: pk(), user_id: big(), workspace_id: big(true),
  type: { type: D.STRING(12), allowNull: false }, event_key: { type: D.STRING(120), allowNull: false },
  text: { type: D.TEXT, allowNull: false }, status: { type: D.STRING(10), defaultValue: "pending" },
  attempts: { type: D.INTEGER, defaultValue: 0 }, next_attempt_at: { type: D.DATE, defaultValue: D.NOW },
  error: D.TEXT,
}, { tableName: "notification_outbox" });