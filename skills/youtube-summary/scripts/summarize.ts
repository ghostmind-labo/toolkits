#!/usr/bin/env -S deno run --allow-net --allow-env=GEMINI_API_KEY --allow-write
/**
 * Summarize a public YouTube video with the Gemini API.
 *
 * Default path: Interactions API + agentic video processing (the model navigates
 * frames, audio and transcript itself). Falls back to static processing when the
 * model rejects agentic mode. Clipping (--start/--end) uses generateContent,
 * which is the only endpoint that accepts video offsets.
 *
 * Usage:
 *   summarize.ts <youtube-url> [--mode full|tldr|chapters|notes] [--prompt "..."]
 *                [--model gemini-3.8-flash] [--processing agentic|static]
 *                [--start 1m30s --end 5m] [--lang fr] [--out file.md] [--json]
 */

const API = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_MODEL = "gemini-3.8-flash";
const TIMEOUT_MS = 15 * 60 * 1000;

const MODES: Record<string, string> = {
  tldr: `Give a TL;DR of this video: one sentence stating what it is about, then 3-5 bullets with the most important points. No preamble.`,
  chapters: `List the chapters of this video. For each: a [MM:SS] (or [H:MM:SS]) timestamp of where it starts, a short title, and one sentence describing what happens. Base timestamps on the actual video. No preamble.`,
  full: `Produce a complete summary of this video in Markdown with these sections:

## TL;DR
2-3 sentences.

## Key points
5-10 bullets with the most important ideas, claims, or announcements.

## Detailed summary
Walk through the video in order, one subsection per major segment. Start each subsection heading with its [MM:SS] timestamp. Include specifics: names, numbers, tools, code, and anything shown on screen (slides, demos, diagrams) that is not said aloud.

## Notable quotes
Up to 5 short verbatim quotes with timestamps. Omit the section if none stand out.

## Takeaways
Actionable conclusions or what a viewer should remember.

No preamble before the first heading.`,
  notes: `Write study notes for this video in Markdown: definitions, concepts, step-by-step procedures, code or commands shown on screen (in code blocks), and resources mentioned. Group by topic, add [MM:SS] timestamps to each topic heading. No preamble.`,
};

type Args = {
  url: string;
  mode: string;
  prompt?: string;
  model: string;
  processing: "agentic" | "static";
  start?: string;
  end?: string;
  lang?: string;
  out?: string;
  json: boolean;
};

function die(msg: string): never {
  console.error(`error: ${msg}`);
  Deno.exit(1);
}

