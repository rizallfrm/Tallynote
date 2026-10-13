import "dotenv/config";
import app from "./app.js";
import { sequelize } from "./models/index.js";
import { startScheduler } from "./services/deadlineReminder.js";

(async () => {
  await sequelize.authenticate();
  console.log("DB terkoneksi");
  app.listen(process.env.PORT, () => {
    console.log(`Server jalan di :${process.env.PORT}`);
    startScheduler();
  });
})();