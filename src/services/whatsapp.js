const provider = () => (process.env.WA_PROVIDER || "off").toLowerCase();

export const whatsappConfigured = () =>
  (provider() === "fonnte" && !!process.env.FONNTE_TOKEN) ||
  (provider() === "cloud" && !!process.env.WA_ACCESS_TOKEN && !!process.env.WA_PHONE_NUMBER_ID);

// to: "628xxxx" | text: untuk Fonnte | params + template: untuk Cloud API
export async function sendWhatsApp({ to, text, params = [], template }) {
  if (!whatsappConfigured()) throw new Error("WhatsApp belum dikonfigurasi di server (WA_PROVIDER)");

  if (provider() === "fonnte") {
    const fd = new FormData();
    fd.append("target", to);
    fd.append("message", text);
    const res = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: { Authorization: process.env.FONNTE_TOKEN },
      body: fd,
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.status === false) throw new Error(data.reason || `Fonnte error ${res.status}`);
    return;
  }

  // WhatsApp Cloud API (Meta): wajib template yang sudah disetujui
  const url = `https://graph.facebook.com/${process.env.WA_API_VERSION || "v21.0"}/${process.env.WA_PHONE_NUMBER_ID}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: template || process.env.WA_TEMPLATE_NAME,
        language: { code: process.env.WA_TEMPLATE_LANG || "id" },
        components: [{ type: "body", parameters: params.map((t) => ({ type: "text", text: String(t) })) }],
      },
    }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || `WhatsApp Cloud error ${res.status}`);
}