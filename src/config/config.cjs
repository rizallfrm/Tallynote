require("dotenv").config();

const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;

const base = {
  use_env_variable: "__CLI_DB_URL",
  dialect: "postgres",
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
  define: { underscored: true },
};
process.env.__CLI_DB_URL = url;

module.exports = {
  development: base,
  test: base,
  production: { ...base, logging: false },
};