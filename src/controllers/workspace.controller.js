import crypto from "crypto";
import { Op, QueryTypes } from "sequelize";
import {
  sequelize, User, Workspace, WorkspaceInvite, WorkspaceMember,
} from "../models/index.js";
import { link, logActivity, notify } from "../services/collabNotifier.js";

const sha = (t) => crypto.createHash("sha256").update(t).digest("hex");
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const same = (a, b) => String(a) === String(b);

const inviteStatus = (i) =>
  i.revoked_at ? "revoked"
  : new Date(i.expires_at) <= new Date() ? "expired"
  : i.max_uses != null && i.uses >= i.max_uses ? "full"
  : "active";

/* ---------- ruang ---------- */
export const listMine = async (req, res, next) => {
  try {
    res.json(await sequelize.query(
      `SELECT w.id, w.name, w.description, m.role,
         (SELECT COUNT(*)::int FROM workspace_members x WHERE x.workspace_id = w.id) AS member_count,
         (SELECT COUNT(*)::int FROM workspace_tasks t
            JOIN workspace_task_assignees a ON a.task_id = t.id
           WHERE t.workspace_id = w.id AND a.user_id = :uid AND t.status <> 'done') AS my_open_tasks
       FROM workspaces w
       JOIN workspace_members m ON m.workspace_id = w.id AND m.user_id = :uid
       ORDER BY w.created_at DESC`,
      { replacements: { uid: req.user.id }, type: QueryTypes.SELECT }
    ));
  } catch (e) { next(e); }
};

export const create = async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    if (name.length < 2 || name.length > 100)
      return res.status(422).json({ message: "Nama ruang 2-100 karakter" });
    if ((await WorkspaceMember.count({ where: { user_id: req.user.id, role: "owner" } })) >= 10)
      return res.status(400).json({ message: "Maksimal 10 ruang yang kamu buat" });

    const w = await sequelize.transaction(async (t) => {
      const w = await Workspace.create({
        name, description: String(req.body.description || "").trim().slice(0, 1000) || null,
        created_by: req.user.id,
      }, { transaction: t });
      await WorkspaceMember.create({ workspace_id: w.id, user_id: req.user.id, role: "owner" }, { transaction: t });
      return w;
    });
    res.status(201).json(w);
  } catch (e) { next(e); }
};

export const getOne = async (req, res, next) => {
  try {
    const w = await Workspace.findByPk(req.wid);
    const member_count = await WorkspaceMember.count({ where: { workspace_id: req.wid } });
    res.json({ ...w.toJSON(), role: req.member.role, member_count });
  } catch (e) { next(e); }
};

export const update = async (req, res, next) => {
  try {
    const w = await Workspace.findByPk(req.wid);
    const name = String(req.body.name ?? w.name).trim();
    if (name.length < 2 || name.length > 100) return res.status(422).json({ message: "Nama ruang 2-100 karakter" });
    await w.update({
      name,
      description: req.body.description !== undefined
        ? String(req.body.description).trim().slice(0, 1000) || null : w.description,
    });
    res.json(w);
  } catch (e) { next(e); }
};

export const remove = async (req, res, next) => {
  try {
    await Workspace.destroy({ where: { id: req.wid } }); // anggota, tugas, forum, dll ikut terhapus (CASCADE)
    res.json({ message: "Ruang dihapus" });
  } catch (e) { next(e); }
};

/* ---------- anggota ---------- */
async function purgeMember(wid, uid, t) {
  const opt = { replacements: { w: wid, u: uid }, transaction: t };
  await sequelize.query(
    `DELETE FROM workspace_task_assignees WHERE user_id = :u
       AND task_id IN (SELECT id FROM workspace_tasks WHERE workspace_id = :w)`, opt);
  await sequelize.query(
    `DELETE FROM workspace_meeting_attendees WHERE user_id = :u
       AND meeting_id IN (SELECT id FROM workspace_meetings WHERE workspace_id = :w)`, opt);
  await WorkspaceMember.destroy({ where: { workspace_id: wid, user_id: uid }, transaction: t });
}

