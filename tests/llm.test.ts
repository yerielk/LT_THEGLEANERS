import { describe, it, expect, vi, afterEach } from "vitest";
import { createChat, pickProvider } from "../scripts/llm";

describe("agent:demo model provider", () => {
  it("uses whichever key is present, Anthropic first", () => {
    expect(pickProvider({ ANTHROPIC_API_KEY: "a" })).toBe("anthropic");
    expect(pickProvider({ OPENAI_API_KEY: "o" })).toBe("openai");
    expect(pickProvider({ ANTHROPIC_API_KEY: "a", OPENAI_API_KEY: "o" })).toBe("anthropic");
    expect(pickProvider({ ANTHROPIC_API_KEY: "", OPENAI_API_KEY: "o" })).toBe("openai");
    expect(pickProvider({})).toBeNull();
  });

  it("lets LLM_PROVIDER pick one even when both keys are set", () => {
    expect(pickProvider({ LLM_PROVIDER: "openai", ANTHROPIC_API_KEY: "a", OPENAI_API_KEY: "o" })).toBe("openai");
    expect(pickProvider({ LLM_PROVIDER: " Anthropic ", OPENAI_API_KEY: "o" })).toBe("anthropic");
    expect(() => pickProvider({ LLM_PROVIDER: "gemini" })).toThrow(/LLM_PROVIDER/);
  });
});

describe("OpenAI chat", () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it("turns tool calls into the shared shape and answers each with a tool message", async () => {
    const bodies: any[] = [];
    const replies = [
      { role: "assistant", content: null, tool_calls: [{ id: "c1", type: "function", function: { name: "search_works", arguments: '{"q":"memory"}' } }] },
      { role: "assistant", content: "done" },
    ];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({ choices: [{ message: replies[bodies.length - 1] }] }));
    }));
    const chat = createChat("openai", {
      system: "sys", prompt: "hi",
      tools: [{ name: "search_works", description: "find", inputSchema: { $schema: "http://json-schema.org/draft-07/schema#", type: "object", properties: {} } }],
    });

    const first = await chat.next();
    expect(first.calls).toEqual([{ id: "c1", name: "search_works", input: { q: "memory" } }]);
    expect(bodies[0].tools[0].function.parameters).toEqual({ type: "object", properties: {} });

    chat.addToolResults([{ id: "c1", isError: false, content: '{"works":[]}' }]);
    const second = await chat.next();
    expect(second).toEqual({ text: "done", calls: [] });
    expect(bodies[1].messages.at(-1)).toEqual({ role: "tool", tool_call_id: "c1", content: '{"works":[]}' });
  });
});
