import { Op } from "sequelize";
import {
  Activity,
  ActivityTag,
  AiGeneration,
  Category,
  ReminderLog,
  Tag,
} from "../models/index.js";
import {
  generateActivityFields,
  PROMPT_VERSION,
} from "../services/gemini.service.js";
import { refreshDailySummary } from "../services/summary.service.js";

const STATUSES = ["planned", "in_progress", "completed"];
const EDITABLE = [
  "category_id",
  "activity_date",
  "title",
  "activity_input",
  "description",
  "learning",
  "obstacle",
  "status",
  "is_favorite",
];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const pick = (o, keys) =>
  Object.fromEntries(
    keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]),
  );

const REL = [Category, { model: Tag, through: { attributes: [] } }];
const findOwn = (req) =>
  Activity.findOne({
    where: { id: req.params.id, user_id: req.user.id },
    include: REL,
  });

const cleanTags = (arr) =>
  [
    ...new Set(
      (Array.isArray(arr) ? arr : [])
        .map((t) =>
          String(t)
            .replace(/^#+/, "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "-")
            .slice(0, 30),
        )
        .filter(Boolean),
    ),
  ].slice(0, 8);

const parseDeadline = (v) => {
  if (v === undefined) return { skip: true };
  if (v === null || v === "") return { value: null };
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? { error: true } : { value: d };
};

export async function setTags(userId, activity, names) {
  const tags = [];
  for (const name of cleanTags(names)) {
    const [tag] = await Tag.findOrCreate({ where: { user_id: userId, name } });
    tags.push(tag);
  }
  await activity.setTags(tags);
}

async function runAI(activity) {
  const { data, model } = await generateActivityFields(activity.activity_input);
  await activity.update({
    ...data,
    ai_generated: true,
    ai_generated_at: new Date(),
  });
  await AiGeneration.create({
    activity_id: activity.id,
    input_text: activity.activity_input,
    generated_description: data.description,
    generated_learning: data.learning,
    generated_obstacle: data.obstacle,
    model_name: model,
    prompt_version: PROMPT_VERSION,
  });
}

export const preview = async (req, res, next) => {
  try {
    const { data } = await generateActivityFields(req.body.activity_input);
    res.json(data);
  } catch (e) {
    next(e);
  }
};

export const create = async (req, res, next) => {
  try {
    const {
      category_id,
      activity_date,
      title,
      status,
      mode,
      tags,
      is_favorite,
      activity_input,
      description,
      learning,
      obstacle,
    } = req.body;
    const dl = parseDeadline(req.body.deadline_at);
    if (dl.error)
      return res.status(422).json({ message: "Format deadline tidak valid" });
    const category = await Category.findOne({
      where: { id: category_id, is_active: true },
    });
    if (!category)
      return res.status(400).json({ message: "Kategori tidak valid" });

    const manual = mode === "manual";
    const clean = (v) => (v && String(v).trim()) || null;

    const activity = await Activity.create({
      deadline_at: dl.value ?? null,

      user_id: req.user.id,
      category_id,
      activity_date,
      title,
      status,
      activity_input: manual
        ? String(description).trim()
        : String(activity_input).trim(),
      description: clean(description),
      learning: clean(learning),
      obstacle: clean(obstacle),
      ai_generated: !manual,
      ai_generated_at: manual ? null : new Date(),
      is_favorite: !!is_favorite,
    });

    if (!manual) {
      await AiGeneration.create({
        activity_id: activity.id,
        input_text: activity.activity_input,
        generated_description: clean(description),
        generated_learning: clean(learning),
        generated_obstacle: clean(obstacle),
        model_name: process.env.GEMINI_MODELS || process.env.GEMINI_MODEL,
        prompt_version: PROMPT_VERSION,
      });
    }

    await setTags(req.user.id, activity, tags);
    await refreshDailySummary(req.user.id, activity_date);
    await activity.reload({ include: REL });
    res.status(201).json({ activity });
  } catch (e) {
    next(e);
  }
};

export const list = async (req, res, next) => {
  try {
    const { start, end, category_id, status, q, tag, favorite } = req.query;
    const dir = req.query.sort === "asc" ? "ASC" : "DESC";
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);

    const where = { user_id: req.user.id };
    if (start && end) where.activity_date = { [Op.between]: [start, end] };
    else if (start) where.activity_date = { [Op.gte]: start };
    else if (end) where.activity_date = { [Op.lte]: end };
    if (category_id) where.category_id = category_id;
    if (status) where.status = status;
    if (favorite === "1") where.is_favorite = true;

    if (tag) {
      const t = await Tag.findOne({
        where: { user_id: req.user.id, name: String(tag).toLowerCase() },
      });
      const ids = t
        ? (
            await ActivityTag.findAll({
              where: { tag_id: t.id },
              attributes: ["activity_id"],
            })
          ).map((r) => r.activity_id)
        : [];
      where.id = { [Op.in]: ids };
    }

    if (q && q.trim()) {
      const like = `%${q.trim().replace(/[%_\\]/g, "\\$&")}%`;
      where[Op.or] = [
        "title",
        "activity_input",
        "description",
        "learning",
        "obstacle",
      ].map((f) => ({ [f]: { [Op.iLike]: like } }));
    }

    const { rows, count } = await Activity.findAndCountAll({
      where,
      include: REL,
      distinct: true,
      order: [
        ["activity_date", dir],
        ["id", dir],
      ],
      limit,
      offset: (page - 1) * limit,
    });
    res.json({
      items: rows,
      total: count,
      page,
      pages: Math.max(1, Math.ceil(count / limit)),
    });
  } catch (e) {
    next(e);
  }
};

