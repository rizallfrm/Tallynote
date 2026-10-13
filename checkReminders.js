import "dotenv/config";
import {
  Activity,
  ReminderLog,
  User,
  UserSetting,
  sequelize,
} from "./src/models/index.js";
import { emailConfigured } from "./src/services/mailer.js";

console.log("SMTP terkonfigurasi:", emailConfigured());
console.log(
  "ENABLE_SCHEDULER:",
  process.env.ENABLE_SCHEDULER ?? "(kosong = aktif)",
);
console.log(
  "Model Activity punya deadline_at:",
  !!Activity.rawAttributes.deadline_at,
);

const rows = await Activity.findAll({
  order: [["id", "DESC"]],
  limit: 8,
  include: [{ model: User, include: [UserSetting] }, ReminderLog],
});

for (const a of rows) {
  const ms = a.deadline_at ? new Date(a.deadline_at) - Date.now() : null;
  const why = [];
  if (!a.deadline_at) why.push("TIDAK ADA deadline");
  else if (ms > 24 * 3600e3)
    why.push(
      `deadline masih ${(ms / 3600e3).toFixed(1)} jam lagi (>24 jam, belum waktunya)`,
    );
  else if (ms < -24 * 3600e3)
    why.push("deadline lewat >24 jam, tidak diingatkan lagi");
  if (a.status === "completed") why.push("status Selesai");
  if (!a.User?.email_verified_at) why.push("EMAIL USER BELUM TERVERIFIKASI");
  if (a.User?.UserSetting?.notify_email === false)
    why.push("notif email dimatikan");
  if (a.User?.UserSetting?.notify_whatsapp && !a.User?.phone)
    why.push("nomor WhatsApp kosong");
  if (
    a.User?.UserSetting?.notify_whatsapp &&
    a.User?.phone &&
    !a.User?.phone_verified_at
  )
    why.push("NOMOR WHATSAPP BELUM TERVERIFIKASI");
  if (!a.User?.UserSetting?.notify_whatsapp)
    why.push("notif WhatsApp dimatikan");

  console.log(`\n#${a.id} "${a.title}" [${a.status}]`);
  console.log(
    "  deadline:",
    a.deadline_at,
    ms == null ? "" : `(${(ms / 60000).toFixed(0)} menit)`,
  );
  console.log("  user:", a.User?.email);
  console.log(
    "  log:",
    a.ReminderLogs.map(
      (l) =>
        `${l.stage}/${l.channel}/${l.status}x${l.attempts}${l.error ? " " + l.error : ""}`,
    ).join(" | ") || "-",
  );
  console.log(
    "  ->",
    why.length ? "DILEWATI: " + why.join("; ") : "seharusnya terkirim",
  );
}
await sequelize.close();