// hanya data yang perlu: tanpa email dan nomor telepon
export const listMembers = async (req, res, next) => {
  try {
    const rows = await WorkspaceMember.findAll({
      where: { workspace_id: req.wid },
      include: [{ model: User, attributes: ["id", "name", "avatar_url"] }],
      order: [["created_at", "ASC"]],
    });
    res.json(rows.map((m) => ({
      user_id: m.user_id, name: m.User?.name, avatar_url: m.User?.avatar_url,
      role: m.role, joined_at: m.created_at,
    })));
  } catch (e) { next(e); }
};

export const setRole = async (req, res, next) => {
  try {
    const role = req.body.role;
    if (!["admin", "member", "owner"].includes(role)) return res.status(422).json({ message: "Peran tidak valid" });
    if (same(req.params.uid, req.user.id)) return res.status(400).json({ message: "Tidak bisa mengubah peranmu sendiri" });
    const target = await WorkspaceMember.findOne({ where: { workspace_id: req.wid, user_id: req.params.uid } });
    if (!target) return res.status(404).json({ message: "Anggota tidak ditemukan" });

    if (role === "owner") {
      await sequelize.transaction(async (t) => {
        await target.update({ role: "owner" }, { transaction: t });
        await req.member.update({ role: "admin" }, { transaction: t });
      });
    } else {
      await target.update({ role });
    }
    res.json({ message: "Peran diperbarui" });
  } catch (e) { next(e); }
};

export const removeMember = async (req, res, next) => {
  try {
    if (same(req.params.uid, req.user.id)) return res.status(400).json({ message: "Gunakan tombol Keluar dari ruang" });
    const target = await WorkspaceMember.findOne({ where: { workspace_id: req.wid, user_id: req.params.uid } });
    if (!target) return res.status(404).json({ message: "Anggota tidak ditemukan" });
    if (target.role === "owner") return res.status(403).json({ message: "Pemilik tidak bisa dikeluarkan" });
    if (target.role === "admin" && req.member.role !== "owner")
      return res.status(403).json({ message: "Hanya pemilik yang bisa mengeluarkan admin" });

    await sequelize.transaction((t) => purgeMember(req.wid, target.user_id, t));
    res.json({ message: "Anggota dikeluarkan" });
  } catch (e) { next(e); }
};

export const leave = async (req, res, next) => {
  try {
    if (req.member.role === "owner")
      return res.status(400).json({ message: "Pemilik tidak bisa keluar. Pindahkan kepemilikan ke anggota lain atau hapus ruang." });
    await sequelize.transaction((t) => purgeMember(req.wid, req.user.id, t));
    res.json({ message: "Kamu keluar dari ruang" });
  } catch (e) { next(e); }
};

/* ---------- undangan (admin) ---------- */
export const createInvite = async (req, res, next) => {
  try {
    const days = clamp(parseInt(req.body.expires_in_days) || 7, 1, 30);
    const max = req.body.max_uses ? clamp(parseInt(req.body.max_uses) || 1, 1, 500) : null;

    if (req.body.revoke_others)
      await WorkspaceInvite.update({ revoked_at: new Date() }, { where: { workspace_id: req.wid, revoked_at: null } });

    const token = crypto.randomBytes(32).toString("base64url"); // 256-bit, tidak bisa ditebak
    const inv = await WorkspaceInvite.create({
      workspace_id: req.wid, created_by: req.user.id, token_hash: sha(token),
      expires_at: new Date(Date.now() + days * 86400000), max_uses: max,
    });
    // token hanya dikirim sekali ini; database hanya menyimpan hash-nya
    res.status(201).json({ id: inv.id, link: link(`/join/${token}`), expires_at: inv.expires_at, max_uses: inv.max_uses });
  } catch (e) { next(e); }
};

