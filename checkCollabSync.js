import "dotenv/config";
import { Activity, User, WorkspaceMeeting, WorkspaceTask, sequelize } from "./src/models/index.js";
import { syncMeeting, syncTask } from "./src/services/collabSync.js";

const need = ["workspace_id", "workspace_task_id", "workspace_meeting_id"];
console.log("Model Activity:", need.map((k) => `${k}=${!!Activity.rawAttributes[k]}`).join(" "));
const dbCols = Object.keys(await sequelize.getQueryInterface().describeTable("activities"));
console.log("Kolom di database:", need.map((k) => `${k}=${dbCols.includes(k)}`).join(" "));

const tasks = await WorkspaceTask.findAll({
  order: [["id", "DESC"]], limit: 5,
  include: [{ model: User, as: "assignees", attributes: ["id"], through: { attributes: [] } }],
});
for (const t of tasks) {
  const linked = await Activity.count({ where: { workspace_task_id: t.id } });
  console.log(`\nTugas #${t.id} "${t.title}": penanggung jawab=${t.assignees.length}, aktivitas tertaut=${linked}`);
  try { await syncTask(t.id); console.log("  sinkron OK, tertaut sekarang:", await Activity.count({ where: { workspace_task_id: t.id } })); }
  catch (e) { console.log("  SINKRON GAGAL:", e.name, e.message, e.parent?.message || ""); }
}

const meetings = await WorkspaceMeeting.findAll({ order: [["id", "DESC"]], limit: 5 });
for (const m of meetings) {
  console.log(`\nMeeting #${m.id} "${m.title}" [${m.status}]`);
  try { await syncMeeting(m.id); console.log("  sinkron OK, tertaut:", await Activity.count({ where: { workspace_meeting_id: m.id } })); }
  catch (e) { console.log("  SINKRON GAGAL:", e.name, e.message, e.parent?.message || ""); }
}
await sequelize.close();