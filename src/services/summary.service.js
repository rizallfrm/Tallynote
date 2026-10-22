import { Op } from "sequelize";
import { Activity, Category, DailySummary, Tag, Workspace } from "../models/index.js";

export const todayStr = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: process.env.APP_TZ || "Asia/Jakarta" });

export async function refreshDailySummary(userId, date) {
  const rows = await Activity.findAll({ where: { user_id: userId, activity_date: date } });
  const payload = {
    total_activities: rows.length,
    completed_activities: rows.filter((r) => r.status === "completed").length,
    reflection_count: rows.filter((r) => r.learning || r.obstacle).length,
  };
  const [s, created] = await DailySummary.findOrCreate({
    where: { user_id: userId, summary_date: date },
    defaults: payload,
  });
  if (!created) await s.update(payload);
  return s;
}

const fmt = (d) => d.toISOString().slice(0, 10);

// range: daily | weekly | monthly, date: YYYY-MM-DD
export function getRange(range, date) {
  const d = new Date(`${date}T00:00:00Z`);
  if (range === "weekly") {
    const offset = (d.getUTCDay() + 6) % 7; // Senin = 0
    const start = new Date(d);
    start.setUTCDate(d.getUTCDate() - offset);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
    return { start: fmt(start), end: fmt(end) };
  }
  if (range === "monthly") {
    const y = d.getUTCFullYear(), m = d.getUTCMonth();
    return { start: fmt(new Date(Date.UTC(y, m, 1))), end: fmt(new Date(Date.UTC(y, m + 1, 0))) };
  }
  return { start: fmt(d), end: fmt(d) };
}

async function syncCollab(userId) {
  const { ensureUserSynced } = await import("./collabSync.js"); // dinamis: menghindari impor melingkar
  await ensureUserSynced(userId);
}

export async function getRecap(userId, range, date) {
  await syncCollab(userId);

  const { start, end } = getRange(range, date);
  const activities = await Activity.findAll({
    where: { user_id: userId, activity_date: { [Op.between]: [start, end] } },
    include: [Category, { model: Tag, through: { attributes: [] } }, { model: Workspace, attributes: ["id", "name"] }],
    order: [["activity_date", "ASC"], ["id", "ASC"]],
  });
  const perDay = await DailySummary.findAll({
    where: { user_id: userId, summary_date: { [Op.between]: [start, end] } },
    order: [["summary_date", "ASC"]],
  });
  const totals = perDay.reduce(
    (a, s) => ({
      total: a.total + s.total_activities,
      completed: a.completed + s.completed_activities,
      reflections: a.reflections + s.reflection_count,
    }),
    { total: 0, completed: 0, reflections: 0 }
  );
  return { range, start, end, totals, perDay, activities };
}

const addDays = (s, n) => {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return fmt(d);
};

export async function getStats(userId) {
  await syncCollab(userId);

  const today = todayStr();
  const rows = await Activity.findAll({
    where: { user_id: userId },
    attributes: ["activity_date", "status"],
    include: [{ model: Category, attributes: ["name"] }],
  });

  const byDate = {};
  rows.forEach((r) => { byDate[r.activity_date] = (byDate[r.activity_date] || 0) + 1; });

  // streak saat ini (hari ini belum diisi tidak memutus streak)
  let streak = 0;
  let cur = byDate[today] ? today : addDays(today, -1);
  while (byDate[cur]) { streak++; cur = addDays(cur, -1); }

  // streak terpanjang
  let longest = 0, run = 0, prev = null;
  for (const d of Object.keys(byDate).sort()) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }

  // heatmap: 12 minggu, mulai Senin, total 84 hari
  const weekStart = getRange("weekly", today).start;
  const hmStart = addDays(weekStart, -77);
  const heatmap = Array.from({ length: 84 }, (_, i) => {
    const date = addDays(hmStart, i);
    return { date, count: byDate[date] || 0 };
  });

  const month = rows.filter((r) => r.activity_date.startsWith(today.slice(0, 7)));
  const monthDone = month.filter((r) => r.status === "completed").length;

  const since = addDays(today, -29);
  const cat = {};
  rows.filter((r) => r.activity_date >= since).forEach((r) => {
    const n = r.Category?.name || "Lainnya";
    cat[n] = (cat[n] || 0) + 1;
  });

  const weekEnd = addDays(weekStart, 6);
  const activeDaysThisWeek = Object.keys(byDate).filter((d) => d >= weekStart && d <= weekEnd).length;

  return {
    today,
    streak,
    longestStreak: longest,
    total: rows.length,
    month: {
      total: month.length,
      completed: monthDone,
      rate: month.length ? Math.round((monthDone / month.length) * 100) : 0,
    },
    activeDaysThisWeek,
    heatmap,
    categories: Object.entries(cat).map(([name, value]) => ({ name, value })),
  };
}