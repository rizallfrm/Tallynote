import { sequelize } from "../config/database.js";
import { User } from "./user.js";
import { Category } from "./category.js";
import { Activity } from "./activity.js";
import { DailySummary } from "./dailySummary.js";
import { UserSetting } from "./userSetting.js";
import { AiGeneration } from "./aiGeneration.js";
import { WeeklyTarget } from "./weeklyTarget.js";
import { Template } from "./template.js";
import { Tag } from "./tag.js";
import { ActivityTag } from "./activityTag.js";
import { WeeklyReflection } from "./weeklyReflection.js";
import { ReminderLog } from "./reminderLog.js";
import { EmailOtp } from "./emailOtp.js";
import { PhoneOtp } from "./phoneOtp.js";
import {
  Workspace,
  WorkspaceMember,
  WorkspaceInvite,
  WorkspacePost,
  WorkspaceTask,
  TaskAssignee,
  WorkspaceMeeting,
  MeetingAttendee,
  NotificationOutbox,
} from "./collab.js";

User.hasMany(Activity, { foreignKey: "user_id", onDelete: "CASCADE" });
Activity.belongsTo(User, { foreignKey: "user_id" });

Category.hasMany(Activity, { foreignKey: "category_id", onDelete: "RESTRICT" });
Activity.belongsTo(Category, { foreignKey: "category_id" });

User.hasMany(DailySummary, { foreignKey: "user_id", onDelete: "CASCADE" });
DailySummary.belongsTo(User, { foreignKey: "user_id" });

User.hasOne(UserSetting, { foreignKey: "user_id", onDelete: "CASCADE" });
UserSetting.belongsTo(User, { foreignKey: "user_id" });

Activity.hasMany(AiGeneration, {
  foreignKey: "activity_id",
  onDelete: "CASCADE",
});
AiGeneration.belongsTo(Activity, { foreignKey: "activity_id" });

User.hasMany(WeeklyTarget, { foreignKey: "user_id", onDelete: "CASCADE" });
WeeklyTarget.belongsTo(User, { foreignKey: "user_id" });
Category.hasMany(WeeklyTarget, {
  foreignKey: "category_id",
  onDelete: "SET NULL",
});
WeeklyTarget.belongsTo(Category, { foreignKey: "category_id" });

User.hasMany(Template, { foreignKey: "user_id", onDelete: "CASCADE" });
Template.belongsTo(Category, { foreignKey: "category_id" });

User.hasMany(Tag, { foreignKey: "user_id", onDelete: "CASCADE" });
Activity.belongsToMany(Tag, {
  through: ActivityTag,
  foreignKey: "activity_id",
  otherKey: "tag_id",
});
Tag.belongsToMany(Activity, {
  through: ActivityTag,
  foreignKey: "tag_id",
  otherKey: "activity_id",
});

Activity.hasMany(ReminderLog, {
  foreignKey: "activity_id",
  onDelete: "CASCADE",
});
ReminderLog.belongsTo(Activity, { foreignKey: "activity_id" });

User.hasMany(WeeklyReflection, { foreignKey: "user_id", onDelete: "CASCADE" });

//together
Workspace.hasMany(WorkspaceMember, {
  foreignKey: "workspace_id",
  onDelete: "CASCADE",
});
WorkspaceMember.belongsTo(Workspace, { foreignKey: "workspace_id" });
WorkspaceMember.belongsTo(User, { foreignKey: "user_id" });
User.hasMany(WorkspaceMember, { foreignKey: "user_id", onDelete: "CASCADE" });

Workspace.hasMany(WorkspaceInvite, {
  foreignKey: "workspace_id",
  onDelete: "CASCADE",
});
WorkspaceInvite.belongsTo(Workspace, { foreignKey: "workspace_id" });

WorkspacePost.belongsTo(User, { foreignKey: "user_id" });

WorkspaceTask.belongsTo(Workspace, { foreignKey: "workspace_id" });
WorkspaceTask.belongsTo(User, { as: "creator", foreignKey: "created_by" });
WorkspaceTask.belongsToMany(User, {
  through: TaskAssignee,
  as: "assignees",
  foreignKey: "task_id",
  otherKey: "user_id",
});

WorkspaceMeeting.belongsTo(Workspace, { foreignKey: "workspace_id" });
WorkspaceMeeting.belongsTo(User, { as: "creator", foreignKey: "created_by" });
WorkspaceMeeting.belongsToMany(User, {
  through: MeetingAttendee,
  as: "attendees",
  foreignKey: "meeting_id",
  otherKey: "user_id",
});

export {
  sequelize,
  User,
  Category,
  Activity,
  DailySummary,
  UserSetting,
  AiGeneration,
  WeeklyTarget,
  Template,
  Tag,
  ActivityTag,
  WeeklyReflection,
  ReminderLog,
  EmailOtp,
  WorkspaceMember,
  PhoneOtp,
  MeetingAttendee,
  WorkspaceMeeting,
  WorkspacePost,
  WorkspaceTask,
  TaskAssignee,
  WorkspaceInvite,
  Workspace,
  NotificationOutbox
};
