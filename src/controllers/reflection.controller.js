import { Op } from "sequelize";
import { Activity, Category, WeeklyReflection } from "../models/index.js";
import { getRange, todayStr } from "../services/summary.service.js";
import { generateReflectionText } from "../services/gemini.service.js";

const vd = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || "") ? d : todayStr());

export const get = async (req, res, next) => {
  try {
    const { start, end } = getRange("weekly", vd(req.query.date));
    const r = await WeeklyReflection.findOne({ where: { user_id: req.user.id, week_start: start } });
    res.json({ start, end, content: r?.content || null, updated_at: r?.updated_at || null });
  } catch (e) { next(e); }
};

export const generate = async (req, res, next) => {
  try {
    const { start, end } = getRange("weekly", vd(req.body.date));
    const acts = await Activity.findAll({
      where: { user_id: req.user.id, activity_date: { [Op.between]: [start, end] } },
      include: [Category],
      order: [["activity_date", "ASC"], ["id", "ASC"]],
    });
    if (!acts.length) return res.status(404).json({ message: "Belum ada aktivitas pada minggu ini" });

    const content = await generateReflectionText(acts); // AiError diteruskan ke errorHandler
    const [r, created] = await WeeklyReflection.findOrCreate({
      where: { user_id: req.user.id, week_start: start }, defaults: { content },
    });
    if (!created) await r.update({ content });
    res.json({ start, end, content, updated_at: r.updated_at });
  } catch (e) { next(e); }
};