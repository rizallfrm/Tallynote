
import rateLimit from "express-rate-limit";

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Terlalu banyak percobaan, coba lagi nanti",
  },
});

// Dipasang SETELAH middleware auth, dihitung per user
export const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AI_RATE_LIMIT_MAX) || 100,
  keyGenerator: (req) => String(req.user?.id),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    code: "APP_RATE_LIMIT",
    message:
      "Terlalu banyak permintaan AI dalam waktu singkat, coba lagi beberapa menit",
  },
});

const byUser = (req) => String(req.user?.id ?? "anon");

// Pembuatan tugas, meeting, dan pesan
export const collabLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  keyGenerator: byUser,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Terlalu banyak permintaan, coba lagi beberapa menit lagi",
  },
});

// Pratinjau dan bergabung melalui token undangan
export const inviteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  keyGenerator: byUser,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Terlalu banyak percobaan, coba lagi nanti",
  },
});
