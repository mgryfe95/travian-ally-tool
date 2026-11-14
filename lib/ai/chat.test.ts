import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { ClaudeChatLlm } from "./chat";

type Res = Partial<Anthropic.Message> & { content: Anthropic.ContentBlock[]; stop_reason: Anthropic.Message["stop_reason"] };
function fakeApi(responses: Res[]) {
  const calls: Anthropic.MessageStreamParams[] = [];
  const api = {
    messages: {
      stream(p: Anthropic.MessageStreamParams) {
        calls.push(JSON.parse(JSON.stringify(p)));
        const r = responses.shift()!;
        const handlers: ((d: string) => void)[] = [];
        return {
          on(_e: "text", h: (d: string) => void) { handlers.push(h); return this; },
          async finalMessage() {
            for (const b of r.content) if (b.type === "text") for (const h of handlers) h(b.text);
            return { usage: { input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 0, cache_read_input_tokens: 2 }, ...r };
          },
        };
      },
    },
  };
  return { api: api as unknown as Anthropic, calls };
}

describe("ClaudeChatLlm: Streaming und Werkzeug-Schleife", () => {
  it("führt Werkzeuge aus, gibt Ergebnisse in einer Nachricht zurück und streamt den Text", async () => {
    const { api, calls } = fakeApi([
      { stop_reason: "tool_use", content: [{ type: "text", text: "Moment.", citations: null } as Anthropic.TextBlock, { type: "tool_use", id: "t1", name: "get_units", input: { tribe: "gauls" } } as Anthropic.ToolUseBlock, { type: "tool_use", id: "t2", name: "nope", input: {} } as Anthropic.ToolUseBlock] },
      { stop_reason: "end_turn", content: [{ type: "text", text: "Phalanx kostet 290.", citations: null } as Anthropic.TextBlock] },
    ]);
    const llm = new ClaudeChatLlm("k", "claude-haiku-5-5", api);
    const streamed: string[] = [];
    const tools: string[] = [];
    const r = await llm.complete({
      system: ["S"], messages: [{ role: "user", content: "Was kostet die Phalanx?" }],
      tools: [{ name: "get_units", input_schema: { type: "object" } }],
      runTool: async (name) => (name === "get_units" ? { text: "| Phalanx | 290 |" } : { text: "unknown", error: true }),
      onText: (d) => streamed.push(d), onTool: (n) => tools.push(n),
    });
    expect(r.text).toBe("Moment.\n\nPhalanx kostet 290.");
    expect(streamed.join("")).toBe(r.text);
    expect(tools).toEqual(["get_units", "nope"]);
    expect(r.usage).toMatchObject({ input_tokens: 20, output_tokens: 10, cache_read_input_tokens: 4 });
    const second = calls[1]!;
    expect(second.messages.at(-2)).toMatchObject({ role: "assistant" });
    expect(second.messages.at(-1)).toEqual({ role: "user", content: [
      { type: "tool_result", tool_use_id: "t1", content: "| Phalanx | 290 |" },
      { type: "tool_result", tool_use_id: "t2", content: "unknown", is_error: true },
    ] });
    expect(calls[0]!.system).toEqual([{ type: "text", text: "S", cache_control: { type: "ephemeral" } }]);
  });
  it("Ablehnung → Fehler", async () => {
    const { api } = fakeApi([{ stop_reason: "refusal", content: [] }]);
    await expect(new ClaudeChatLlm("k", "m", api).complete({ system: ["S"], messages: [{ role: "user", content: "x" }] })).rejects.toThrow();
  });
});
