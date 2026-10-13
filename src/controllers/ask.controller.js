import { Op } from "sequelize";
import { Activity, Category } from "../models/index.js";
import { askJournal } from "../services/gemini.service.js";
import { todayStr } from "../services/summary.service.js";

const STOP = new Set([
  "yang", "apa", "aku", "saya", "kapan", "bagaimana", "dengan", "untuk", "dari", "pada",
  "adalah", "terakhir", "bulan", "minggu", "hari", "paling", "sering", "selama",
]);
const FIELDS = ["title", "description", "learning", "obstacle", "activity_input"];

export const ask = async (req, res, next) => {
  try {
    const q = String(req.body.question || "").trim();
    if (q.length < 3 || q.length > 300)
      return res.status(422).json({ message: "Pertanyaan harus 3-300 karakter" });

    const words = [...new Set(q.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) || [])]
      .filter((w) => !STOP.has(w)).slice(0, 5);

    const base = { user_id: req.user.id };
    const recent = await Activity.findAll({
      where: base, include: [Category], order: [["activity_date", "DESC"], ["id", "DESC"]], limit: 50,
    });
    const matched = words.length
      ? await Activity.findAll({
          where: {
            ...base,
            [Op.or]: words.flatMap((w) =>
              FIELDS.map((f) => ({ [f]: { [Op.iLike]: `%${w.replace(/[%_\\]/g, "\\$&")}%` } }))
            ),
          },
          include: [Category], order: [["activity_date", "DESC"]], limit: 40,
        })
      : [];

    const map = new Map();
    [...matched, ...recent].forEach((a) => map.set(a.id, a));
    const items = [...map.values()].sort((a, b) => b.activity_date.localeCompare(a.activity_date));

    if (!items.length)
      return res.json({ answer: "Jurnalmu masih kosong, jadi belum ada yang bisa saya jawab. Catat beberapa aktivitas dulu.", used: 0 });

    res.json({ answer: await askJournal(q, items, todayStr()), used: items.length });
  } catch (e) { next(e); }
};