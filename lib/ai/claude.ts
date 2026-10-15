import Anthropic from "@anthropic-ai/sdk";
import { glossaryBlock, SYSTEM_PROMPT, type Alias } from "./prompt";
import { readingJsonSchema, readingSchema, type Reading } from "./reading";

export type Example = { image: Buffer; gold: Reading };
export type ReadOptions = { examples?: Example[]; aliases?: Alias[] };

export class VisionError extends Error {}

export const DEFAULT_MODEL = "claude-haiku-5-5";

export function mediaType(img: Buffer): "image/png" | "image/jpeg" | "image/webp" {
  if (img.subarray(0, 4).toString("hex") === "89504e47") return "image/png";
  if (img[0] === 0xff && img[1] === 0xd8) return "image/jpeg";
  if (img.subarray(0, 4).toString() === "RIFF" && img.subarray(8, 12).toString() === "WEBP") return "image/webp";
  throw new VisionError("Nicht unterstütztes Bildformat");
}

const imageBlock = (img: Buffer) => ({ type: "image" as const, source: { type: "base64" as const, media_type: mediaType(img), data: img.toString("base64") } });
const ASK = "Lies diesen Screenshot gemäß den Regeln.";

/** Liest einen Screenshot per Claude (Vision + Structured Outputs). Antwort wird zusätzlich strikt mit zod geprüft. */
export class ClaudeVision {
  private readonly api: Anthropic;
  constructor(apiKey: string, private readonly model = DEFAULT_MODEL, api?: Anthropic) {
    this.api = api ?? new Anthropic({ apiKey, maxRetries: 3 });
  }

  async read(image: Buffer, opts: ReadOptions = {}): Promise<Reading> {
    const examples = opts.examples ?? [];
    const messages: Anthropic.MessageParam[] = [];
    examples.forEach((ex, i) => {
      messages.push({ role: "user", content: [imageBlock(ex.image), { type: "text", text: ASK }] });
      messages.push({
        role: "assistant",
        content: [{ type: "text", text: JSON.stringify(ex.gold), ...(i === examples.length - 1 ? { cache_control: { type: "ephemeral" as const } } : {}) }],
      });
    });
    messages.push({ role: "user", content: [imageBlock(image), { type: "text", text: ASK }] });

    const res = await this.api.messages.create({
      model: this.model,
      max_tokens: 16_000,
      system: SYSTEM_PROMPT + glossaryBlock(opts.aliases ?? []),
      messages,
      output_config: { effort: "high", format: { type: "json_schema", schema: readingJsonSchema } },
    });
    if (res.stop_reason === "refusal") throw new VisionError("Die KI hat die Verarbeitung abgelehnt");
    if (res.stop_reason === "max_tokens") throw new VisionError("Antwort abgeschnitten");
    const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    try {
      return readingSchema.parse(JSON.parse(text));
    } catch (e) {
      throw new VisionError(`Ungültige Antwort der KI: ${(e as Error).message.slice(0, 200)}`);
    }
  }
}
