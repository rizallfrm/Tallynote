import rateLimit from "express-rate-limit";

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Terlalu banyak percobaan, coba lagi nanti" },
});

// dipasang SETELAH auth, jadi dihitung per user
export const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AI_RATE_LIMIT_MAX) || 100,
  keyGenerator: (req) => String(req.user?.id),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    code: "APP_RATE_LIMIT",
    message: "Terlalu banyak permintaan AI dalam waktu singkat, coba lagi beberapa menit lagi",
  },
});