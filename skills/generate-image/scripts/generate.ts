#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --allow-write
/**
 * Generate images across providers, routing by job.
 *
 *   Google  (GEMINI_API_KEY): Nano Banana 2 / Pro / Lite  — photoreal, illustration, volume
 *   OpenAI  (OPENAI_API_KEY): GPT Image 2.5 flare/sunburst — text in image, layout, editing
 *
 * Keys are read from the environment, falling back to ~/.env (KEY=value lines).
 *
 * Usage:
 *   generate.ts "a red fox sticker" [--for cartoon|photo|text|diagram|icon|draft]
 *               [--model <id>] [--compare a,b] [--n 3] [--aspect 16:9] [--size 1K|2K|4K|1024x1024]
 *               [--quality low|medium|high] [--edit in.png] [--out dir] [--json]
 */

const GOOGLE = "https://generativelanguage.googleapis.com/v1beta";
const OPENAI = "https://api.openai.com/v1";

/** Job -> model. Verified ids; see references/models.md. */
const ROUTES: Record<string, string> = {
  cartoon: "gemini-3.1-flash-image",       // stylized, fast, cheap
  illustration: "gemini-3.1-flash-image",
  photo: "gemini-3-pro-image",             // photoreal hero / product
  product: "gemini-3-pro-image",
  text: "gpt-image-2.5-flare",             // readable words in the image
  diagram: "gpt-image-2.5-flare",
  ui: "gpt-image-2.5-flare",
  poster: "gpt-image-2.5-flare",
  icon: "gemini-3.1-flash-image",
  draft: "gemini-3.1-flash-lite-image",    // cheapest, for iterating
  edit: "gpt-image-2.5-sunburst",          // editing precision
};
const DEFAULT_JOB = "illustration";
const FALLBACK: Record<string, string> = {
  // when an OpenAI model is unusable (no credits / no key), this is the next best
  "gpt-image-2.5-flare": "gemini-3-pro-image",
  "gpt-image-2.5-sunburst": "gemini-3-pro-image",
};

const isOpenAI = (m: string) => m.startsWith("gpt-image") || m.startsWith("chatgpt-image");

type Args = {
  prompt: string;
  job: string;
  models: string[];
  n: number;
  aspect?: string;
  size?: string;
  quality?: string;
  edit?: string;
  out: string;
  json: boolean;
};

function die(msg: string): never {
  console.error(`error: ${msg}`);
  Deno.exit(1);
}

/** Environment first, then ~/.env — keys commonly live there on this machine. */
function loadKey(name: string): string | undefined {
  const fromEnv = Deno.env.get(name);
  if (fromEnv) return fromEnv;
  try {
    const home = Deno.env.get("HOME");
    if (!home) return undefined;
    for (const line of Deno.readTextFileSync(`${home}/.env`).split("\n")) {
      const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m && m[1] === name) return m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch { /* no ~/.env */ }
  return undefined;
}

function parseArgs(argv: string[]): Args {
  const a: Partial<Args> & { models?: string[] } = { n: 1, out: "generated-images", json: false };
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const next = () => argv[++i] ?? die(`missing value for ${k}`);
    switch (k) {
      case "--for": a.job = next(); break;
      case "--model": a.models = [next()]; break;
      case "--compare": a.models = next().split(",").map((s) => s.trim()).filter(Boolean); break;
      case "--n": a.n = Number(next()) || die("--n must be a number"); break;
      case "--aspect": a.aspect = next(); break;
      case "--size": a.size = next(); break;
      case "--quality": a.quality = next(); break;
      case "--edit": a.edit = next(); break;
      case "--out": a.out = next(); break;
      case "--json": a.json = true; break;
      case "-h": case "--help":
        console.log(`usage: generate.ts "<prompt>" [--for ${Object.keys(ROUTES).join("|")}] [--model id] [--compare a,b] [--n N] [--aspect 16:9] [--size 1K|2K|4K|1024x1024] [--quality low|medium|high] [--edit file] [--out dir] [--json]`);
        Deno.exit(0);
      default:
        if (k.startsWith("--")) die(`unknown flag ${k}`);
        rest.push(k);
    }
  }
  a.prompt = rest.join(" ").trim();
  if (!a.prompt) die("a prompt is required");
  a.job ??= a.edit ? "edit" : DEFAULT_JOB;
  if (!a.models) {
    const m = ROUTES[a.job] ?? die(`unknown job ${a.job} (use ${Object.keys(ROUTES).join(", ")})`);
    a.models = [m];
  }
  if (a.n! < 1 || a.n! > 8) die("--n must be between 1 and 8");
  return a as Args;
}

type Img = { bytes: Uint8Array; ext: string };
type Result = { model: string; images: Img[]; note?: string };

