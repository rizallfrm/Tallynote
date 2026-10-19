
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import routes from "./routes/index.js";
import { notFound, errorHandler } from "./middlewares/errorHandler.js";

const app = express();

const allowedOrigins = [
  process.env.CLIENT_URL,
  "https://tallynoteid.vercel.app",
  "http://localhost:5173",
].filter(Boolean);

app.use(helmet({
  crossOriginOpenerPolicy: {
    policy: "same-origin-allow-popups",
  },
}));

// CORS harus dipasang sebelum routes
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json({ limit: "100kb" }));
app.use(morgan("dev"));

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.use("/api", routes);

app.use(notFound);
app.use(errorHandler);

export default app;
