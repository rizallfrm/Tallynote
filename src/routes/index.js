import { Router } from "express";
import { auth, requireRole } from "../middlewares/auth.js";
import {
  validate, registerRules, loginRules, activityRules, categoryRules, previewRules,
} from "../middlewares/validate.js";
import { authLimiter, aiLimiter } from "../middlewares/rateLimit.js";
import * as A from "../controllers/auth.controller.js";
import * as Act from "../controllers/activity.controller.js";
import * as C from "../controllers/category.controller.js";
import * as S from "../controllers/summary.controller.js";
import * as St from "../controllers/setting.controller.js";
import * as T from "../controllers/target.controller.js";
import * as Tpl from "../controllers/template.controller.js";
import * as Tg from "../controllers/tag.controller.js";
import * as Rf from "../controllers/reflection.controller.js";
import * as Ask from "../controllers/ask.controller.js";
import * as Bk from "../controllers/backup.controller.js";
import * as N from "../controllers/notification.controller.js";


const r = Router();

// auth
r.post("/auth/register", authLimiter, validate(registerRules), A.register);
r.post("/auth/login", authLimiter, validate(loginRules), A.login);
r.get("/auth/me", auth, A.me);
r.put("/auth/profile", auth, A.updateProfile);
r.put("/auth/password", auth, authLimiter, A.changePassword);

r.post("/auth/verify/send", auth, authLimiter, A.sendVerification);
r.post("/auth/verify", authLimiter, A.verifyEmail);
r.post("/auth/verify/resend", authLimiter, A.resendVerification);

r.post("/auth/phone/send", auth, authLimiter, A.sendPhoneVerification);
r.post("/auth/phone/verify", auth, authLimiter, A.verifyPhone);

// categories
r.get("/categories", auth, C.list);
r.post("/categories", auth, requireRole("admin"), validate(categoryRules), C.create);
r.put("/categories/:id", auth, requireRole("admin"), C.update);
r.delete("/categories/:id", auth, requireRole("admin"), C.remove);

// activities
r.get("/activities", auth, Act.list);
r.post("/activities/preview", auth, aiLimiter, validate(previewRules), Act.preview);
r.post("/activities", auth, aiLimiter, validate(activityRules), Act.create);
r.get("/activities/upcoming", auth, Act.upcoming);
r.get("/activities/:id", auth, Act.getOne);
r.put("/activities/:id", auth, Act.update);
r.delete("/activities/:id", auth, Act.remove);
r.post("/activities/:id/regenerate", auth, aiLimiter, Act.regenerate);


r.post("/notifications/test", auth, authLimiter, N.test);

// summaries
r.get("/summaries", auth, S.recap);
r.get("/summaries/stats", auth, S.stats);
r.post("/summaries/ai", auth, aiLimiter, S.aiSummary);

// targets
r.get("/targets", auth, T.list);          // ?date=YYYY-MM-DD (minggu yang berisi tanggal itu)
r.post("/targets", auth, T.create);
r.put("/targets/:id", auth, T.update);
r.delete("/targets/:id", auth, T.remove);

// settings
r.get("/settings", auth, St.get);
r.put("/settings", auth, St.update);


r.post("/auth/google", authLimiter, A.googleLogin);


// aktivitas tambahan
r.post("/activities/plan", auth, Act.plan);
r.post("/activities/:id/duplicate", auth, Act.duplicate);

// template, tag
r.get("/templates", auth, Tpl.list);
r.post("/templates", auth, Tpl.create);
r.put("/templates/:id", auth, Tpl.update);
r.delete("/templates/:id", auth, Tpl.remove);
r.get("/tags", auth, Tg.list);

// AI tambahan
r.get("/reflections", auth, Rf.get);
r.post("/reflections/generate", auth, aiLimiter, Rf.generate);
r.post("/ask", auth, aiLimiter, Ask.ask);

// backup
r.get("/backup", auth, Bk.exportData);
r.post("/backup/import", auth, Bk.importData);
export default r;