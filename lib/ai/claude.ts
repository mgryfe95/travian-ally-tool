import Anthropic from "@anthropic-ai/sdk";
import { glossaryBlock, SYSTEM_PROMPT, type Alias } from "./prompt";
import { apiSchema, apiToReading, readingJsonSchema, readingSchema, readingToApi, type Reading } from "./reading";
import { AppError } from "../i18n/errors";

export type Example = { image: Buffer; gold: Reading };
export type ReadOptions = { examples?: Example[]; aliases?: Alias[]; expectedKind?: string };

export class VisionError extends AppError {}

export const DEFAULT_MODEL = "claude-haiku-5-5";

export function mediaType(img: Buffer): "image/png" | "image/jpeg" | "image/webp" {
  if (img.subarray(0, 4).toString("hex") === "89504e47") return "image/png";
  if (img[0] === 0xff && img[1] === 0xd8) return "image/jpeg";
  if (img.subarray(0, 4).toString() === "RIFF" && img.subarray(8, 12).toString() === "WEBP") return "image/webp";
  throw new VisionError("err.vision.unsupportedImage");
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
        content: [{ type: "text", text: JSON.stringify(readingToApi(ex.gold)), ...(i === examples.length - 1 ? { cache_control: { type: "ephemeral" as const } } : {}) }],
      });
    });
    const hint = opts.expectedKind ? ` Laut Nutzer ist es: ${opts.expectedKind} (nur wenn das Bild offensichtlich etwas anderes zeigt, die tatsächliche Art angeben und in "uncertain" vermerken).` : "";
    messages.push({ role: "user", content: [imageBlock(image), { type: "text", text: ASK + hint }] });

    const res = await this.api.messages.create({
      model: this.model,
      max_tokens: 16_000,
      system: SYSTEM_PROMPT + glossaryBlock(opts.aliases ?? []),
      messages,
      output_config: { effort: "high", format: { type: "json_schema", schema: readingJsonSchema } },
    });
    if (res.stop_reason === "refusal") throw new VisionError("err.vision.refused");
    if (res.stop_reason === "max_tokens") throw new VisionError("err.vision.truncated");
    const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    try {
      return readingSchema.parse(apiToReading(apiSchema.parse(JSON.parse(text))));
    } catch (e) {
      throw new VisionError("err.vision.invalidResponse", { detail: (e as Error).message.slice(0, 200) });
    }
  }
}
