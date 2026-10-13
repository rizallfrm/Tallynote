import { Op } from "sequelize";
import { Activity, Category } from "../models/index.js";
import {
  getRange,
  getRecap,
  getStats,
  refreshDailySummary,
  todayStr,
} from "../services/summary.service.js";
import {
  generateDailySummaryText,
  generateRangeSummaryText,
} from "../services/gemini.service.js";

const validDate = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || "") ? d : todayStr());
const validRange = (r) =>
  ["daily", "weekly", "monthly"].includes(r) ? r : "daily";

export const recap = async (req, res, next) => {
  try {
    res.json(
      await getRecap(
        req.user.id,
        validRange(req.query.range),
        validDate(req.query.date),
      ),
    );
  } catch (e) {
    next(e);
  }
};

export const stats = async (req, res, next) => {
  try {
    res.json(await getStats(req.user.id));
  } catch (e) {
    next(e);
  }
};

// POST /summaries/ai  { date, range }
export const aiSummary = async (req, res, next) => {
  try {
    const range = validRange(req.body.range);
    const date = validDate(req.body.date);
    const { start, end } = getRange(range, date);

    const activities = await Activity.findAll({
      where: {
        user_id: req.user.id,
        activity_date: { [Op.between]: [start, end] },
      },
      include: [Category],
      order: [
        ["activity_date", "ASC"],
        ["id", "ASC"],
      ],
    });
    if (!activities.length)
      return res
        .status(404)
        .json({ message: "Belum ada aktivitas pada periode ini" });

    let text;
    try {
      const text =
        range === "daily"
          ? await generateDailySummaryText(activities)
          : await generateRangeSummaryText(
              activities,
              range === "weekly" ? "mingguan" : "bulanan",
            );

      // hanya ringkasan harian yang disimpan di tabel daily_summaries
      if (range === "daily") {
        const s = await refreshDailySummary(req.user.id, date);
        await s.update({ ai_summary: text });
      }
      res.json({ ai_summary: text, stored: range === "daily" });
    } catch (e) {
      console.error("Gemini error:", e.message);
      return res
        .status(502)
        .json({ message: "AI sedang bermasalah, coba lagi nanti" });
    }

    // hanya ringkasan harian yang disimpan di tabel daily_summaries
    if (range === "daily") {
      const s = await refreshDailySummary(req.user.id, date);
      await s.update({ ai_summary: text });
    }
    res.json({ ai_summary: text, stored: range === "daily" });
  } catch (e) {
    next(e);
  }
};
