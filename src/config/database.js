import { Sequelize } from "sequelize";
import pg from "pg";
import "dotenv/config";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL belum diisi di .env");

export const sequelize = new Sequelize(url, {
  dialect: "postgres",
  dialectModule: pg,
  logging: false,
  dialectOptions: {
    ssl: { require: true, rejectUnauthorized: false },
  },
  pool: { max: 5, min: 0, idle: 10000, acquire: 30000 },
  define: { underscored: true, createdAt: "created_at", updatedAt: "updated_at" },
});