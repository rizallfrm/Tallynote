import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
export const PROMPT_VERSION = "v1";

export async function generateActivityFields(inputText) {
  const prompt = `Kamu adalah asisten jurnal harian. Dari catatan user berikut, susun:
- description: uraian aktivitas (2-4 kalimat, bahasa Indonesia, sudut pandang orang pertama)
- learning: pembelajaran yang diperoleh (1-3 kalimat)
- obstacle: kendala yang dialami (1-3 kalimat; jika tidak ada tulis "Tidak ada kendala berarti")
Hanya gunakan informasi dari catatan, jangan mengarang fakta baru.
Balas HANYA JSON: {"description":"","learning":"","obstacle":""}

Catatan user:
"""${inputText}"""`;

  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL,
    contents: prompt,
    config: { responseMimeType: "application/json", temperature: 0.4 },
  });

  const data = JSON.parse(response.text);
  return {
    data: {
      description: data.description ?? "",
      learning: data.learning ?? "",
      obstacle: data.obstacle ?? "",
    },
    model: process.env.GEMINI_MODEL,
  };
}

export async function generateDailySummaryText(activities) {
  const list = activities
    .map(
      (a, i) =>
        `${i + 1}. ${a.title} [${a.status}]
   Uraian: ${a.description || a.activity_input}
   Pembelajaran: ${a.learning || "-"}
   Kendala: ${a.obstacle || "-"}`
    )
    .join("\n\n");

  const prompt = `Kamu adalah asisten jurnal harian. Buat ringkasan refleksi satu hari
dalam bahasa Indonesia (3-5 kalimat, sudut pandang orang pertama, paragraf biasa tanpa
bullet dan tanpa markdown). Sebutkan capaian utama, pembelajaran terpenting, dan kendala
yang perlu diperhatikan. Hanya gunakan informasi di bawah, jangan mengarang.

Aktivitas hari ini:
${list}`;

  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL,
    contents: prompt,
    config: { temperature: 0.5 },
  });
  return response.text.trim();
}