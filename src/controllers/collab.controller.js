import { Op } from "sequelize";
import {
  sequelize, MeetingAttendee, User, WorkspaceMeeting, WorkspaceMember, WorkspacePost, WorkspaceTask,
} from "../models/index.js";
import { isAdmin } from "../middlewares/workspace.js";
import { link, logActivity, notify, timeOnly, when, workspaceName } from "../services/collabNotifier.js";

const same = (a, b) => String(a) === String(b);
const PRIORITY = ["low", "medium", "high"];
const TSTATUS = ["todo", "in_progress", "done"];
const PRIO_LABEL = { low: "Rendah", medium: "Sedang", high: "Tinggi" };
const AUTHOR = { model: User, attributes: ["id", "name", "avatar_url"] };

// undefined = tidak diubah, null = dihapus, Date = nilai baru
const parseDate = (v) => {
  if (v === undefined) return { skip: true };
  if (v === null || v === "") return { value: null };
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? { error: true } : { value: d };
};

/* ================= Forum ================= */
export const listPosts = async (req, res, next) => {
  try {
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const where = { workspace_id: req.wid, parent_id: null };
    if (/^\d+$/.test(req.query.before || "")) where.id = { [Op.lt]: Number(req.query.before) };

    const rows = await WorkspacePost.findAll({ where, include: [AUTHOR], order: [["id", "DESC"]], limit: limit + 1 });
    const page = rows.slice(0, limit);
    const replies = page.length
      ? await WorkspacePost.findAll({
          where: { workspace_id: req.wid, parent_id: { [Op.in]: page.map((p) => p.id) } },
          include: [AUTHOR], order: [["id", "ASC"]],
        })
      : [];
    res.json({
      items: page.map((p) => ({ ...p.toJSON(), replies: replies.filter((r) => same(r.parent_id, p.id)) })),
      has_more: rows.length > limit,
    });
  } catch (e) { next(e); }
};

export const createPost = async (req, res, next) => {
  try {
    const body = String(req.body.body || "").trim();
    if (!body || body.length > 2000) return res.status(422).json({ message: "Pesan 1-2000 karakter" });

    let parent_id = null;
    if (req.body.parent_id) {
      const parent = await WorkspacePost.findOne({
        where: { id: req.body.parent_id, workspace_id: req.wid, parent_id: null },
      });
      if (!parent) return res.status(404).json({ message: "Diskusi yang dibalas tidak ditemukan" });
      parent_id = parent.id;
    }
    const p = await WorkspacePost.create({ workspace_id: req.wid, user_id: req.user.id, parent_id, body });
    res.status(201).json(await WorkspacePost.findByPk(p.id, { include: [AUTHOR] }));
  } catch (e) { next(e); }
};

export const deletePost = async (req, res, next) => {
  try {
    const p = await WorkspacePost.findOne({ where: { id: req.params.pid, workspace_id: req.wid } });
    if (!p) return res.status(404).json({ message: "Pesan tidak ditemukan" });
    const own = p.kind === "message" && same(p.user_id, req.user.id);
    if (!own && !isAdmin(req.member)) return res.status(403).json({ message: "Akses ditolak" }); // moderasi: admin
    await p.destroy();
    res.json({ message: "Pesan dihapus" });
  } catch (e) { next(e); }
};

/* ================= Tugas ================= */
const TASK_INCLUDE = [
  { model: User, as: "assignees", attributes: ["id", "name", "avatar_url"], through: { attributes: [] } },
  { model: User, as: "creator", attributes: ["id", "name"] },
];
const loadTask = (id, wid) => WorkspaceTask.findOne({ where: { id, workspace_id: wid }, include: TASK_INCLUDE });

async function validAssignees(wid, ids) {
  const list = [...new Set((Array.isArray(ids) ? ids : []).map(Number).filter(Number.isInteger))].slice(0, 20);
  if (!list.length) return { ids: [] };
  const n = await WorkspaceMember.count({ where: { workspace_id: wid, user_id: list } });
  return n === list.length ? { ids: list } : { error: "Penanggung jawab harus anggota ruang ini" };
}

