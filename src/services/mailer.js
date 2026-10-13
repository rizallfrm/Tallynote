import nodemailer from "nodemailer";

let transporter;
const get = () =>
  (transporter ||= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  }));

export const emailConfigured = () =>
  !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

export async function sendEmail({ to, subject, text, html }) {
  if (!emailConfigured()) throw new Error("SMTP belum dikonfigurasi di server");
  await get().sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to, subject, text, html,
  });
}