function parseArgs(argv: string[]): Args {
  const a: Partial<Args> = { mode: "full", model: DEFAULT_MODEL, processing: "agentic", json: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const next = () => argv[++i] ?? die(`missing value for ${k}`);
    switch (k) {
      case "--mode": a.mode = next(); break;
      case "--prompt": a.prompt = next(); break;
      case "--model": a.model = next(); break;
      case "--processing": a.processing = next() as Args["processing"]; break;
      case "--start": a.start = next(); break;
      case "--end": a.end = next(); break;
      case "--lang": a.lang = next(); break;
      case "--out": a.out = next(); break;
      case "--json": a.json = true; break;
      case "-h": case "--help":
        console.log("usage: summarize.ts <youtube-url> [--mode full|tldr|chapters|notes] [--prompt text] [--model id] [--processing agentic|static] [--start 1m30s] [--end 5m] [--lang code] [--out file] [--json]");
        Deno.exit(0);
      default:
        if (k.startsWith("--")) die(`unknown flag ${k}`);
        if (a.url) die(`unexpected argument ${k}`);
        a.url = k;
    }
  }
  if (!a.url) die("a YouTube URL is required");
  if (!/^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//.test(a.url)) die(`not a YouTube URL: ${a.url}`);
  if (!a.prompt && !MODES[a.mode!]) die(`unknown mode ${a.mode} (use ${Object.keys(MODES).join(", ")})`);
  if (!["agentic", "static"].includes(a.processing!)) die(`--processing must be agentic or static`);
  return a as Args;
}

/** "90", "90s", "1m30s", "1:30", "1:02:03" -> "90s" */
function toOffset(t: string): string {
  if (/^\d+:\d{1,2}(:\d{1,2})?$/.test(t)) {
    return `${t.split(":").map(Number).reduce((acc, n) => acc * 60 + n, 0)}s`;
  }
  const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
  if (!m || t === "") die(`bad time ${t} (use 90, 1m30s or 1:30)`);
  return `${(+(m[1] ?? 0)) * 3600 + (+(m[2] ?? 0)) * 60 + (+(m[3] ?? 0))}s`;
}

function buildPrompt(a: Args): string {
  let p = a.prompt ?? MODES[a.mode];
  if (a.start || a.end) p += `\n\nOnly the clip from ${a.start ?? "the start"} to ${a.end ?? "the end"} is provided; timestamps may be relative to the clip.`;
  if (a.lang) p += `\n\nWrite the entire response in language: ${a.lang}.`;
  return p;
}

async function post(path: string, body: unknown, key: string) {
  const res = await fetch(`${API}/${path}`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function viaInteractions(a: Args, prompt: string, key: string, processing?: "agentic") {
  const video: Record<string, string> = { type: "video", uri: a.url };
  if (processing) video.processing = processing;
  const r = await post("interactions", { model: a.model, input: [video, { type: "text", text: prompt }] }, key);
  if (!r.ok) return { error: r.data?.error?.message ?? `HTTP ${r.status}`, status: r.status };
  const d = r.data;
  const text = (d.steps ?? [])
    .filter((s: { type: string }) => s.type === "model_output")
    .flatMap((s: { content?: { type: string; text?: string }[] }) => s.content ?? [])
    .filter((c: { type: string }) => c.type === "text")
    .map((c: { text: string }) => c.text)
    .join("");
  if (d.status !== "completed" || !text) return { error: `interaction ${d.id} ended with status ${d.status} and no text`, status: 200 };
  return { text, tokens: d.usage?.total_tokens as number | undefined, processing: processing ?? "static" };
}

async function viaGenerateContent(a: Args, prompt: string, key: string) {
  const videoMetadata: Record<string, string> = {};
  if (a.start) videoMetadata.startOffset = toOffset(a.start);
  if (a.end) videoMetadata.endOffset = toOffset(a.end);
  const r = await post(`models/${a.model}:generateContent`, {
    contents: [{ parts: [{ fileData: { fileUri: a.url }, videoMetadata }, { text: prompt }] }],
  }, key);
  if (!r.ok) return { error: r.data?.error?.message ?? `HTTP ${r.status}`, status: r.status };
  const text = (r.data.candidates?.[0]?.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? "")
    .join("");
  if (!text) return { error: `no text returned (finishReason: ${r.data.candidates?.[0]?.finishReason ?? "unknown"})`, status: 200 };
  return { text, tokens: r.data.usageMetadata?.totalTokenCount as number | undefined, processing: "static (clip)" };
}

async function videoInfo(url: string): Promise<{ title?: string; author_name?: string }> {
  try {
    const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(10_000) });
    return r.ok ? await r.json() : {};
  } catch {
    return {};
  }
}

const a = parseArgs(Deno.args);
const key = Deno.env.get("GEMINI_API_KEY") ?? die("GEMINI_API_KEY is not set");
const prompt = buildPrompt(a);
const infoP = videoInfo(a.url);

let result;
if (a.start || a.end) {
  result = await viaGenerateContent(a, prompt, key);
} else if (a.processing === "agentic") {
  result = await viaInteractions(a, prompt, key, "agentic");
  if ("error" in result && result.status !== 401 && result.status !== 403 && result.status !== 429) {
    console.error(`agentic processing failed (${result.error}); retrying with static processing`);
    result = await viaInteractions(a, prompt, key);
  }
} else {
  result = await viaInteractions(a, prompt, key);
}

if ("error" in result) die(`Gemini API: ${result.error}`);

const info = await infoP;
if (a.json) {
  console.log(JSON.stringify({ url: a.url, title: info.title, channel: info.author_name, model: a.model, processing: result.processing, tokens: result.tokens, summary: result.text }, null, 2));
} else {
  const header = info.title ? `# ${info.title}\n\n**Channel:** ${info.author_name ?? "unknown"} · **URL:** ${a.url}\n\n` : `**URL:** ${a.url}\n\n`;
  const doc = header + result.text.trim() + "\n";
  if (a.out) {
    await Deno.writeTextFile(a.out, doc);
    console.error(`saved to ${a.out}`);
  }
  console.log(doc);
}
console.error(`model=${a.model} processing=${result.processing} tokens=${result.tokens ?? "?"}`);