export const listTasks = async (req, res, next) => {
  try {
    const where = { workspace_id: req.wid };
    if (TSTATUS.includes(req.query.status)) where.status = req.query.status;
    let rows = await WorkspaceTask.findAll({
      where, include: TASK_INCLUDE,
      order: [[sequelize.literal("deadline_at IS NULL"), "ASC"], ["deadline_at", "ASC"], ["id", "DESC"]],
    });
    if (req.query.mine === "1") rows = rows.filter((t) => t.assignees.some((a) => same(a.id, req.user.id)));
    res.json(rows);
  } catch (e) { next(e); }
};

export const createTask = async (req, res, next) => {
  try {
    const b = req.body;
    const title = String(b.title || "").trim();
    if (!title || title.length > 200) return res.status(422).json({ message: "Judul tugas wajib diisi (maks. 200 karakter)" });
    const priority = b.priority ?? "medium";
    if (!PRIORITY.includes(priority)) return res.status(422).json({ message: "Prioritas tidak valid" });
    const dl = parseDate(b.deadline_at);
    if (dl.error) return res.status(422).json({ message: "Format deadline tidak valid" });
    const asg = await validAssignees(req.wid, b.assignee_ids);
    if (asg.error) return res.status(422).json({ message: asg.error });
    if ((await WorkspaceTask.count({ where: { workspace_id: req.wid } })) >= 1000)
      return res.status(400).json({ message: "Batas 1000 tugas per ruang tercapai" });

    const task = await sequelize.transaction(async (t) => {
      const task = await WorkspaceTask.create({
        workspace_id: req.wid, created_by: req.user.id, title, priority,
        description: String(b.description || "").trim().slice(0, 3000) || null,
        deadline_at: dl.value ?? null,
      }, { transaction: t });
      await task.setAssignees(asg.ids, { transaction: t });
      return task;
    });

    await logActivity(req.wid, req.user.id, `membuat tugas “${title}”`);
    if (asg.ids.length) {
      await notify({
        workspaceId: req.wid, userIds: asg.ids, type: "task", exceptUserId: req.user.id,
        key: `task_assigned:${task.id}`,
        text: [`📝 *Tugas baru untukmu*`, `Ruang: ${await workspaceName(req.wid)}`, `Tugas: *${title}*`,
          `Prioritas: ${PRIO_LABEL[priority]}`, ...(task.deadline_at ? [`Deadline: ${when(task.deadline_at)}`] : []),
          "", link(`/together/${req.wid}?tab=tasks`)].join("\n"),
      });
    }
    res.status(201).json(await loadTask(task.id, req.wid));
  } catch (e) { next(e); }
};

