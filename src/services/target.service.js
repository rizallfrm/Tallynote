import { Op } from "sequelize";
import { Activity, Category, WeeklyTarget } from "../models/index.js";
import { getRange } from "./summary.service.js";

export async function getTargetsWithProgress(userId, date) {
  const { start, end } = getRange("weekly", date);

  const [targets, acts] = await Promise.all([
    WeeklyTarget.findAll({
      where: { user_id: userId },
      include: [{ model: Category, attributes: ["id", "name"] }],
      order: [["is_active", "DESC"], ["id", "ASC"]],
    }),
    Activity.findAll({
      where: { user_id: userId, activity_date: { [Op.between]: [start, end] } },
      attributes: ["activity_date", "status", "category_id"],
    }),
  ]);

  const items = targets.map((t) => {
    const list = t.category_id
      ? acts.filter((a) => String(a.category_id) === String(t.category_id))
      : acts;

    let current;
    if (t.metric === "active_days") current = new Set(list.map((a) => a.activity_date)).size;
    else if (t.metric === "completed") current = list.filter((a) => a.status === "completed").length;
    else current = list.length;

    return {
      ...t.toJSON(),
      current,
      percent: Math.min(100, Math.round((current / t.target_value) * 100)),
      achieved: current >= t.target_value,
    };
  });

  return { start, end, items };
}