import { UserSetting } from "../models/index.js";

const getOrCreate = async (userId) =>
  (await UserSetting.findOrCreate({ where: { user_id: userId } }))[0];

export const get = async (req, res, next) => {
  try {
    res.json(await getOrCreate(req.user.id));
  } catch (e) {
    next(e);
  }
};

export const update = async (req, res, next) => {
  try {
    const s = await getOrCreate(req.user.id);
    const b = req.body;
    const data = {};
    if (b.reminder_enabled !== undefined)
      data.reminder_enabled = !!b.reminder_enabled;
    if (b.reminder_time !== undefined)
      data.reminder_time = b.reminder_time || null;
    if (b.language) data.language = b.language;
    if (b.notify_email !== undefined) data.notify_email = !!b.notify_email;
    if (b.notify_whatsapp !== undefined)
      data.notify_whatsapp = !!b.notify_whatsapp;
    for (const k of [
      "collab_notify_task",
      "collab_notify_deadline",
      "collab_notify_meeting",
      "collab_notify_update",
    ])
      if (b[k] !== undefined) data[k] = !!b[k];
    await s.update(data);
    res.json(s);
  } catch (e) {
    next(e);
  }
};