export const updateTask = async (req, res, next) => {
  try {
    const t = await loadTask(req.params.tid, req.wid);
    if (!t) return res.status(404).json({ message: "Tugas tidak ditemukan" });

    const me = req.user.id;
    const isCreator = same(t.created_by, me);
    const isAssignee = t.assignees.some((a) => same(a.id, me));
    const full = isCreator || isAdmin(req.member);
    if (!full && !isAssignee) return res.status(403).json({ message: "Akses ditolak" });

    const b = req.body;
    const patch = {};

    // semua yang berhak boleh memperbarui status dan progres
    if (b.status !== undefined) {
      if (!TSTATUS.includes(b.status)) return res.status(422).json({ message: "Status tidak valid" });
      patch.status = b.status;
    }
    if (b.progress !== undefined) {
      const p = Number(b.progress);
      if (!Number.isInteger(p) || p < 0 || p > 100) return res.status(422).json({ message: "Progres 0-100" });
      patch.progress = p;
    }
    if (patch.progress === 100 && patch.status === undefined && t.status !== "done") patch.status = "done";
    if (patch.status === "done") { patch.progress = 100; if (t.status !== "done") patch.completed_at = new Date(); }
    else if (patch.status && t.status === "done") patch.completed_at = null;

    // hanya pembuat dan admin yang boleh mengubah isi tugas
    let newAsg = null;
    let newDeadline;
    if (full) {
      if (b.title !== undefined) {
        const title = String(b.title).trim();
        if (!title || title.length > 200) return res.status(422).json({ message: "Judul tugas tidak valid" });
        patch.title = title;
      }
      if (b.description !== undefined) patch.description = String(b.description).trim().slice(0, 3000) || null;
      if (b.priority !== undefined) {
        if (!PRIORITY.includes(b.priority)) return res.status(422).json({ message: "Prioritas tidak valid" });
        patch.priority = b.priority;
      }
      const dl = parseDate(b.deadline_at);
      if (dl.error) return res.status(422).json({ message: "Format deadline tidak valid" });
      if (!dl.skip) { patch.deadline_at = dl.value; newDeadline = dl.value; }
      if (b.assignee_ids !== undefined) {
        const asg = await validAssignees(req.wid, b.assignee_ids);
        if (asg.error) return res.status(422).json({ message: asg.error });
        newAsg = asg.ids;
      }
    }

    const before = {
      deadline: t.deadline_at ? +new Date(t.deadline_at) : null,
      status: t.status,
      asg: t.assignees.map((a) => String(a.id)),
    };
    await sequelize.transaction(async (tx) => {
      await t.update(patch, { transaction: tx });
      if (newAsg) await t.setAssignees(newAsg, { transaction: tx });
    });

    const after = await loadTask(t.id, req.wid);
    const now = after.assignees.map((a) => String(a.id));
    const added = now.filter((x) => !before.asg.includes(x));
    const wName = await workspaceName(req.wid);
    const tail = link(`/together/${req.wid}?tab=tasks`);

    if (added.length && after.status !== "done") {
      await notify({
        workspaceId: req.wid, userIds: added, type: "task", exceptUserId: me, key: `task_assigned:${after.id}`,
        text: [`📝 *Kamu ditugaskan*`, `Ruang: ${wName}`, `Tugas: *${after.title}*`,
          ...(after.deadline_at ? [`Deadline: ${when(after.deadline_at)}`] : []), "", tail].join("\n"),
      });
    }
    const dlNow = after.deadline_at ? +new Date(after.deadline_at) : null;
    if (newDeadline !== undefined && dlNow !== before.deadline && dlNow) {
      await logActivity(req.wid, me, `mengubah deadline “${after.title}” menjadi ${when(after.deadline_at)}`);
      await notify({
        workspaceId: req.wid, userIds: now.filter((x) => !added.includes(x)), type: "task", exceptUserId: me,
        key: `task_deadline_changed:${after.id}:${dlNow}`,
        text: [`📅 *Deadline tugas diubah*`, `Ruang: ${wName}`, `Tugas: *${after.title}*`,
          `Deadline baru: ${when(after.deadline_at)}`, "", tail].join("\n"),
      });
    }
    if (before.status !== "done" && after.status === "done") {
      await logActivity(req.wid, me, `menyelesaikan tugas “${after.title}”`);
      await notify({
        workspaceId: req.wid, userIds: [after.created_by], type: "update", exceptUserId: me,
        key: `task_done:${after.id}:${+new Date(after.completed_at)}`,
        text: [`✅ *Tugas selesai*`, `Ruang: ${wName}`, `Tugas: *${after.title}*`, "", tail].join("\n"),
      });
    }
    res.json(after);
  } catch (e) { next(e); }
};

export const deleteTask = async (req, res, next) => {
  try {
    const t = await WorkspaceTask.findOne({ where: { id: req.params.tid, workspace_id: req.wid } });
    if (!t) return res.status(404).json({ message: "Tugas tidak ditemukan" });
    if (!same(t.created_by, req.user.id) && !isAdmin(req.member))
      return res.status(403).json({ message: "Hanya pembuat tugas atau admin yang bisa menghapus" });
    await t.destroy();
    res.json({ message: "Tugas dihapus" });
  } catch (e) { next(e); }
};

/* ================= Meeting ================= */
const MEETING_INCLUDE = [
  { model: User, as: "attendees", attributes: ["id", "name", "avatar_url"], through: { attributes: ["rsvp"] } },
  { model: User, as: "creator", attributes: ["id", "name"] },
];
const loadMeeting = (id, wid) => WorkspaceMeeting.findOne({ where: { id, workspace_id: wid }, include: MEETING_INCLUDE });

const fmtMeeting = (uid) => (m) => {
  const j = m.toJSON();
  const attendees = (j.attendees || []).map((a) => ({
    id: a.id, name: a.name, avatar_url: a.avatar_url, rsvp: a.MeetingAttendee?.rsvp || "pending",
  }));
  return { ...j, attendees, my_rsvp: attendees.find((a) => same(a.id, uid))?.rsvp || "pending" };
};

