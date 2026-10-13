import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { User, UserSetting } from "../models/index.js";
import { normalizePhone } from "../utils/phone.js";
import { emailConfigured } from "../services/mailer.js";
import {
  sendOtp,
  checkOtp,
  sendPhoneOtp,
  checkPhoneOtp,
} from "../services/otp.js";

import { whatsappConfigured } from "../services/whatsapp.js";
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const sign = (u) =>
  jwt.sign({ id: u.id, role: u.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  timezone: u.timezone,
  avatar_url: u.avatar_url,
  has_password: !!u.password_hash,
  phone: u.phone,
  email_verified: !!u.email_verified_at,
  phone_verified: !!u.phone_verified_at,
});

export const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!emailConfigured())
      return res.status(500).json({
        message:
          "Email server belum dikonfigurasi, pendaftaran belum bisa dilakukan",
      });

    let user = await User.findOne({ where: { email } });
    if (user && (user.email_verified_at || !user.password_hash))
      return res.status(409).json({ message: "Email sudah terdaftar" });

    const password_hash = await bcrypt.hash(password, 10);
    if (user) {
      // pernah daftar tapi belum verifikasi: perbarui data lalu kirim kode baru
      await user.update({ name, password_hash });
    } else {
      user = await User.create({
        name,
        email,
        password_hash,
        email_verified_at: null,
      });
      await UserSetting.create({ user_id: user.id });
    }

    try {
      await sendOtp(user);
    } catch (e) {
      if (e.status !== 429) {
        console.error("Kirim OTP gagal:", e.message);
        return res.status(502).json({
          message: "Gagal mengirim kode ke email. Coba lagi beberapa saat.",
        });
      }
    }
    // tidak ada token: user belum boleh masuk
    res.status(201).json({ needsVerification: true, email: user.email });
  } catch (e) {
    next(e);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (user && !user.password_hash)
      return res.status(400).json({
        message:
          "Akun ini terdaftar lewat Google. Gunakan tombol Masuk dengan Google.",
      });
    if (!user || !(await bcrypt.compare(password, user.password_hash)))
      return res.status(401).json({ message: "Email atau password salah" });

    if (!user.email_verified_at) {
      try {
        await sendOtp(user);
      } catch (e) {
        if (e.status !== 429) console.error("Kirim OTP gagal:", e.message);
      }
      return res.status(403).json({
        code: "EMAIL_NOT_VERIFIED",
        email: user.email,
        message:
          "Email belum diverifikasi. Masukkan kode yang dikirim ke emailmu.",
      });
    }
    res.json({ token: sign(user), user: publicUser(user) });
  } catch (e) {
    next(e);
  }
};

export const googleLogin = async (req, res, next) => {
  try {
    const { credential } = req.body;
    if (!credential)
      return res.status(422).json({ message: "Credential Google tidak ada" });
    if (!process.env.GOOGLE_CLIENT_ID)
      return res
        .status(500)
        .json({ message: "Login Google belum dikonfigurasi di server" });

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (err) {
      console.error("Google verify error:", err.message);
      return res
        .status(401)
        .json({ message: "Token Google tidak valid atau kedaluwarsa" });
    }

    if (!payload?.email || !payload.email_verified)
      return res
        .status(401)
        .json({ message: "Email Google belum terverifikasi" });

    const email = payload.email.toLowerCase();
    let user = await User.findOne({ where: { google_id: payload.sub } });

    if (!user) {
      user = await User.findOne({ where: { email } });
      if (user) {
        // email sudah ada: tautkan akun Google ke akun tersebut
        await user.update({
          google_id: payload.sub,
          email_verified_at: user.email_verified_at || new Date(),
          avatar_url: user.avatar_url || payload.picture || null,
        });
      } else {
        user = await User.create({
          name: payload.name || email.split("@")[0],
          email,
          email_verified_at: new Date(),
          google_id: payload.sub,
          avatar_url: payload.picture || null,
          password_hash: null,
        });
        await UserSetting.create({ user_id: user.id });
      }
    }

    res.json({ token: sign(user), user: publicUser(user) });
  } catch (e) {
    next(e);
  }
};

