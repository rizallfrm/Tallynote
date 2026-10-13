import { User } from "../models/index.js";
import { sendEmail, emailConfigured } from "../services/mailer.js";
import { sendWhatsApp, whatsappConfigured } from "../services/whatsapp.js";
import { buildReminder } from "../services/reminderMessages.js";

export const test = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    const msg = buildReminder({
      user,
      stage: "2h",
      activity: {
        id: 0,
        title: "Contoh tugas: pengingat deadline",
        deadline_at: new Date(Date.now() + 2 * 3600 * 1000),
        Category: { name: "Tes" },
      },
    });

    try {
      if (req.body.channel === "email") {
        if (!emailConfigured()) return res.status(400).json({ message: "SMTP belum dikonfigurasi di server" });
        await sendEmail({ to: user.email, subject: `[Tes] ${msg.subject}`, text: msg.text, html: msg.html });
      } else if (req.body.channel === "whatsapp") {
        if (!user.phone) return res.status(400).json({ message: "Simpan nomor WhatsApp dulu" });
        if (!user.phone_verified_at) return res.status(400).json({ message: "Verifikasi nomor WhatsApp dulu" });
        if (!whatsappConfigured()) return res.status(400).json({ message: "WhatsApp belum dikonfigurasi di server" });
        await sendWhatsApp({ to: user.phone, text: `[TES]\n${msg.text}`, params: msg.waParams });
      } else {
        return res.status(422).json({ message: "Saluran tidak valid" });
      }
    } catch (e) {
      return res.status(502).json({ message: `Pengiriman gagal: ${e.message}` });
    }
    res.json({ message: "Pesan tes terkirim" });
  } catch (e) { next(e); }
};