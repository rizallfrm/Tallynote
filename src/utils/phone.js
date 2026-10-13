// Mengembalikan "628123456789", null (dikosongkan), atau undefined (tidak valid)
export function normalizePhone(raw) {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("0")) d = "62" + d.slice(1);
  else if (d.startsWith("8")) d = "62" + d;
  return /^\d{9,15}$/.test(d) ? d : undefined;
}