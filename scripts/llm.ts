/**
 * The model side of agent:demo, for either Anthropic (Messages API) or OpenAI (Chat Completions).
 * Both expose the same small Chat interface so the MCP tool loop in agent-demo.ts does not care which one runs.
 */
import Anthropic from "@anthropic-ai/sdk";

export type Provider = "anthropic" | "openai";
export interface ToolDef { name: string; description?: string; inputSchema: Record<string, unknown> }
export interface ToolCall { id: string; name: string; input: Record<string, unknown> }
export interface ToolResult { id: string; content: string; isError: boolean }
export interface Turn { text: string; calls: ToolCall[]; refused?: string }
export interface Chat {
  model: string;
  next(): Promise<Turn>;
  addToolResults(results: ToolResult[]): void;
  addUserText(text: string): void;
}

export const API_KEY_ENV: Record<Provider, string> = { anthropic: "ANTHROPIC_API_KEY", openai: "OPENAI_API_KEY" };

/** LLM_PROVIDER wins when set; otherwise whichever key is in .env, Anthropic first. null when there is no key. */
export function pickProvider(env: Record<string, string | undefined>): Provider | null {
  const forced = env.LLM_PROVIDER?.trim().toLowerCase();
  if (forced) {
    if (forced === "anthropic" || forced === "openai") return forced;
    throw new Error(`LLM_PROVIDER must be "anthropic" or "openai" (got "${env.LLM_PROVIDER}")`);
  }
  if (env.ANTHROPIC_API_KEY) return "anthropic";
  if (env.OPENAI_API_KEY) return "openai";
  return null;
}

// MCP schemas carry a $schema marker that the model APIs do not need
const schemaOf = (t: ToolDef) => {
  const { $schema: _, ...schema } = t.inputSchema;
  return schema;
};

export function createChat(provider: Provider, opts: { system: string; prompt: string; tools: ToolDef[] }): Chat {
  return provider === "anthropic" ? anthropicChat(opts) : openaiChat(opts);
}

function anthropicChat({ system, prompt, tools }: { system: string; prompt: string; tools: ToolDef[] }): Chat {
  const model = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY
  const defs: Anthropic.Beta.BetaTool[] = tools.map((t) => ({
    name: t.name, description: t.description ?? "", input_schema: schemaOf(t) as Anthropic.Beta.BetaTool.InputSchema,
  }));
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: prompt }];
  return {
    model,
    async next() {
      const res = await client.beta.messages.create({
        model,
        max_tokens: 16000,
        system,
        tools: defs,
        messages,
        output_config: { effort: "medium" },
        // if a safety classifier declines, the API re-runs the request on its recommended fallback model
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      });
      messages.push({ role: "assistant", content: res.content }); // full content, including thinking blocks
      if (res.stop_reason === "refusal") return { text: "", calls: [], refused: res.stop_details?.category ?? "no category" };
      return {
        text: res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n"),
        calls: res.content
          .filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use")
          .map((b) => ({ id: b.id, name: b.name, input: { ...(b.input as Record<string, unknown>) } })),
      };
    },
    addToolResults(results) {
      // all results of one turn in a single message
      messages.push({ role: "user", content: results.map((r) => ({ type: "tool_result" as const, tool_use_id: r.id, is_error: r.isError, content: r.content })) });
    },
    addUserText(text) { messages.push({ role: "user", content: text }); },
  };
}

interface OpenAIMessage { role: string; content: string | null; refusal?: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] }

function openaiChat({ system, prompt, tools }: { system: string; prompt: string; tools: ToolDef[] }): Chat {
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const defs = tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description ?? "", parameters: schemaOf(t) } }));
  const messages: unknown[] = [{ role: "system", content: system }, { role: "user", content: prompt }];
  return {
    model,
    async next() {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({ model, messages, tools: defs, tool_choice: "auto" }),
      });
      if (!res.ok) throw new Error(`model API error ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const msg = (await res.json()).choices[0].message as OpenAIMessage;
      messages.push(msg);
      if (msg.refusal) return { text: "", calls: [], refused: msg.refusal };
      return {
        text: msg.content ?? "",
        calls: (msg.tool_calls ?? []).map((tc) => {
          let input: Record<string, unknown> = {};
          try { input = JSON.parse(tc.function.arguments || "{}"); } catch { /* model sent invalid JSON */ }
          return { id: tc.id, name: tc.function.name, input };
        }),
      };
    },
    addToolResults(results) {
      // Chat Completions has no error flag on tool results; the error is in the JSON content
      for (const r of results) messages.push({ role: "tool", tool_call_id: r.id, content: r.content });
    },
    addUserText(text) { messages.push({ role: "user", content: text }); },
  };
}
