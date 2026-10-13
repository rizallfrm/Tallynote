import { Category, Template } from "../models/index.js";

const MAX = 30;

const parse = (b) => {
  const name = String(b.name || "").trim();
  const title = String(b.title || "").trim();
  if (!name) return { error: "Nama template wajib diisi" };
  if (!title) return { error: "Judul wajib diisi" };
  return {
    data: {
      name: name.slice(0, 100),
      title: title.slice(0, 200),
      category_id: b.category_id ? Number(b.category_id) : null,
      activity_input: String(b.activity_input || "").slice(0, 5000) || null,
    },
  };
};

export const list = async (req, res, next) => {
  try {
    res.json(await Template.findAll({
      where: { user_id: req.user.id }, include: [Category], order: [["name", "ASC"]],
    }));
  } catch (e) { next(e); }
};

export const create = async (req, res, next) => {
  try {
    const { data, error } = parse(req.body);
    if (error) return res.status(422).json({ message: error });
    if ((await Template.count({ where: { user_id: req.user.id } })) >= MAX)
      return res.status(400).json({ message: `Maksimal ${MAX} template` });
    if (data.category_id && !(await Category.findByPk(data.category_id)))
      return res.status(400).json({ message: "Kategori tidak ditemukan" });
    res.status(201).json(await Template.create({ ...data, user_id: req.user.id }));
  } catch (e) { next(e); }
};

export const update = async (req, res, next) => {
  try {
    const t = await Template.findOne({ where: { id: req.params.id, user_id: req.user.id } });
    if (!t) return res.status(404).json({ message: "Template tidak ditemukan" });
    const { data, error } = parse({ ...t.toJSON(), ...req.body });
    if (error) return res.status(422).json({ message: error });
    await t.update(data);
    res.json(t);
  } catch (e) { next(e); }
};

export const remove = async (req, res, next) => {
  try {
    const t = await Template.findOne({ where: { id: req.params.id, user_id: req.user.id } });
    if (!t) return res.status(404).json({ message: "Template tidak ditemukan" });
    await t.destroy();
    res.json({ message: "Template dihapus" });
  } catch (e) { next(e); }
};  