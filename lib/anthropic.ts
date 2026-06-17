import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Two-tier model routing (PORTING-SPEC §2 / #6):
//   MODEL      — the judgment-heavy deep-compare pass (categorize + risk).
//   MODEL_FAST — well-defined, structured sub-prompts (e.g. clause extraction).
// Both overridable per-deploy via env.
export const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
export const MODEL_FAST = process.env.ANTHROPIC_MODEL_FAST || "claude-haiku-4-5";

/** Returns a client, or null when no key is configured (stub mode). */
export function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  return new Anthropic();
}

/**
 * Run a structured-output call via a FORCED tool call (PORTING-SPEC A.1.1).
 * The schema is guaranteed by the SDK — no ```json``` stripping, no
 * JSON.parse fallback, no "respond only with JSON" sentences. Low temperature
 * by default (A.1.2) for consistent classification/segmentation.
 */
export async function runStructured<T>(
  client: Anthropic,
  opts: {
    model: string;
    system?: string;
    content: Anthropic.ContentBlockParam[];
    toolName: string;
    schema: Anthropic.Tool.InputSchema;
    maxTokens?: number;
    temperature?: number;
    signal?: AbortSignal;
  },
): Promise<T> {
  const response = await client.messages.create(
    {
      model: opts.model,
      max_tokens: opts.maxTokens ?? 4096,
      temperature: opts.temperature ?? 0,
      ...(opts.system ? { system: opts.system } : {}),
      tools: [{ name: opts.toolName, description: "Return the structured result.", input_schema: opts.schema }],
      tool_choice: { type: "tool", name: opts.toolName },
      messages: [{ role: "user", content: opts.content }],
    },
    opts.signal ? { signal: opts.signal } : undefined,
  );

  const block = response.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") {
    throw new Error("Model did not return structured output (possible refusal).");
  }
  return block.input as T;
}
