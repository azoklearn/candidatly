import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";

import { suggestRomeCodes, toSearchTerms, type RomeCandidate } from "@/lib/ai/rome-mapping";
import { createLogger } from "@/lib/logger";

const silent = createLogger({}, { write: () => {} });
const CANDIDATES: RomeCandidate[] = [
  {
    code: "M1855",
    label: "Développeur / Développeuse web",
    appellations: ["Développeur / Développeuse front-end"],
    rank: 3,
  },
  {
    code: "M1805",
    label: "Développeur / Développeuse informatique",
    appellations: ["Programmeur / Programmeuse"],
    rank: 2,
  },
  {
    code: "E1104",
    label: "Concepteur / Conceptrice de contenus multimédias",
    appellations: [],
    rank: 1,
  },
];

type ParsedReply = {
  parsed_output: { codes: { code: string; reason: string }[] } | null;
  usage: { input_tokens: number; output_tokens: number };
};

function fakeClient(...replies: Array<ParsedReply | Error>) {
  const parse = vi.fn(async () => {
    const next = replies.shift();
    if (!next) throw new Error("unexpected call");
    if (next instanceof Error) throw next;
    return next;
  });
  return { client: { messages: { parse } } as unknown as Anthropic, parse };
}

const reply = (codes: { code: string; reason: string }[]): ParsedReply => ({
  parsed_output: { codes },
  usage: { input_tokens: 420, output_tokens: 60 },
});

describe("toSearchTerms", () => {
  it("keeps meaningful accent-free stems and drops search noise", () => {
    expect(toSearchTerms("Je cherche une alternance en développement web et mobile !")).toEqual([
      "develop",
      "web",
      "mobile",
    ]);
    expect(toSearchTerms("Ressources humaines, ressources")).toEqual(["ressour", "humaine"]);
  });
});

describe("suggestRomeCodes", () => {
  it("keeps only candidate codes chosen by the model, in its order", async () => {
    const { client, parse } = fakeClient(
      reply([
        { code: "M1855", reason: "Développement web demandé." },
        { code: "Z9999", reason: "Code inventé." },
        { code: "M1805", reason: "Développement logiciel proche." },
        { code: "M1855", reason: "Doublon." },
      ]),
    );
    const result = await suggestRomeCodes(
      { text: "développement web", candidates: CANDIDATES },
      { client, model: "haiku", logger: silent },
    );
    expect(result.source).toBe("llm");
    expect(result.suggestions.map((s) => s.code)).toEqual(["M1855", "M1805"]);
    expect(result.suggestions[0]?.label).toBe("Développeur / Développeuse web");
    expect(result.usage).toEqual({ inputTokens: 420, outputTokens: 60 });
    const params = (
      parse.mock.calls[0] as unknown as [{ temperature: number; messages: { content: string }[] }]
    )[0];
    expect(params.temperature).toBe(0);
    expect(params.messages[0]?.content).toContain(
      "M1805 | Développeur / Développeuse informatique",
    );
  });

  it("retries once, then falls back to the search ranking", async () => {
    const { client, parse } = fakeClient(
      reply([{ code: "Z9999", reason: "x" }]),
      new Error("overloaded"),
    );
    const result = await suggestRomeCodes(
      { text: "web", candidates: CANDIDATES },
      { client, model: "haiku", logger: silent },
    );
    expect(parse).toHaveBeenCalledTimes(2);
    expect(result.source).toBe("search");
    expect(result.suggestions.map((s) => s.code)).toEqual(["M1855", "M1805", "E1104"]);
    expect(result.suggestions[0]?.reason).toContain("Développeur / Développeuse front-end");
  });

  it("works without an API key and without candidates", async () => {
    const noKey = await suggestRomeCodes(
      { text: "web", candidates: CANDIDATES },
      { client: null, model: "haiku" },
    );
    expect(noKey.source).toBe("search");
    expect(noKey.suggestions).toHaveLength(3);
    const none = await suggestRomeCodes(
      { text: "zzz", candidates: [] },
      { client: null, model: "haiku" },
    );
    expect(none.suggestions).toEqual([]);
  });
});
