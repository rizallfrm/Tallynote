import { Op } from "sequelize";
import {
  MeetingAttendee, NotificationOutbox, User, UserSetting, Workspace, WorkspaceMeeting,
  WorkspaceMember, WorkspacePost, WorkspaceTask,
} from "../models/index.js";
import { sendWhatsApp, whatsappConfigured } from "./whatsapp.js";

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const MAX_ATTEMPTS = 5;
export const TZ = process.env.APP_TZ || "Asia/Jakarta";
const PREF = {
  task: "collab_notify_task", deadline: "collab_notify_deadline",
  meeting: "collab_notify_meeting", update: "collab_notify_update",
};
let busy = false;

/* ================= Helper (dipakai controller lain) ================= */
export const when = (d) =>
  new Date(d).toLocaleString("id-ID", { timeZone: TZ, dateStyle: "full", timeStyle: "short" });
export const timeOnly = (d) =>
  new Date(d).toLocaleTimeString("id-ID", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
export const link = (path) =>
  `${process.env.APP_URL || (process.env.CLIENT_URL || "").split(",")[0].trim()}${path}`;
export const workspaceName = async (id) =>
  (await Workspace.findByPk(id, { attributes: ["name"] }))?.name || "Tallynote";

// "9 menit", "1 jam 20 menit", "2 hari 3 jam"
export function span(ms) {
  const m = Math.max(1, Math.round(Math.abs(ms) / MIN));
  if (m < 60) return `${m} menit`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 ? `${h} jam ${m % 60} menit` : `${h} jam`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d} hari ${h % 24} jam` : `${d} hari`;
}

export const logActivity = (workspace_id, user_id, body) =>
  WorkspacePost.create({ workspace_id, user_id, kind: "activity", body: String(body).slice(0, 500) })
    .catch((e) => console.error("logActivity:", e.message));

/* ================= Antrean notifikasi ================= */
/**
 * Masukkan notifikasi ke antrean. Tidak pernah melempar error.
 * Kunci (user_id, event_key) unik, jadi event yang sama tidak dikirim dua kali.
 */
export async function notify({ workspaceId, userIds, type, key, text, exceptUserId }) {
  try {
    const ids = [...new Set((userIds || []).map(String))].filter((u) => u && u !== String(exceptUserId));
    if (!ids.length) return;
    await NotificationOutbox.bulkCreate(
      ids.map((user_id) => ({ user_id, workspace_id: workspaceId, type, event_key: key, text })),
      { ignoreDuplicates: true }
    );
    setImmediate(() => processOutbox().catch(() => {}));
  } catch (e) {
    console.error("notify gagal:", e.name, e.message || "(tanpa pesan)");
  }
}

async function deliver(row, attempt) {
  const set = (status, error = null, extra = {}) =>
    NotificationOutbox.update({ status, error, ...extra }, { where: { id: row.id } });
  try {
    const user = await User.findByPk(row.user_id, { include: [UserSetting] });
    const s = user?.UserSetting;

    // kelayakan penerima diperiksa di server, saat pengiriman
    let why = null;
    if (!user?.phone || !user.phone_verified_at) why = "nomor WhatsApp belum terverifikasi";
    else if (!s?.notify_whatsapp) why = "notifikasi WhatsApp dimatikan";
    else if (s[PREF[row.type]] === false) why = `preferensi ${row.type} dimatikan`;
    else if (!whatsappConfigured()) why = "WhatsApp belum dikonfigurasi";
    else if (row.workspace_id &&
      !(await WorkspaceMember.findOne({ where: { workspace_id: row.workspace_id, user_id: row.user_id } })))
      why = "bukan anggota ruang";
    if (why) return await set("skipped", why);

    await sendWhatsApp({
      to: user.phone,
      text: row.text,
      template: process.env.WA_COLLAB_TEMPLATE_NAME, // hanya dipakai Cloud API
      params: [row.text.replace(/\s*\n+\s*/g, " | ")],
    });
    await set("sent");
    console.log(`Together WA (${row.type}) -> user #${row.user_id} terkirim`);
  } catch (e) {
    console.error(`Together WA #${row.id} gagal:`, e.message);
    await set(attempt >= MAX_ATTEMPTS ? "failed" : "pending", String(e.message).slice(0, 500), {
      next_attempt_at: new Date(Date.now() + attempt * 5 * MIN),
    });
  }
}

export async function processOutbox() {
  if (busy) return;
  busy = true;
  try {
    // pulihkan baris yang tersangkut di "sending" (server mati saat mengirim)
    await NotificationOutbox.update(
      { status: "pending" },
      { where: { status: "sending", updated_at: { [Op.lt]: new Date(Date.now() - 5 * MIN) } } }
    );
    const rows = await NotificationOutbox.findAll({
      where: { status: "pending", next_attempt_at: { [Op.lte]: new Date() } },
      order: [["id", "ASC"]], limit: 20,
    });
    for (const row of rows) {
      // klaim atomik: hanya satu proses yang berhasil mengirim baris ini
      const [claimed] = await NotificationOutbox.update(
        { status: "sending", attempts: row.attempts + 1 },
        { where: { id: row.id, status: "pending" } }
      );
      if (!claimed) continue;
      await deliver(row, row.attempts + 1);
      await new Promise((r) => setTimeout(r, 400)); // jeda agar tidak dianggap spam
    }
  } catch (e) {
    console.error("Outbox error:", e.name, e.message || "(tanpa pesan)");
  } finally {
    busy = false;
  }
}