export const me = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(401).json({ message: "User tidak ditemukan" });
    res.json(publicUser(user));
  } catch (e) {
    next(e);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const { name, timezone } = req.body;
    if (!name?.trim())
      return res.status(422).json({ message: "Nama wajib diisi" });

    const user = await User.findByPk(req.user.id);
    const patch = { name: name.trim(), ...(timezone ? { timezone } : {}) };

    if ("phone" in req.body) {
      const p = normalizePhone(req.body.phone);
      if (p === undefined)
        return res
          .status(422)
          .json({
            message: "Nomor WhatsApp tidak valid. Contoh: 081234567890",
          });
      patch.phone = p;
      if (p !== user.phone) patch.phone_verified_at = null; // nomor baru wajib diverifikasi ulang
    }

    await user.update(patch);
    res.json(publicUser(user));
  } catch (e) {
    next(e);
  }
};

export const changePassword = async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    if (!new_password || new_password.length < 6)
      return res
        .status(422)
        .json({ message: "Password baru minimal 6 karakter" });
    const user = await User.findByPk(req.user.id);

    // user Google yang belum punya password boleh langsung membuat password
    if (
      user.password_hash &&
      !(await bcrypt.compare(current_password || "", user.password_hash))
    )
      return res.status(400).json({ message: "Password saat ini salah" });

    await user.update({ password_hash: await bcrypt.hash(new_password, 10) });
    res.json({ message: "Password diperbarui" });
  } catch (e) {
    next(e);
  }
};

export const sendVerification = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (user.email_verified_at)
      return res.json({ message: "Email sudah terverifikasi" });
    if (!emailConfigured())
      return res
        .status(500)
        .json({ message: "Email server belum dikonfigurasi" });
    try {
      await sendOtp(user);
    } catch (e) {
      if (e.status === 429) return res.status(429).json({ message: e.message });
      console.error("Kirim OTP gagal:", e.message);
      return res
        .status(502)
        .json({ message: "Gagal mengirim email. Cek konfigurasi SMTP." });
    }
    res.json({ message: "Kode verifikasi dikirim ke emailmu" });
  } catch (e) {
    next(e);
  }
};

// POST /auth/verify  { email, code } -> token
export const verifyEmail = async (req, res, next) => {
  try {
    const user = await User.findOne({
      where: {
        email: String(req.body.email || "")
          .toLowerCase()
          .trim(),
      },
    });
    if (!user)
      return res.status(400).json({ message: "Kode salah atau kedaluwarsa" });
    if (user.email_verified_at)
      return res
        .status(400)
        .json({ message: "Email sudah terverifikasi, silakan masuk" });

    const r = await checkOtp(user, req.body.code);
    if (!r.ok) return res.status(400).json({ message: r.message });

    await user.update({ email_verified_at: new Date() });
    res.json({ token: sign(user), user: publicUser(user) });
  } catch (e) {
    next(e);
  }
};

// POST /auth/verify/resend  { email }
export const resendVerification = async (req, res, next) => {
  try {
    const user = await User.findOne({
      where: {
        email: String(req.body.email || "")
          .toLowerCase()
          .trim(),
      },
    });
    if (user && !user.email_verified_at) {
      try {
        await sendOtp(user);
      } catch (e) {
        if (e.status === 429)
          return res.status(429).json({ message: e.message });
        console.error("Kirim OTP gagal:", e.message);
        return res
          .status(502)
          .json({ message: "Gagal mengirim email. Coba lagi nanti." });
      }
    }
    // respons sama untuk email yang tidak ada, supaya tidak bisa dipakai menebak akun
    res.json({ message: "Jika email terdaftar, kode baru sudah dikirim" });
  } catch (e) {
    next(e);
  }
};

export const sendPhoneVerification = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user.phone)
      return res.status(400).json({ message: "Simpan nomor WhatsApp dulu" });
    if (user.phone_verified_at)
      return res.json({ message: "Nomor sudah terverifikasi" });
    if (!whatsappConfigured())
      return res
        .status(500)
        .json({ message: "WhatsApp belum dikonfigurasi di server" });
    try {
      await sendPhoneOtp(user);
    } catch (e) {
      if (e.status === 429) return res.status(429).json({ message: e.message });
      console.error("Kirim OTP WhatsApp gagal:", e.message);
      return res
        .status(502)
        .json({ message: `Gagal mengirim kode: ${e.message}` });
    }
    res.json({ message: "Kode dikirim ke WhatsApp-mu" });
  } catch (e) {
    next(e);
  }
};

export const verifyPhone = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (user.phone_verified_at) return res.json(publicUser(user));
    const r = await checkPhoneOtp(user, req.body.code);
    if (!r.ok) return res.status(400).json({ message: r.message });
    await user.update({ phone_verified_at: new Date() });
    res.json(publicUser(user));
  } catch (e) {
    next(e);
  }
};