function parseMeeting(b, cur = {}) {
  const title = String(b.title ?? cur.title ?? "").trim();
  if (!title || title.length > 200) return { error: "Judul meeting wajib diisi (maks. 200 karakter)" };
  const starts = new Date(b.starts_at ?? cur.starts_at);
  const ends = new Date(b.ends_at ?? cur.ends_at);
  if (Number.isNaN(+starts) || Number.isNaN(+ends)) return { error: "Tanggal atau jam tidak valid" };
  if (ends <= starts) return { error: "Waktu selesai harus setelah waktu mulai" };
  if (ends - starts > 24 * 3600 * 1000) return { error: "Durasi meeting maksimal 24 jam" };

  let url = String(b.meeting_url ?? cur.meeting_url ?? "").trim() || null;
  if (url) {
    try {
      const u = new URL(url);
      if (!["http:", "https:"].includes(u.protocol)) throw new Error("protokol");
      url = u.toString();
    } catch { return { error: "Tautan meeting harus berupa URL http atau https" }; }
    if (url.length > 500) return { error: "Tautan meeting terlalu panjang" };
  }
  return {
    data: {
      title, starts_at: starts, ends_at: ends, meeting_url: url,
      agenda: String(b.agenda ?? cur.agenda ?? "").trim().slice(0, 3000) || null,
    },
  };
}

const meetText = (head, wName, m, extra = []) =>
  [head, `Ruang: ${wName}`, `Meeting: *${m.title}*`,
    `Waktu: ${when(m.starts_at)} - ${timeOnly(m.ends_at)}`,
    ...(m.meeting_url ? [`Link: ${m.meeting_url}`] : []), ...extra].join("\n");

export const listMeetings = async (req, res, next) => {
  try {
    const past = req.query.past === "1";
    const rows = await WorkspaceMeeting.findAll({
      where: { workspace_id: req.wid, ends_at: past ? { [Op.lt]: new Date() } : { [Op.gte]: new Date() } },
      include: MEETING_INCLUDE,
      order: [["starts_at", past ? "DESC" : "ASC"]],
    });
    res.json(rows.slice(0, past ? 50 : 200).map(fmtMeeting(req.user.id)));
  } catch (e) { next(e); }
};

export const createMeeting = async (req, res, next) => {
  try {
    const { data, error } = parseMeeting(req.body);
    if (error) return res.status(422).json({ message: error });

    const members = await WorkspaceMember.findAll({ where: { workspace_id: req.wid }, attributes: ["user_id"] });
    const meeting = await sequelize.transaction(async (t) => {
      const m = await WorkspaceMeeting.create({ ...data, workspace_id: req.wid, created_by: req.user.id }, { transaction: t });
      await MeetingAttendee.bulkCreate(
        members.map((x) => ({ meeting_id: m.id, user_id: x.user_id, rsvp: same(x.user_id, req.user.id) ? "accepted" : "pending" })),
        { transaction: t }
      );
      return m;
    });

    await logActivity(req.wid, req.user.id, `menjadwalkan meeting “${data.title}”`);
    await notify({
      workspaceId: req.wid, userIds: members.map((x) => x.user_id), type: "meeting", exceptUserId: req.user.id,
      key: `meeting_new:${meeting.id}`,
      text: meetText("📅 *Undangan meeting*", await workspaceName(req.wid), meeting,
        ["", link(`/together/${req.wid}?tab=meetings`)]),
    });
    res.status(201).json(fmtMeeting(req.user.id)(await loadMeeting(meeting.id, req.wid)));
  } catch (e) { next(e); }
};