/* ================= Pengingat deadline ================= */
// Urut dari jauh ke dekat. skipIfNew: dilewati jika tugas baru dibuat atau diubah
// setelah jendela tahap itu dimulai (notifikasi penugasan sudah memberi tahu deadline-nya).
const TASK_STAGES = [
  { id: "24h", at: 24 * HOUR, skipIfNew: true },
  { id: "2h", at: 2 * HOUR, skipIfNew: true },
  { id: "30m", at: 30 * MIN, skipIfNew: true },
  { id: "5m", at: 5 * MIN },
  { id: "due", at: 0 },
  { id: "late", at: -15 * MIN },
];
const MEETING_STAGES = [
  { id: "1h", at: HOUR, skipIfNew: true },
  { id: "10m", at: 10 * MIN },
  { id: "start", at: 0 },
];

// tahap terakhir yang kondisinya sudah terpenuhi
function currentStage(stages, ms) {
  let cur = null;
  for (const s of stages) if (ms <= s.at) cur = s;
  return cur;
}

function taskText(stage, t, ms, wsName) {
  const head = {
    "24h": "⏰ *Deadline kurang dari 24 jam lagi*",
    "2h": "⏰ *Deadline kurang dari 2 jam lagi*",
    "30m": "⏰ *Deadline tinggal sekitar 30 menit*",
    "5m": "🔔 *Deadline sebentar lagi!*",
    due: "🚨 *Waktunya! Deadline tugas sudah tiba*",
    late: "⚠️ *Deadline sudah terlewat*",
  }[stage];

  const status =
    ms > 0 ? `Sisa waktu: ${span(ms)}`
    : Math.abs(ms) < 2 * MIN ? "Deadline: sekarang"
    : `Terlewat: ${span(ms)} yang lalu`;

  const closing =
    stage === "late"
      ? "Jika sudah selesai, tandai *Selesai* di Tallynote. Jika butuh waktu lebih, minta pembuat tugas atau admin memperpanjang deadline."
      : stage === "due"
      ? "Segera selesaikan tugas ini, lalu tandai *Selesai* di Tallynote."
      : "Yuk segera dikerjakan supaya tidak terlambat.";

  return [
    head, `Ruang: ${wsName}`, `Tugas: *${t.title}*`, `Deadline: ${when(t.deadline_at)}`, status,
    "", closing, link(`/together/${t.workspace_id}?tab=tasks`),
  ].join("\n");
}

function meetingText(stage, m, ms, wsName) {
  const head = {
    "1h": "🗓️ *Meeting dimulai kurang dari 1 jam lagi*",
    "10m": "🗓️ *Meeting dimulai sebentar lagi*",
    start: "🎥 *Meeting dimulai sekarang*",
  }[stage];
  const status = ms > 0 ? `Mulai dalam: ${span(ms)}` : "Mulai: sekarang";
  return [
    head, `Ruang: ${wsName}`, `Meeting: *${m.title}*`,
    `Waktu: ${when(m.starts_at)} - ${timeOnly(m.ends_at)}`, status,
    ...(m.meeting_url ? [`Link: ${m.meeting_url}`] : []),
  ].join("\n");
}

/** Memasukkan pengingat tugas dan meeting ke antrean. Dipanggil tiap siklus scheduler. */
export async function enqueueCollabReminders() {
  const now = Date.now();

  /* ---- tugas ---- */
  const tasks = await WorkspaceTask.findAll({
    where: {
      status: { [Op.ne]: "done" },
      deadline_at: { [Op.between]: [new Date(now - 24 * HOUR), new Date(now + 24 * HOUR)] },
    },
    include: [
      { model: User, as: "assignees", attributes: ["id"], through: { attributes: [] } },
      { model: Workspace, attributes: ["name"] },
    ],
  });

  for (const t of tasks) {
    const deadline = +new Date(t.deadline_at);
    const ms = deadline - now;
    const stage = currentStage(TASK_STAGES, ms);
    if (!stage) continue;
    if (stage.skipIfNew && +new Date(t.updated_at) > deadline - stage.at) continue;

    await notify({
      workspaceId: t.workspace_id,
      userIds: t.assignees.map((a) => a.id),
      type: "deadline",
      key: `task_deadline:${t.id}:${stage.id}:${deadline}`, // deadline diubah = rangkaian pengingat mulai ulang
      text: taskText(stage.id, t, ms, t.Workspace.name),
    });
  }

  /* ---- meeting ---- */
  const meetings = await WorkspaceMeeting.findAll({
    where: {
      status: "scheduled",
      starts_at: { [Op.between]: [new Date(now - 10 * MIN), new Date(now + HOUR)] },
    },
    include: [
      { model: User, as: "attendees", attributes: ["id"], through: { attributes: ["rsvp"] } },
      { model: Workspace, attributes: ["name"] },
    ],
  });

  for (const m of meetings) {
    const start = +new Date(m.starts_at);
    const ms = start - now;
    const stage = currentStage(MEETING_STAGES, ms);
    if (!stage) continue;
    if (stage.skipIfNew && +new Date(m.updated_at) > start - stage.at) continue;

    await notify({
      workspaceId: m.workspace_id,
      userIds: m.attendees.filter((a) => a.MeetingAttendee?.rsvp !== "declined").map((a) => a.id),
      type: "meeting",
      key: `meeting_reminder:${m.id}:${stage.id}:${start}`,
      text: meetingText(stage.id, m, ms, m.Workspace.name),
    });
  }
}