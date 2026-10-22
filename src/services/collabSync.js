import { Op, QueryTypes } from "sequelize";
import {
  Activity, Category, User, Workspace, WorkspaceMeeting, WorkspaceTask, sequelize,
} from "../models/index.js";
import { refreshDailySummary } from "./summary.service.js";
import { TZ, timeOnly, when } from "./collabNotifier.js";

const dayKey = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: TZ });
const STATUS = { todo: "planned", in_progress: "in_progress", done: "completed" };
const LINKED = { [Op.or]: [{ workspace_task_id: { [Op.ne]: null } }, { workspace_meeting_id: { [Op.ne]: null } }] };

let catId = null;
async function collabCategory() {
  if (catId) return catId;
  const [c] = await Category.findOrCreate({
    where: { name: "Kolaborasi" },
    defaults: { description: "Tugas dan meeting dari Tallynote Together", is_active: true },
  });
  return (catId = c.id);
}

// kumpulkan (user, tanggal) yang rekap hariannya perlu dihitung ulang
const bag = () => {
  const m = new Map();
  return {
    add: (u, d) => d && (m.get(String(u)) || m.set(String(u), new Set()).get(String(u))).add(d),
    async flush() {
      for (const [u, set] of m)
        for (const d of set) await refreshDailySummary(u, d).catch((e) => console.error("rekap:", e.message));
    },
  };
};

async function dropStale(where, keepIds, t) {
  const stale = await Activity.findAll({
    where: { ...where, ...(keepIds.length ? { user_id: { [Op.notIn]: keepIds } } : {}) },
  });
  for (const a of stale) {
    t.add(a.user_id, a.activity_date);
    if (a.status === "completed") await a.update({ workspace_task_id: null, workspace_meeting_id: null }); // riwayat tetap ada
    else await a.destroy();
  }
}

/* ============ Tugas ============ */
export async function syncTask(taskId) {
  const task = await WorkspaceTask.findByPk(taskId, {
    include: [
      { model: User, as: "assignees", attributes: ["id"], through: { attributes: [] } },
      { model: Workspace, attributes: ["name"] },
    ],
  });
  if (!task) return;

  const category_id = await collabCategory();
  const date = task.status === "done" && task.completed_at ? dayKey(task.completed_at)
    : task.deadline_at ? dayKey(task.deadline_at) : dayKey(task.created_at);
  const text = task.description || `Tugas dari ruang ${task.Workspace?.name || "Together"}`;
  const fields = {
    workspace_id: task.workspace_id, category_id, title: task.title.slice(0, 200),
    activity_date: date, status: STATUS[task.status] || "planned",
    deadline_at: task.deadline_at, description: text, activity_input: text,
  };

  const t = bag();
  const ids = task.assignees.map((a) => a.id);
  for (const uid of ids) {
    const [a, created] = await Activity.findOrCreate({
      where: { user_id: uid, workspace_task_id: task.id }, defaults: fields,
    });
    if (!created) { t.add(uid, a.activity_date); await a.update(fields); }
    t.add(uid, date);
  }
  await dropStale({ workspace_task_id: task.id }, ids, t);
  await t.flush();
}

// dipanggil sebelum tugas dihapus: yang belum selesai ikut hilang, yang selesai jadi riwayat biasa
export async function unlinkTask(taskId) {
  const t = bag();
  await dropStale({ workspace_task_id: taskId }, [], t);
  await t.flush();
}

/* ============ Meeting ============ */
export async function syncMeeting(meetingId) {
  const m = await WorkspaceMeeting.findByPk(meetingId, {
    include: [
      { model: User, as: "attendees", attributes: ["id"], through: { attributes: ["rsvp"] } },
      { model: Workspace, attributes: ["name"] },
    ],
  });
  if (!m) return;
  const t = bag();

  if (m.status === "cancelled") {
    const all = await Activity.findAll({ where: { workspace_meeting_id: m.id } });
    for (const a of all) { t.add(a.user_id, a.activity_date); await a.destroy(); }
    return t.flush();
  }

  const category_id = await collabCategory();
  const date = dayKey(m.starts_at);
  const desc = [
    m.agenda || `Meeting di ruang ${m.Workspace?.name || "Together"}`,
    `Waktu: ${when(m.starts_at)} - ${timeOnly(m.ends_at)}`,
    ...(m.meeting_url ? [`Link: ${m.meeting_url}`] : []),
  ].join("\n");
  const fields = {
    workspace_id: m.workspace_id, category_id, title: `Meeting: ${m.title}`.slice(0, 200),
    activity_date: date, status: new Date(m.ends_at) < new Date() ? "completed" : "planned",
    deadline_at: null, description: desc, activity_input: desc,
  };

  const accepted = m.attendees.filter((a) => a.MeetingAttendee?.rsvp === "accepted").map((a) => a.id);
  for (const uid of accepted) {
    const [a, created] = await Activity.findOrCreate({
      where: { user_id: uid, workspace_meeting_id: m.id }, defaults: fields,
    });
    if (!created) { t.add(uid, a.activity_date); await a.update(fields); }
    t.add(uid, date);
  }
  await dropStale({ workspace_meeting_id: m.id }, accepted, t);
  await t.flush();
}

