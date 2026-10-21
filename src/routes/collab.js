import { Router } from "express";
import { auth } from "../middlewares/auth.js";
import { requireMember } from "../middlewares/workspace.js";
import { collabLimiter, inviteLimiter } from "../middlewares/rateLimit.js";
import * as W from "../controllers/workspace.controller.js";
import * as C from "../controllers/collab.controller.js";

const r = Router();

// semua parameter ID harus angka
["wid", "tid", "mid", "pid", "iid", "uid"].forEach((p) =>
  r.param(p, (req, res, next, v) =>
    /^\d{1,15}$/.test(v) ? next() : res.status(404).json({ message: "Tidak ditemukan" }))
);

const m = (min = "member") => [auth, requireMember(min)];

// ruang
r.get("/workspaces", auth, W.listMine);
r.post("/workspaces", auth, collabLimiter, W.create);

// undangan (penerima)
r.get("/invites/:token", auth, inviteLimiter, W.previewInvite);
r.post("/invites/:token/join", auth, inviteLimiter, W.joinInvite);

r.get("/workspaces/:wid", ...m(), W.getOne);
r.put("/workspaces/:wid", ...m("admin"), W.update);
r.delete("/workspaces/:wid", ...m("owner"), W.remove);
r.post("/workspaces/:wid/leave", ...m(), W.leave);

// anggota
r.get("/workspaces/:wid/members", ...m(), W.listMembers);
r.put("/workspaces/:wid/members/:uid", ...m("owner"), W.setRole);
r.delete("/workspaces/:wid/members/:uid", ...m("admin"), W.removeMember);

// undangan (admin)
r.get("/workspaces/:wid/invites", ...m("admin"), W.listInvites);
r.post("/workspaces/:wid/invites", ...m("admin"), collabLimiter, W.createInvite);
r.delete("/workspaces/:wid/invites/:iid", ...m("admin"), W.revokeInvite);

// forum
r.get("/workspaces/:wid/posts", ...m(), C.listPosts);
r.post("/workspaces/:wid/posts", ...m(), collabLimiter, C.createPost);
r.delete("/workspaces/:wid/posts/:pid", ...m(), C.deletePost);

// tugas
r.get("/workspaces/:wid/tasks", ...m(), C.listTasks);
r.post("/workspaces/:wid/tasks", ...m(), collabLimiter, C.createTask);
r.put("/workspaces/:wid/tasks/:tid", ...m(), C.updateTask);
r.delete("/workspaces/:wid/tasks/:tid", ...m(), C.deleteTask);

// meeting
r.get("/workspaces/:wid/meetings", ...m(), C.listMeetings);
r.post("/workspaces/:wid/meetings", ...m(), collabLimiter, C.createMeeting);
r.put("/workspaces/:wid/meetings/:mid", ...m(), C.updateMeeting);
r.post("/workspaces/:wid/meetings/:mid/cancel", ...m(), C.cancelMeeting);
r.put("/workspaces/:wid/meetings/:mid/rsvp", ...m(), C.rsvp);

// kalender
r.get("/workspaces/:wid/calendar", ...m(), C.calendar);

export default r;