export const getOne = async (req, res, next) => {
  try {
    const a = await findOwn(req);
    if (!a)
      return res.status(404).json({ message: "Aktivitas tidak ditemukan" });
    res.json(a);
  } catch (e) {
    next(e);
  }
};

export const update = async (req, res, next) => {
  try {
    const a = await findOwn(req);
    if (!a)
      return res.status(404).json({ message: "Aktivitas tidak ditemukan" });

    const body = pick(req.body, EDITABLE);
    if (body.status && !STATUSES.includes(body.status))
      return res.status(422).json({ message: "Status tidak valid" });
    if (body.is_favorite !== undefined) body.is_favorite = !!body.is_favorite;

    const dl = parseDeadline(req.body.deadline_at);
    if (dl.error)
      return res.status(422).json({ message: "Format deadline tidak valid" });
    let deadlineChanged = false;
    if (!dl.skip) {
      deadlineChanged = String(a.deadline_at ?? "") !== String(dl.value ?? "");
      body.deadline_at = dl.value;
    }

    const oldDate = a.activity_date;
    await a.update(body);

    if (deadlineChanged)
      await ReminderLog.destroy({ where: { activity_id: a.id } }); // pengingat dimulai ulang
    if (Array.isArray(req.body.tags))
      await setTags(req.user.id, a, req.body.tags);

    await refreshDailySummary(req.user.id, a.activity_date);
    if (oldDate !== a.activity_date)
      await refreshDailySummary(req.user.id, oldDate);
    await a.reload({ include: REL });
    res.json(a);
  } catch (e) {
    next(e);
  }
};

export const regenerate = async (req, res, next) => {
  try {
    const a = await findOwn(req);
    if (!a)
      return res.status(404).json({ message: "Aktivitas tidak ditemukan" });
    await runAI(a);
    await refreshDailySummary(req.user.id, a.activity_date);
    res.json(a);
  } catch (e) {
    next(e);
  }
};

export const remove = async (req, res, next) => {
  try {
    const a = await findOwn(req);
    if (!a)
      return res.status(404).json({ message: "Aktivitas tidak ditemukan" });
    const date = a.activity_date;
    await a.destroy();
    await refreshDailySummary(req.user.id, date);
    res.json({ message: "Aktivitas dihapus" });
  } catch (e) {
    next(e);
  }
};

// POST /activities/:id/duplicate  { date }
export const duplicate = async (req, res, next) => {
  try {
    const src = await findOwn(req);
    if (!src)
      return res.status(404).json({ message: "Aktivitas tidak ditemukan" });
    const date = DATE_RE.test(req.body?.date || "")
      ? req.body.date
      : new Date().toLocaleDateString("en-CA");

    const copy = await Activity.create({
      user_id: req.user.id,
      category_id: src.category_id,
      activity_date: date,
      title: src.title,
      activity_input: src.activity_input,
      description: src.description,
      status: "in_progress",
      ai_generated: false,
    });
    await setTags(
      req.user.id,
      copy,
      (src.Tags || []).map((t) => t.name),
    );
    await refreshDailySummary(req.user.id, date);
    await copy.reload({ include: REL });
    res.status(201).json(copy);
  } catch (e) {
    next(e);
  }
};

// POST /activities/plan  { titles: [], date, category_id }
export const plan = async (req, res, next) => {
  try {
    const { date, category_id } = req.body;
    const titles = (Array.isArray(req.body.titles) ? req.body.titles : [])
      .map((s) => String(s).trim())
      .filter(Boolean)
      .slice(0, 10);
    if (!titles.length)
      return res.status(422).json({ message: "Tulis minimal satu rencana" });
    if (!DATE_RE.test(date || ""))
      return res.status(422).json({ message: "Tanggal tidak valid" });
    const cat = await Category.findOne({
      where: { id: category_id, is_active: true },
    });
    if (!cat) return res.status(400).json({ message: "Kategori tidak valid" });

    const rows = await Activity.bulkCreate(
      titles.map((t) => ({
        user_id: req.user.id,
        category_id,
        activity_date: date,
        title: t.slice(0, 200),
        activity_input: t,
        status: "planned",
      })),
    );
    await refreshDailySummary(req.user.id, date);
    res.status(201).json({ created: rows.length });
  } catch (e) {
    next(e);
  }
};

// GET /activities/upcoming: deadline terdekat yang belum selesai
export const upcoming = async (req, res, next) => {
  try {
    res.json(await Activity.findAll({
      where: {
        user_id: req.user.id,
        status: { [Op.ne]: "completed" },
        deadline_at: { [Op.ne]: null },
      },
      include: [Category],
      order: [["deadline_at", "ASC"]],
      limit: 5,
    }));
  } catch (e) { next(e); }
};