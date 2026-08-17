import fs from "fs";
import Anthropic from "@anthropic-ai/sdk";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse");

const PROMPT =
  "Summarize this veterinary/clinical document. Include key findings, diagnoses, medications, and recommendations if present. Be concise but thorough.";

export async function summarizeFile(
  filePath: string,
  mimeType: string,
  apiKey: string
): Promise<string> {
  const anthropic = new Anthropic({ apiKey });

  if (mimeType.startsWith("image/")) {
    const fileBuffer = fs.readFileSync(filePath);
    const base64 = fileBuffer.toString("base64");
    const mediaType = mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp";

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    return textBlock?.type === "text" ? textBlock.text : "Unable to generate summary";
  }

  if (mimeType === "application/pdf") {
    const buffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(buffer);
    const text = pdfData.text?.trim();

    if (!text) {
      return "PDF contained no extractable text for summarization.";
    }

    const truncated = text.slice(0, 12000);
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: `${PROMPT}\n\nDocument text:\n${truncated}`,
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    return textBlock?.type === "text" ? textBlock.text : "Unable to generate summary";
  }

  throw new Error(`Unsupported mime type: ${mimeType}`);
}
