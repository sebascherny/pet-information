import fs from "fs";
import OpenAI from "openai";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse");

export async function summarizeFile(
  filePath: string,
  mimeType: string,
  apiKey: string
): Promise<string> {
  const openai = new OpenAI({ apiKey });

  const prompt =
    "Summarize this veterinary/clinical document. Include key findings, diagnoses, medications, and recommendations if present. Be concise but thorough. If the file is an image, describe it.";

  if (mimeType.startsWith("image/")) {
    const fileBuffer = fs.readFileSync(filePath);
    const base64 = fileBuffer.toString("base64");

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${base64}` },
            },
          ],
        },
      ],
      max_tokens: 1000,
    });

    return response.choices[0]?.message?.content || "Unable to generate summary";
  }

  if (mimeType === "application/pdf") {
    const buffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(buffer);
    const text = pdfData.text?.trim();

    if (!text) {
      return "PDF contained no extractable text for summarization.";
    }

    const truncated = text.slice(0, 12000);
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: `${prompt}\n\nDocument text:\n${truncated}`,
        },
      ],
      max_tokens: 1000,
    });

    return response.choices[0]?.message?.content || "Unable to generate summary";
  }

  throw new Error(`Unsupported mime type: ${mimeType}`);
}
