import crypto from "crypto";
import bcrypt from "bcryptjs";
import { EmailOtp, PhoneOtp } from "../models/index.js";
import { sendEmail } from "./mailer.js";
import { sendWhatsApp } from "./whatsapp.js";

const TTL_MIN = 10;
const MAX_ATTEMPTS = 5;
const RESEND_SECONDS = 60;

const newCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, "0");

function throttle(last) {
  if (!last) return;
  const passed = Math.floor((Date.now() - new Date(last.created_at)) / 1000);
  if (passed < RESEND_SECONDS) {
    const err = new Error(`Tunggu ${RESEND_SECONDS - passed} detik sebelum meminta kode baru`);
    err.status = 429;
    throw err;
  }
}

/* ============ Email ============ */
export async function sendOtp(user) {
  throttle(await EmailOtp.findOne({ where: { user_id: user.id }, order: [["id", "DESC"]] }));

  const code = newCode();
  await EmailOtp.destroy({ where: { user_id: user.id } });
  await EmailOtp.create({
    user_id: user.id,
    code_hash: await bcrypt.hash(code, 8),
    expires_at: new Date(Date.now() + TTL_MIN * 60 * 1000),
  });

  await sendEmail({
    to: user.email,
    subject: `Kode verifikasi Tallynote: ${code}`,
    text: `Kode verifikasimu: ${code}\nBerlaku ${TTL_MIN} menit. Jangan bagikan kode ini ke siapa pun.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;color:#2b2723">
      <p>Halo ${user.name?.split(" ")[0] || ""},</p>
      <p>Masukkan kode berikut untuk memverifikasi emailmu:</p>
      <p style="font-size:32px;letter-spacing:8px;font-weight:bold;background:#f7f2eb;padding:14px;text-align:center;border-radius:12px">${code}</p>
      <p style="font-size:13px;color:#777">Berlaku ${TTL_MIN} menit. Jika bukan kamu yang mendaftar, abaikan email ini.</p></div>`,
  });
}

export async function checkOtp(user, code) {
  const otp = await EmailOtp.findOne({ where: { user_id: user.id }, order: [["id", "DESC"]] });
  if (!otp) return { ok: false, message: "Kode belum diminta. Klik kirim ulang." };
  if (otp.expires_at < new Date()) return { ok: false, message: "Kode kedaluwarsa. Klik kirim ulang." };
  if (otp.attempts >= MAX_ATTEMPTS) return { ok: false, message: "Terlalu banyak percobaan. Minta kode baru." };

  await otp.update({ attempts: otp.attempts + 1 });
  if (!(await bcrypt.compare(String(code || "").trim(), otp.code_hash)))
    return { ok: false, message: "Kode salah" };

  await EmailOtp.destroy({ where: { user_id: user.id } });
  return { ok: true };
}

/* ============ WhatsApp ============ */
export async function sendPhoneOtp(user) {
  throttle(await PhoneOtp.findOne({ where: { user_id: user.id }, order: [["id", "DESC"]] }));

  const code = newCode();
  await PhoneOtp.destroy({ where: { user_id: user.id } });
  await PhoneOtp.create({
    user_id: user.id,
    phone: user.phone,
    code_hash: await bcrypt.hash(code, 8),
    expires_at: new Date(Date.now() + TTL_MIN * 60 * 1000),
  });

  await sendWhatsApp({
    to: user.phone,
    text: `Kode verifikasi Tallynote: *${code}*\nBerlaku ${TTL_MIN} menit. Jangan bagikan kode ini ke siapa pun.`,
    // hanya dipakai Cloud API: butuh template autentikasi terpisah
    template: process.env.WA_OTP_TEMPLATE_NAME,
    params: [code],
  });
}

export async function checkPhoneOtp(user, code) {
  const otp = await PhoneOtp.findOne({ where: { user_id: user.id }, order: [["id", "DESC"]] });
  if (!otp) return { ok: false, message: "Kode belum diminta. Klik kirim kode." };
  if (otp.phone !== user.phone) return { ok: false, message: "Nomor berubah. Minta kode baru." };
  if (otp.expires_at < new Date()) return { ok: false, message: "Kode kedaluwarsa. Minta kode baru." };
  if (otp.attempts >= MAX_ATTEMPTS) return { ok: false, message: "Terlalu banyak percobaan. Minta kode baru." };

  await otp.update({ attempts: otp.attempts + 1 });
  if (!(await bcrypt.compare(String(code || "").trim(), otp.code_hash)))
    return { ok: false, message: "Kode salah" };

  await PhoneOtp.destroy({ where: { user_id: user.id } });
  return { ok: true };
}