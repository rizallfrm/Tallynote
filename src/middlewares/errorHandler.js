export const notFound = (req, res) =>
  res.status(404).json({ message: "Route tidak ditemukan" });

export const errorHandler = (err, req, res, next) => {
   if (err.name === "AiError") {
    if (err.retryAfter) res.set("Retry-After", String(err.retryAfter));
    return res.status(err.status).json({
      message: err.message,
      code: err.code,
      retryAfter: err.retryAfter,
    });
  }
  console.error(err);
  if (err.name === "SequelizeForeignKeyConstraintError")
    return res.status(400).json({ message: "Data terkait tidak valid atau masih dipakai" });
  if (["SequelizeValidationError", "SequelizeUniqueConstraintError"].includes(err.name))
    return res.status(400).json({ message: err.errors?.[0]?.message || err.message });
  res.status(err.status || 500).json({
    message: err.status ? err.message : "Terjadi kesalahan pada server",
  });
};