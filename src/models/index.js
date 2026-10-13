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

User.hasMany(Activity, { foreignKey: "user_id", onDelete: "CASCADE" });
Activity.belongsTo(User, { foreignKey: "user_id" });

Category.hasMany(Activity, { foreignKey: "category_id", onDelete: "RESTRICT" });
Activity.belongsTo(Category, { foreignKey: "category_id" });

User.hasMany(DailySummary, { foreignKey: "user_id", onDelete: "CASCADE" });
DailySummary.belongsTo(User, { foreignKey: "user_id" });

User.hasOne(UserSetting, { foreignKey: "user_id", onDelete: "CASCADE" });
UserSetting.belongsTo(User, { foreignKey: "user_id" });

Activity.hasMany(AiGeneration, { foreignKey: "activity_id", onDelete: "CASCADE" });
AiGeneration.belongsTo(Activity, { foreignKey: "activity_id" });

User.hasMany(WeeklyTarget, { foreignKey: "user_id", onDelete: "CASCADE" });
WeeklyTarget.belongsTo(User, { foreignKey: "user_id" });
Category.hasMany(WeeklyTarget, { foreignKey: "category_id", onDelete: "SET NULL" });
WeeklyTarget.belongsTo(Category, { foreignKey: "category_id" });

User.hasMany(Template, { foreignKey: "user_id", onDelete: "CASCADE" });
Template.belongsTo(Category, { foreignKey: "category_id" });

User.hasMany(Tag, { foreignKey: "user_id", onDelete: "CASCADE" });
Activity.belongsToMany(Tag, { through: ActivityTag, foreignKey: "activity_id", otherKey: "tag_id" });
Tag.belongsToMany(Activity, { through: ActivityTag, foreignKey: "tag_id", otherKey: "activity_id" });

Activity.hasMany(ReminderLog, { foreignKey: "activity_id", onDelete: "CASCADE" });
ReminderLog.belongsTo(Activity, { foreignKey: "activity_id" });

User.hasMany(WeeklyReflection, { foreignKey: "user_id", onDelete: "CASCADE" });

export {
  sequelize, User, Category, Activity, DailySummary, UserSetting, AiGeneration,
  WeeklyTarget, Template, Tag, ActivityTag, WeeklyReflection, ReminderLog, EmailOtp, PhoneOtp,
};