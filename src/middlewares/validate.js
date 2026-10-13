import { body, validationResult } from "express-validator";

export const validate = (rules) => [
  ...rules,
  (req, res, next) => {
    const r = validationResult(req);
    if (r.isEmpty()) return next();
    res.status(422).json({ message: r.array()[0].msg, errors: r.array() });
  },
];

const STATUSES = ["planned", "in_progress", "completed"];

export const registerRules = [
  body("name").trim().notEmpty().withMessage("Nama wajib diisi"),
  body("email").trim().toLowerCase().isEmail().withMessage("Email tidak valid"),
  body("password").isLength({ min: 6 }).withMessage("Password minimal 6 karakter"),
];

export const loginRules = [
  body("email").trim().toLowerCase().isEmail().withMessage("Email tidak valid"),
  body("password").notEmpty().withMessage("Password wajib diisi"),
];

const isManual = (v, { req }) => {
  if (req.body.mode !== "manual") throw new Error("bukan manual");
  return true;
};
const isAi = (v, { req }) => {
  if (req.body.mode === "manual") throw new Error("bukan ai");
  return true;
};

export const activityRules = [
  body("title").trim().notEmpty().isLength({ max: 200 }).withMessage("Judul wajib diisi (maks 200 karakter)"),
  body("category_id").isInt({ min: 1 }).withMessage("Kategori wajib dipilih"),
  body("activity_date").isISO8601().withMessage("Tanggal tidak valid"),
  body("status").optional().isIn(STATUSES).withMessage("Status tidak valid"),
  body("mode").optional().isIn(["manual", "ai"]).withMessage("Mode tidak valid"),

  // mode manual: hanya uraian yang wajib
  body("description").if(isManual).trim().isLength({ min: 10 })
    .withMessage("Uraian aktivitas wajib diisi (minimal 10 karakter)"),

  // mode AI: cerita wajib, dan hasil generate harus sudah ada
  body("activity_input").if(isAi).trim().isLength({ min: 10 })
    .withMessage("Ceritakan aktivitasmu minimal 10 karakter"),
  body("description").if(isAi).trim().notEmpty()
    .withMessage("Jalankan Generate AI dulu, atau pindah ke Isi Manual"),
];

export const categoryRules = [
  body("name").trim().notEmpty().isLength({ max: 100 }).withMessage("Nama kategori wajib diisi"),
];

export const previewRules = [
  body("activity_input").trim().isLength({ min: 10 }).withMessage("Ceritakan aktivitasmu minimal 10 karakter"),
];