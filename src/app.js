import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import routes from "./routes/index.js";
import { notFound, errorHandler } from "./middlewares/errorHandler.js";

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json({ limit: "100kb" }));
app.use(morgan("dev"));
app.get("/health", (req, res) => res.json({ ok: true }));
app.use("/api", routes);
app.use(notFound);
app.use(errorHandler);
app.use("/api/backup/import", express.json({ limit: "5mb" }));

export default app;