async function google(model: string, a: Args, key: string): Promise<Img[]> {
  const parts: unknown[] = [{ text: a.prompt }];
  if (a.edit) {
    const bytes = await Deno.readFile(a.edit);
    const b64 = btoa(String.fromCharCode(...bytes));
    const mime = a.edit.endsWith(".jpg") || a.edit.endsWith(".jpeg") ? "image/jpeg" : "image/png";
    parts.unshift({ inlineData: { mimeType: mime, data: b64 } });
  }
  const imageConfig: Record<string, string> = {};
  if (a.aspect) imageConfig.aspectRatio = a.aspect;
  if (a.size && /^[0-9]K$/i.test(a.size)) imageConfig.imageSize = a.size.toUpperCase();

  const out: Img[] = [];
  for (let i = 0; i < a.n; i++) {
    const res = await fetch(`${GOOGLE}/models/${model}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseModalities: ["IMAGE"], ...(Object.keys(imageConfig).length ? { imageConfig } : {}) },
      }),
      signal: AbortSignal.timeout(10 * 60 * 1000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message ?? `HTTP ${res.status}`);
    const inline = (data.candidates?.[0]?.content?.parts ?? []).find((p: Record<string, unknown>) => p.inlineData);
    if (!inline) throw new Error(`no image returned (finishReason: ${data.candidates?.[0]?.finishReason ?? "unknown"})`);
    const raw = atob(inline.inlineData.data);
    const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
    out.push({ bytes, ext: inline.inlineData.mimeType === "image/jpeg" ? "jpg" : "png" });
  }
  return out;
}

async function openai(model: string, a: Args, key: string): Promise<Img[]> {
  let res: Response;
  if (a.edit) {
    const form = new FormData();
    form.append("model", model);
    form.append("prompt", a.prompt);
    form.append("n", String(a.n));
    if (a.size && a.size.includes("x")) form.append("size", a.size);
    if (a.quality) form.append("quality", a.quality);
    const bytes = await Deno.readFile(a.edit);
    form.append("image", new Blob([bytes]), a.edit.split("/").pop() ?? "image.png");
    res = await fetch(`${OPENAI}/images/edits`, { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form, signal: AbortSignal.timeout(10 * 60 * 1000) });
  } else {
    res = await fetch(`${OPENAI}/images/generations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: a.prompt,
        n: a.n,
        ...(a.size?.includes("x") ? { size: a.size } : {}),
        ...(a.quality ? { quality: a.quality } : {}),
      }),
      signal: AbortSignal.timeout(10 * 60 * 1000),
    });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message ?? `HTTP ${res.status}`);
  return (data.data ?? []).map((d: { b64_json?: string }) => {
    if (!d.b64_json) throw new Error("response had no b64_json image data");
    const raw = atob(d.b64_json);
    return { bytes: Uint8Array.from(raw, (c) => c.charCodeAt(0)), ext: "png" };
  });
}

async function run(model: string, a: Args): Promise<Result> {
  const provider = isOpenAI(model) ? "openai" : "google";
  const key = loadKey(provider === "openai" ? "OPENAI_API_KEY" : "GEMINI_API_KEY");
  if (!key) throw new Error(`${provider === "openai" ? "OPENAI_API_KEY" : "GEMINI_API_KEY"} is not set (checked environment and ~/.env)`);
  const images = provider === "openai" ? await openai(model, a, key) : await google(model, a, key);
  return { model, images };
}

async function runWithFallback(model: string, a: Args): Promise<Result> {
  try {
    return await run(model, a);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const alt = FALLBACK[model];
    if (!alt) throw e;
    console.error(`${model} failed (${msg})\nfalling back to ${alt}`);
    const r = await run(alt, a);
    return { ...r, note: `fell back from ${model}: ${msg}` };
  }
}

const a = parseArgs(Deno.args);
await Deno.mkdir(a.out, { recursive: true });

const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
const slug = a.prompt.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

const settled = await Promise.allSettled(a.models.map((m) => runWithFallback(m, a)));
const saved: { model: string; path: string; note?: string }[] = [];
const failed: { model: string; error: string }[] = [];

for (const [i, s] of settled.entries()) {
  const model = a.models[i];
  if (s.status === "rejected") {
    failed.push({ model, error: s.reason instanceof Error ? s.reason.message : String(s.reason) });
    continue;
  }
  for (const [j, img] of s.value.images.entries()) {
    const suffix = s.value.images.length > 1 ? `-${j + 1}` : "";
    const path = `${a.out}/${stamp}-${slug}-${s.value.model}${suffix}.${img.ext}`;
    await Deno.writeFile(path, img.bytes);
    saved.push({ model: s.value.model, path, note: s.value.note });
  }
}

if (a.json) {
  console.log(JSON.stringify({ prompt: a.prompt, job: a.job, saved, failed }, null, 2));
} else {
  for (const s of saved) console.log(`${s.path}${s.note ? `  (${s.note})` : ""}`);
  for (const f of failed) console.error(`failed: ${f.model} — ${f.error}`);
}
if (!saved.length) Deno.exit(1);
