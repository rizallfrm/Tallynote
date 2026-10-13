import { Category, WeeklyTarget } from "../models/index.js";
import { todayStr } from "../services/summary.service.js";
import { getTargetsWithProgress } from "../services/target.service.js";

// batas nilai maksimal per jenis target
const MAX = { activities: 500, active_days: 7, completed: 500 };
const MAX_TARGETS = 20;

function parse(b) {
  const title = String(b.title || "").trim();
  if (!title) return { error: "Nama target wajib diisi" };
  if (title.length > 150) return { error: "Nama target maksimal 150 karakter" };
  if (!Object.hasOwn(MAX, b.metric)) return { error: "Jenis target tidak valid" };

  const value = Number.parseInt(b.target_value, 10);
  if (!Number.isInteger(value) || value < 1 || value > MAX[b.metric])
    return { error: `Nilai target harus antara 1 dan ${MAX[b.metric]}` };

  let category_id = null;
  if (b.category_id) {
    category_id = Number(b.category_id);
    if (!Number.isInteger(category_id)) return { error: "Kategori tidak valid" };
  }
  return { data: { title, metric: b.metric, target_value: value, category_id } };
}

const checkCategory = async (id) => !id || !!(await Category.findByPk(id));

export const list = async (req, res, next) => {
  try {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || "") ? req.query.date : todayStr();
    res.json(await getTargetsWithProgress(req.user.id, date));
  } catch (e) { next(e); }
};

export const create = async (req, res, next) => {
  try {
    const { data, error } = parse(req.body);
    if (error) return res.status(422).json({ message: error });
    if (!(await checkCategory(data.category_id)))
      return res.status(400).json({ message: "Kategori tidak ditemukan" });
    if ((await WeeklyTarget.count({ where: { user_id: req.user.id } })) >= MAX_TARGETS)
      return res.status(400).json({ message: `Maksimal ${MAX_TARGETS} target` });

    res.status(201).json(await WeeklyTarget.create({ ...data, user_id: req.user.id }));
  } catch (e) { next(e); }
};

export const update = async (req, res, next) => {
  try {
    const t = await WeeklyTarget.findOne({ where: { id: req.params.id, user_id: req.user.id } });
    if (!t) return res.status(404).json({ message: "Target tidak ditemukan" });

    // jeda atau aktifkan saja
    if (Object.keys(req.body).length === 1 && "is_active" in req.body) {
      await t.update({ is_active: !!req.body.is_active });
      return res.json(t);
    }

    const { data, error } = parse({ ...t.toJSON(), ...req.body });
    if (error) return res.status(422).json({ message: error });
    if (!(await checkCategory(data.category_id)))
      return res.status(400).json({ message: "Kategori tidak ditemukan" });

    await t.update(data);
    res.json(t);
  } catch (e) { next(e); }
};

export const remove = async (req, res, next) => {
  try {
    const t = await WeeklyTarget.findOne({ where: { id: req.params.id, user_id: req.user.id } });
    if (!t) return res.status(404).json({ message: "Target tidak ditemukan" });
    await t.destroy();
    res.json({ message: "Target dihapus" });
  } catch (e) { next(e); }
};