// meeting yang sudah berakhir otomatis menjadi Selesai (dipanggil scheduler)
export async function completeEndedMeetings() {
  const rows = await sequelize.query(
    `UPDATE activities a SET status = 'completed', updated_at = NOW()
       FROM workspace_meetings m
      WHERE a.workspace_meeting_id = m.id AND m.status = 'scheduled'
        AND m.ends_at < NOW() AND a.status <> 'completed'
      RETURNING a.user_id, a.activity_date`,
    { type: QueryTypes.SELECT }
  );
  const t = bag();
  rows.forEach((r) => t.add(r.user_id, r.activity_date));
  await t.flush();
}

/* ============ Sinkron otomatis (self-heal) ============ */
// Memastikan semua tugas dan meeting milik user sudah punya aktivitas tertaut yang akurat.
// Dipanggil saat user membuka Rekap, Riwayat, atau Beranda. Dibatasi 1x per 30 detik per user.
const lastEnsure = new Map();

export async function ensureUserSynced(userId, { force = false } = {}) {
  const key = String(userId);
  if (!force && Date.now() - (lastEnsure.get(key) || 0) < 30000) return;
  lastEnsure.set(key, Date.now());

  try {
    const rep = { replacements: { uid: userId }, type: QueryTypes.SELECT };

    // tugas yang belum punya aktivitas, atau datanya berbeda dari tugas aslinya
    const tasks = await sequelize.query(
      `SELECT t.id
         FROM workspace_task_assignees s
         JOIN workspace_tasks t ON t.id = s.task_id
         LEFT JOIN activities x ON x.user_id = s.user_id AND x.workspace_task_id = t.id
        WHERE s.user_id = :uid
          AND (x.id IS NULL
            OR x.title <> LEFT(t.title, 200)
            OR x.status <> CASE t.status WHEN 'done' THEN 'completed' WHEN 'in_progress' THEN 'in_progress' ELSE 'planned' END
            OR x.deadline_at IS DISTINCT FROM t.deadline_at)`,
      rep
    );

    // meeting yang sudah kamu terima tetapi belum punya aktivitas
    const meetings = await sequelize.query(
      `SELECT m.id
         FROM workspace_meeting_attendees s
         JOIN workspace_meetings m ON m.id = s.meeting_id
         LEFT JOIN activities x ON x.user_id = s.user_id AND x.workspace_meeting_id = m.id
        WHERE s.user_id = :uid AND s.rsvp = 'accepted' AND m.status = 'scheduled' AND x.id IS NULL`,
      rep
    );

    for (const r of tasks) await syncTask(r.id);
    for (const r of meetings) await syncMeeting(r.id);
    await completeEndedMeetings();

    if (tasks.length || meetings.length)
      console.log(`Sinkron otomatis user #${userId}: ${tasks.length} tugas, ${meetings.length} meeting`);
  } catch (e) {
    console.error("ensureUserSynced gagal:", e.name, e.message || "(tanpa pesan)", e.parent?.message || "");
  }
}

/* ============ Anggota keluar dan ruang dihapus ============ */
export async function removeUserFromWorkspace(wid, uid) {
  const t = bag();
  const rows = await Activity.findAll({
    where: { workspace_id: wid, user_id: uid, status: { [Op.ne]: "completed" }, ...LINKED },
  });
  for (const a of rows) { t.add(a.user_id, a.activity_date); await a.destroy(); }
  await t.flush();
}

export async function removeWorkspaceActivities(wid) {
  const t = bag();
  const rows = await Activity.findAll({
    where: { workspace_id: wid, status: { [Op.ne]: "completed" }, ...LINKED },
  });
  for (const a of rows) { t.add(a.user_id, a.activity_date); await a.destroy(); }
  await t.flush();
}