export const listInvites = async (req, res, next) => {
  try {
    const rows = await WorkspaceInvite.findAll({
      where: { workspace_id: req.wid }, order: [["id", "DESC"]], limit: 30,
    });
    res.json(rows.map((i) => ({
      id: i.id, status: inviteStatus(i), created_at: i.created_at,
      expires_at: i.expires_at, max_uses: i.max_uses, uses: i.uses,
    })));
  } catch (e) { next(e); }
};

export const revokeInvite = async (req, res, next) => {
  try {
    const [n] = await WorkspaceInvite.update(
      { revoked_at: new Date() },
      { where: { id: req.params.iid, workspace_id: req.wid, revoked_at: null } }
    );
    if (!n) return res.status(404).json({ message: "Link tidak ditemukan atau sudah dicabut" });
    res.json({ message: "Link dicabut" });
  } catch (e) { next(e); }
};

/* ---------- undangan (penerima) ---------- */
const findInvite = (token, transaction) =>
  /^[A-Za-z0-9_-]{20,100}$/.test(token)
    ? WorkspaceInvite.findOne({ where: { token_hash: sha(token) }, include: [Workspace], transaction })
    : null;

const INVALID = { message: "Link undangan tidak berlaku (kedaluwarsa, dicabut, atau sudah penuh)" };

export const previewInvite = async (req, res, next) => {
  try {
    const inv = await findInvite(req.params.token);
    if (!inv || inviteStatus(inv) !== "active") return res.status(410).json(INVALID);
    const mine = await WorkspaceMember.findOne({ where: { workspace_id: inv.workspace_id, user_id: req.user.id } });
    res.json({
      workspace: {
        name: inv.Workspace.name, description: inv.Workspace.description,
        member_count: await WorkspaceMember.count({ where: { workspace_id: inv.workspace_id } }),
      },
      already_member: !!mine,
      workspace_id: mine ? inv.workspace_id : undefined, // ID hanya dibuka untuk yang sudah anggota
    });
  } catch (e) { next(e); }
};

export const joinInvite = async (req, res, next) => {
  try {
    let out;
    try {
      out = await sequelize.transaction(async (t) => {
        const inv = await findInvite(req.params.token, t);
        if (!inv) return { gone: true };
        const wid = inv.workspace_id;

        if (await WorkspaceMember.findOne({ where: { workspace_id: wid, user_id: req.user.id }, transaction: t }))
          return { wid, already: true };

        // klaim satu slot secara atomik: aman dari balapan saat banyak orang membuka link bersamaan
        const [n] = await WorkspaceInvite.update(
          { uses: sequelize.literal("uses + 1") },
          {
            where: {
              id: inv.id, revoked_at: null, expires_at: { [Op.gt]: new Date() },
              [Op.or]: [{ max_uses: null }, { uses: { [Op.lt]: sequelize.col("max_uses") } }],
            },
            transaction: t,
          }
        );
        if (!n) return { gone: true };

        await WorkspaceMember.create({ workspace_id: wid, user_id: req.user.id, role: "member" }, { transaction: t });
        return { wid, name: inv.Workspace.name };
      });
    } catch (e) {
      if (e.name !== "SequelizeUniqueConstraintError") throw e;
      out = { wid: null, already: true };
    }

    if (out.gone) return res.status(410).json(INVALID);
    if (!out.already) {
      const me = await User.findByPk(req.user.id, { attributes: ["name"] });
      await logActivity(out.wid, req.user.id, "bergabung ke ruang");
      const admins = await WorkspaceMember.findAll({ where: { workspace_id: out.wid, role: { [Op.in]: ["owner", "admin"] } } });
      await notify({
        workspaceId: out.wid, userIds: admins.map((a) => a.user_id), type: "update",
        key: `member_joined:${out.wid}:${req.user.id}`, exceptUserId: req.user.id,
        text: `👋 *${me.name}* bergabung ke ruang *${out.name}*\n\n${link(`/together/${out.wid}?tab=members`)}`,
      });
    }
    res.json({ workspace_id: out.wid, already_member: !!out.already });
  } catch (e) { next(e); }
};