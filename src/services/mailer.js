import { google } from "googleapis";
import nodemailer from "nodemailer";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const gmail = google.gmail({
  version: "v1",
  auth: oauth2Client,
});

export const emailConfigured = () =>
  Boolean(
    process.env.GMAIL_USER &&
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN
  );

export async function sendEmail({ to, subject, text, html }) {
  if (!emailConfigured()) {
    throw new Error("Konfigurasi Gmail API belum lengkap");
  }

  const composer = nodemailer.createTransport({
    streamTransport: true,
    buffer: true,
    newline: "unix",
  });

  const message = await composer.sendMail({
    from:
      process.env.MAIL_FROM ||
      `Tallynote <${process.env.GMAIL_USER}>`,
    to,
    subject,
    text,
    html,
  });

  const raw = message.message
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const result = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });

  console.log("Email terkirim via Gmail API:", result.data.id);
  return result.data;
}