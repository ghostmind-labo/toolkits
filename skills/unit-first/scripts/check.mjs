#!/usr/bin/env node
// Check a unit-first playground without a browser.
//   node check.mjs <playground.html>
// It runs the page's script against a fake DOM and a fake canvas, then:
//   1. runs every entry of CHECKS and compares it with the expected value;
//   2. draws every step at its defaults, at each control's min and max, and after each button,
//      and prints the result line of the defaults;
//   3. fails when a draw throws, returns nothing, or prints NaN, undefined or Infinity.
// Exit code 0 when all pass, 1 otherwise.
import { readFileSync } from "node:fs";
import vm from "node:vm";

const file = process.argv[2];
if (!file) { console.error("usage: node check.mjs <playground.html>"); process.exit(2); }
const html = readFileSync(file, "utf8");
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (!scripts.length) { console.error("no inline <script> found"); process.exit(2); }

// A canvas context that accepts every call and records nothing.
const ctx = new Proxy({}, {
  get: (t, k) => k in t ? t[k] : k === "measureText" ? () => ({ width: 10 }) : () => {},
  set: (t, k, v) => { t[k] = v; return true; },
});
// An element that is whatever the stepper asks for.
function el() {
  const e = { style: {}, children: [], className: "", textContent: "", innerHTML: "", title: "",
    clientWidth: 640, clientHeight: 330, width: 0, height: 0,
    append(...c) { this.children.push(...c); }, addEventListener() {},
    querySelector: () => el(), getContext: () => ctx };
  e.querySelectorAll = () => e.children;
  return e;
}
const sandbox = {
  console, Math, Number, String, Object, Array, JSON, isFinite, isNaN, Float64Array, Uint8Array,
  document: { querySelector: () => el(), createElement: () => el() },
  getComputedStyle: () => ({ getPropertyValue: k => "#" + k.replace(/\W/g, "").slice(0, 6).padEnd(6, "0") }),
  devicePixelRatio: 2,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const s of scripts) vm.runInContext(s, sandbox, { filename: file });

const ufp = sandbox.__UFP__;
if (!ufp) { console.error("the script did not expose globalThis.__UFP__ (keep section 5 of the template)"); process.exit(2); }
ufp.readTheme();
let fails = 0;
const bad = s => typeof s !== "string" || !s.trim() || /NaN|undefined|Infinity/.test(s);
const eq = (a, b, tol = 1e-9) => Array.isArray(a) || Array.isArray(b)
  ? Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => eq(x, b[i], tol))
  : typeof a === "number" && typeof b === "number" ? Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)) : a === b;

console.log("CHECKS");
for (const [label, fn, want, tol] of ufp.CHECKS || []) {
  let got; try { got = fn(); } catch (e) { got = "threw: " + e.message; }
  const ok = eq(got, want, tol ?? 1e-9);
  if (!ok) fails++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}${ok ? "" : `\n       got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
}
if (!(ufp.CHECKS || []).length) { console.log("  FAIL no CHECKS: add known values of the math"); fails++; }

console.log("STEPS");
ufp.STEPS.forEach((s, i) => {
  const base = Object.fromEntries(s.c.map(([k, , , , , d]) => [k, d]));
  const cases = [["defaults", { ...base }]];
  for (const [k, , min, max] of s.c) { cases.push([`${k}=min`, { ...base, [k]: min }], [`${k}=max`, { ...base, [k]: max }]); }
  for (const [label, fn] of s.btn || []) { const v = { ...base }; fn(v); cases.push([`button "${label}"`, v]); }
  for (const [W, H] of [[640, 330], [320, 330]]) for (const [name, v] of cases) {
    let r; try { r = s.draw(ctx, W, H, v); } catch (e) { r = "threw: " + e.message; }
    if (bad(r) || r.startsWith("threw")) { fails++; console.log(`  FAIL step ${i + 1} (${s.t}) at ${name}, ${W}px: ${r}`); }
    else if (name === "defaults" && W === 640) console.log(`  ok   ${i + 1}. ${s.t}\n       ${r.replace(/<[^>]+>/g, "")}`);
  }
  if (s.c.length === 0 && !(s.btn || []).length) { fails++; console.log(`  FAIL step ${i + 1} has no control: each step needs one thing to move`); }
});
console.log(fails ? `\n${fails} failure(s)` : "\nall passed");
process.exit(fails ? 1 : 0);
