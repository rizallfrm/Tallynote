import { Category } from "../models/index.js";

export const list = async (req, res, next) => {
  try {
    const where = req.user.role === "admin" && req.query.all === "1" ? {} : { is_active: true };
    res.json(await Category.findAll({ where, order: [["name", "ASC"]] }));
  } catch (e) { next(e); }
};

export const create = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    res.status(201).json(await Category.create({ name, description }));
  } catch (e) { next(e); }
};

export const update = async (req, res, next) => {
  try {
    const c = await Category.findByPk(req.params.id);
    if (!c) return res.status(404).json({ message: "Kategori tidak ditemukan" });
    const { name, description, is_active } = req.body;
    await c.update({ name, description, is_active });
    res.json(c);
  } catch (e) { next(e); }
};

export const remove = async (req, res, next) => {
  try {
    const c = await Category.findByPk(req.params.id);
    if (!c) return res.status(404).json({ message: "Kategori tidak ditemukan" });
    await c.destroy(); // gagal (400) bila masih dipakai aktivitas, nonaktifkan saja lewat is_active
    res.json({ message: "Kategori dihapus" });
  } catch (e) { next(e); }
};