export const updateMeeting = async (req, res, next) => {
  try {
    const m = await loadMeeting(req.params.mid, req.wid);
    if (!m) return res.status(404).json({ message: "Meeting tidak ditemukan" });
    if (!same(m.created_by, req.user.id) && !isAdmin(req.member)) return res.status(403).json({ message: "Akses ditolak" });
    if (m.status === "cancelled") return res.status(400).json({ message: "Meeting sudah dibatalkan" });

    const { data, error } = parseMeeting(req.body, m);
    if (error) return res.status(422).json({ message: error });

    const timeChanged = +data.starts_at !== +new Date(m.starts_at) || +data.ends_at !== +new Date(m.ends_at);
    const urlChanged = (data.meeting_url || "") !== (m.meeting_url || "");

    await m.update(data);
    if (timeChanged)
      await MeetingAttendee.update({ rsvp: "pending" }, { where: { meeting_id: m.id, user_id: { [Op.ne]: req.user.id } } });

    if (timeChanged || urlChanged) {
      const att = await MeetingAttendee.findAll({ where: { meeting_id: m.id } });
      await notify({
        workspaceId: req.wid, userIds: att.map((a) => a.user_id), type: "meeting", exceptUserId: req.user.id,
        key: `meeting_changed:${m.id}:${Date.now()}`,
        text: meetText("🔔 *Meeting diubah*", await workspaceName(req.wid), m,
          ["", link(`/together/${req.wid}?tab=meetings`)]),
      });
      await logActivity(req.wid, req.user.id, `mengubah jadwal meeting “${m.title}”`);
    }
    res.json(fmtMeeting(req.user.id)(await loadMeeting(m.id, req.wid)));
  } catch (e) { next(e); }
};

export const cancelMeeting = async (req, res, next) => {
  try {
    const m = await WorkspaceMeeting.findOne({ where: { id: req.params.mid, workspace_id: req.wid } });
    if (!m) return res.status(404).json({ message: "Meeting tidak ditemukan" });
    if (!same(m.created_by, req.user.id) && !isAdmin(req.member)) return res.status(403).json({ message: "Akses ditolak" });
    if (m.status === "cancelled") return res.json({ message: "Meeting sudah dibatalkan" });

    await m.update({ status: "cancelled" });
    const att = await MeetingAttendee.findAll({ where: { meeting_id: m.id } });
    await notify({
      workspaceId: req.wid, userIds: att.map((a) => a.user_id), type: "meeting", exceptUserId: req.user.id,
      key: `meeting_cancel:${m.id}`,
      text: meetText("❌ *Meeting dibatalkan*", await workspaceName(req.wid), { ...m.toJSON(), meeting_url: null }),
    });
    await logActivity(req.wid, req.user.id, `membatalkan meeting “${m.title}”`);
    res.json({ message: "Meeting dibatalkan" });
  } catch (e) { next(e); }
};

export const rsvp = async (req, res, next) => {
  try {
    const response = req.body.response;
    if (!["accepted", "declined"].includes(response)) return res.status(422).json({ message: "Respons tidak valid" });
    const m = await WorkspaceMeeting.findOne({ where: { id: req.params.mid, workspace_id: req.wid } });
    if (!m) return res.status(404).json({ message: "Meeting tidak ditemukan" });
    if (m.status === "cancelled") return res.status(400).json({ message: "Meeting sudah dibatalkan" });
    await MeetingAttendee.upsert({ meeting_id: m.id, user_id: req.user.id, rsvp: response });
    res.json({ my_rsvp: response });
  } catch (e) { next(e); }
};

/* ================= Kalender ================= */
export const calendar = async (req, res, next) => {
  try {
    const start = new Date(req.query.start);
    const end = new Date(req.query.end);
    if (Number.isNaN(+start) || Number.isNaN(+end) || end <= start || end - start > 62 * 86400000)
      return res.status(422).json({ message: "Rentang tanggal tidak valid (maks. 62 hari)" });

    const [tasks, meetings] = await Promise.all([
      WorkspaceTask.findAll({
        where: { workspace_id: req.wid, deadline_at: { [Op.gte]: start, [Op.lt]: end } },
        attributes: ["id", "title", "status", "priority", "deadline_at"],
        include: [{ model: User, as: "assignees", attributes: ["id", "name"], through: { attributes: [] } }],
        order: [["deadline_at", "ASC"]],
      }),
      WorkspaceMeeting.findAll({
        where: { workspace_id: req.wid, status: "scheduled", starts_at: { [Op.gte]: start, [Op.lt]: end } },
        attributes: ["id", "title", "starts_at", "ends_at", "meeting_url"],
        order: [["starts_at", "ASC"]],
      }),
    ]);
    res.json({ tasks, meetings });
  } catch (e) { next(e); }
};