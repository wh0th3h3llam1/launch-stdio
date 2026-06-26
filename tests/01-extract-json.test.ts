import { describe, it, expect } from "vitest";
import { extractJson } from "@/lib/gmi";

// extractJson is the load-bearing parser for every LLM agent's output. DeepSeek
// wraps JSON in <think> blocks and ``` fences; these tests pin that behaviour.
describe("extractJson", () => {
  it("parses a clean JSON object", () => {
    expect(extractJson('{"a":1,"b":"x"}')).toEqual({ a: 1, b: "x" });
  });

  it("strips <think> blocks", () => {
    const raw = "<think>let me reason about this</think>\n{\"brand\":\"Nova\"}";
    expect(extractJson(raw)).toEqual({ brand: "Nova" });
  });

  it("strips ```json code fences", () => {
    const raw = "```json\n{\"score\": 88}\n```";
    expect(extractJson(raw)).toEqual({ score: 88 });
  });

  it("ignores prose before and after the JSON", () => {
    const raw = "Sure! Here is the plan:\n{\"brand\":\"Acme\"}\nHope that helps.";
    expect(extractJson(raw)).toEqual({ brand: "Acme" });
  });

  it("handles braces inside string values", () => {
    const raw = '{"text":"use {curly} braces","n":2}';
    expect(extractJson(raw)).toEqual({ text: "use {curly} braces", n: 2 });
  });

  it("handles nested objects", () => {
    const raw = 'noise {"a":{"b":{"c":[1,2,3]}}} trailing';
    expect(extractJson(raw)).toEqual({ a: { b: { c: [1, 2, 3] } } });
  });

  it("parses a top-level array", () => {
    expect(extractJson('[{"p":"X"}]')).toEqual([{ p: "X" }]);
  });

  it("throws when there is no JSON", () => {
    expect(() => extractJson("just words, no json")).toThrow();
  });
});
