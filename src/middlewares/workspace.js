import { WorkspaceMember } from "../models/index.js";

const RANK = { member: 1, admin: 2, owner: 3 };
export const isAdmin = (m) => RANK[m.role] >= RANK.admin;

// Keanggotaan selalu dicek ke database. Jika bukan anggota, balas 404 (bukan 403)
// agar ID ruang tidak bisa ditebak.
export const requireMember = (min = "member") => async (req, res, next) => {
  try {
    const wid = Number(req.params.wid);
    const m = await WorkspaceMember.findOne({ where: { workspace_id: wid, user_id: req.user.id } });
    if (!m) return res.status(404).json({ message: "Ruang tidak ditemukan" });
    if (RANK[m.role] < RANK[min]) return res.status(403).json({ message: "Akses ditolak" });
    req.member = m;
    req.wid = wid;
    next();
  } catch (e) { next(e); }
};