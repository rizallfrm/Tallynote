import { Activity, Category, Tag, Template } from "../models/index.js";
import { refreshDailySummary } from "../services/summary.service.js";
import { setTags } from "./activity.controller.js";

const STATUSES = ["planned", "in_progress", "completed"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const exportData = async (req, res, next) => {
  try {
    const [acts, tpls] = await Promise.all([
      Activity.findAll({
        where: { user_id: req.user.id },
        include: [Category, { model: Tag, through: { attributes: [] } }],
        order: [["activity_date", "ASC"], ["id", "ASC"]],
      }),
      Template.findAll({ where: { user_id: req.user.id }, include: [Category] }),
    ]);
    res.json({
      version: 1,
      exported_at: new Date().toISOString(),
      activities: acts.map((a) => ({
        activity_date: a.activity_date, title: a.title, category: a.Category?.name,
        status: a.status, activity_input: a.activity_input, description: a.description,
        learning: a.learning, obstacle: a.obstacle, is_favorite: a.is_favorite,
        ai_generated: a.ai_generated, tags: a.Tags.map((t) => t.name),
      })),
      templates: tpls.map((t) => ({
        name: t.name, title: t.title, category: t.Category?.name, activity_input: t.activity_input,
      })),
    });
  } catch (e) { next(e); }
};

export const importData = async (req, res, next) => {
  try {
    const data = req.body;
    if (data?.version !== 1 || !Array.isArray(data.activities))
      return res.status(422).json({ message: "Format file backup tidak dikenali" });
    if (data.activities.length > 2000)
      return res.status(422).json({ message: "Maksimal 2000 aktivitas per impor" });

    const cats = await Category.findAll({ where: { is_active: true } });
    if (!cats.length) return res.status(400).json({ message: "Belum ada kategori aktif" });
    const byName = new Map(cats.map((c) => [c.name.toLowerCase(), c]));

    const existing = await Activity.findAll({ where: { user_id: req.user.id }, attributes: ["activity_date", "title"] });
    const seen = new Set(existing.map((a) => `${a.activity_date}|${a.title}`));

    let added = 0, skipped = 0;
    const dates = new Set();

    for (const r of data.activities) {
      const title = String(r.title || "").trim().slice(0, 200);
      const date = String(r.activity_date || "");
      if (!title || !DATE_RE.test(date) || seen.has(`${date}|${title}`)) { skipped++; continue; }
      seen.add(`${date}|${title}`);

      const cat = byName.get(String(r.category || "").toLowerCase()) || cats[0];
      const a = await Activity.create({
        user_id: req.user.id, category_id: cat.id, activity_date: date, title,
        status: STATUSES.includes(r.status) ? r.status : "in_progress",
        activity_input: String(r.activity_input || r.description || title).trim(),
        description: r.description || null, learning: r.learning || null, obstacle: r.obstacle || null,
        is_favorite: !!r.is_favorite, ai_generated: !!r.ai_generated,
      });
      await setTags(req.user.id, a, r.tags);
      dates.add(date); added++;
    }
    for (const d of dates) await refreshDailySummary(req.user.id, d);

    let tplAdded = 0;
    if (Array.isArray(data.templates)) {
      const names = new Set((await Template.findAll({ where: { user_id: req.user.id } })).map((t) => t.name));
      for (const t of data.templates.slice(0, 30)) {
        const name = String(t.name || "").trim().slice(0, 100);
        if (!name || !t.title || names.has(name)) continue;
        await Template.create({
          user_id: req.user.id, name, title: String(t.title).slice(0, 200),
          category_id: byName.get(String(t.category || "").toLowerCase())?.id || null,
          activity_input: t.activity_input || null,
        });
        names.add(name); tplAdded++;
      }
    }
    res.json({ added, skipped, templates: tplAdded });
  } catch (e) { next(e); }
};