import { Op } from "sequelize";
import { Activity, Category, ReminderLog, User, UserSetting } from "../models/index.js";
import { buildReminder } from "./reminderMessages.js";
import { emailConfigured, sendEmail } from "./mailer.js";
import { sendWhatsApp, whatsappConfigured } from "./whatsapp.js";

const HOUR = 3600 * 1000;
const MAX_ATTEMPTS = 6;
const RETRY_DELAY_MS = 10 * 60 * 1000;
let running = false;
const warned = new Set();

const currentStage = (ms) => (ms <= 0 ? "overdue" : ms <= 2 * HOUR ? "2h" : "24h");

async function send(channel, user, msg) {
  if (channel === "email")
    return sendEmail({ to: user.email, subject: msg.subject, text: msg.text, html: msg.html });
  return sendWhatsApp({ to: user.phone, text: msg.text, params: msg.waParams });
}

async function deliver(activity, user, stage, channel) {
  let log, created;
  try {
    [log, created] = await ReminderLog.findOrCreate({
      where: { activity_id: activity.id, stage, channel },
      defaults: { status: "pending", attempts: 0 },
    });
  } catch (e) {
    if (e.name === "SequelizeUniqueConstraintError") return;
    throw e;
  }

  if (!created) {
    if (log.status === "sent" || log.attempts >= MAX_ATTEMPTS) return;
    if (log.status === "pending" && Date.now() - new Date(log.updated_at) < 2 * 60 * 1000) return;
    if (log.status === "failed" && Date.now() - new Date(log.updated_at) < RETRY_DELAY_MS) return;
  }

  await log.update({ status: "pending", attempts: log.attempts + 1 });
  try {
    await send(channel, user, buildReminder({ user, activity, stage }));
    await log.update({ status: "sent", error: null });
    console.log(`Reminder ${stage} -> ${channel} (aktivitas #${activity.id}) terkirim`);
  } catch (e) {
    await log.update({ status: "failed", error: String(e.message).slice(0, 500) });
    console.error(`Reminder ${stage} -> ${channel} (aktivitas #${activity.id}) gagal:`, e.message);
  }
}

export async function runReminderCheck() {
  if (running) return;
  running = true;
  try {
    const now = Date.now();
    const activities = await Activity.findAll({
      where: {
        status: { [Op.ne]: "completed" },
        deadline_at: { [Op.between]: [new Date(now - 24 * HOUR), new Date(now + 24 * HOUR)] },
      },
      include: [
        Category,
        {
          model: User,
          attributes: ["id", "name", "email", "phone", "timezone", "email_verified_at", "phone_verified_at"],
          include: [{ model: UserSetting }],
        },
      ],
    });

    for (const a of activities) {
      const user = a.User;
      if (!user) continue;
      const stage = currentStage(new Date(a.deadline_at) - now);
      const prefs = user.UserSetting;

      const channels = [];
      const skip = [];

      // email
      if (prefs?.notify_email === false) skip.push("email dimatikan");
      else if (!user.email_verified_at) skip.push("email belum terverifikasi");
      else if (!emailConfigured()) skip.push("SMTP belum dikonfigurasi");
      else channels.push("email");

      // whatsapp
      if (!prefs?.notify_whatsapp) skip.push("WhatsApp dimatikan");
      else if (!user.phone) skip.push("nomor WhatsApp kosong");
      else if (!user.phone_verified_at) skip.push("nomor WhatsApp belum terverifikasi");
      else if (!whatsappConfigured()) skip.push("WhatsApp belum dikonfigurasi");
      else channels.push("whatsapp");

      const key = `${a.id}:${skip.join()}`;
      if (skip.length && !warned.has(key)) {
        warned.add(key);
        console.log(`Reminder aktivitas #${a.id}: saluran dilewati (${skip.join(", ")})`);
      }

      for (const ch of channels) await deliver(a, user, stage, ch);
    }
  } catch (e) {
    console.error("Scheduler error:", e.message);
  } finally {
    running = false;
  }
}

export function startScheduler() {
  if (process.env.ENABLE_SCHEDULER === "false") return console.log("Scheduler pengingat dimatikan");
  console.log("Scheduler pengingat deadline aktif (cek tiap 1 menit)");
  setTimeout(runReminderCheck, 5000);
  setInterval(runReminderCheck, 60 * 1000);
}