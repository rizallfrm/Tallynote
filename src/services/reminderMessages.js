const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const human = (ms) => {
  const m = Math.max(1, Math.round(Math.abs(ms) / 60000));
  if (m < 60) return `${m} menit`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} jam` : `${Math.round(h / 24)} hari`;
};

export function buildReminder({ user, activity, stage }) {
  const tz = user.timezone || "Asia/Jakarta";
  const when = new Date(activity.deadline_at).toLocaleString("id-ID", {
    timeZone: tz, dateStyle: "full", timeStyle: "short",
  });
  const ms = new Date(activity.deadline_at) - Date.now();
  const remaining = ms > 0 ? `sisa ${human(ms)}` : `terlambat ${human(ms)}`;
  const link = `${process.env.APP_URL || process.env.CLIENT_URL || ""}/activities/${activity.id}`;
  const name = (user.name || "").split(" ")[0] || "kamu";
  const cat = activity.Category?.name;

  const heading = {
    "24h": "Deadline kurang dari 24 jam lagi",
    "2h": `Deadline tinggal ${human(ms)} lagi`,
    overdue: "Deadline sudah terlewat",
  }[stage];
  const closing = stage === "overdue"
    ? "Jika sudah selesai, tandai selesai di aplikasi. Jika belum, yuk segera dituntaskan."
    : "Yuk segera dikerjakan supaya tidak terlambat!";

  const text = [
    `Halo ${name}! ⏰`,
    `*${heading}*`,
    "",
    `Tugas: *${activity.title}*`,
    ...(cat ? [`Kategori: ${cat}`] : []),
    `Deadline: ${when}`,
    `Status: ${remaining}`,
    "",
    closing,
    link,
  ].join("\n");

  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#2b2723">
  <div style="background:#6a7850;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0;font-size:16px;font-weight:bold">${esc(heading)}</div>
  <div style="border:1px solid #eae2d6;border-top:0;padding:20px;border-radius:0 0 12px 12px">
    <p>Halo ${esc(name)},</p>
    <p style="font-size:18px;font-weight:bold;margin:8px 0">${esc(activity.title)}</p>
    <table style="font-size:14px;color:#555"><tr><td style="padding:2px 12px 2px 0">Deadline</td><td><b>${esc(when)}</b></td></tr>
    ${cat ? `<tr><td style="padding:2px 12px 2px 0">Kategori</td><td>${esc(cat)}</td></tr>` : ""}
    <tr><td style="padding:2px 12px 2px 0">Status</td><td>${esc(remaining)}</td></tr></table>
    <p>${esc(closing)}</p>
    <p><a href="${esc(link)}" style="display:inline-block;background:#6a7850;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none">Buka aktivitas</a></p>
    <p style="font-size:12px;color:#999">Matikan pengingat di menu Akun → Pengingat deadline.</p>
  </div></div>`;

  return {
    subject: `${stage === "overdue" ? "Terlewat" : "Pengingat"}: ${activity.title}`,
    text, html,
    waParams: [name, activity.title, when, remaining], // untuk template WhatsApp Cloud API
  };
}