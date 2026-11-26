// i18n-check.js — verifies the Cassinosuke hub language switcher.
// Usage: node i18n-check.js
// Checks: script parses (no syntax errors), I18N dict has every key in all
// 7 languages, every data-i18n / data-i18n-alt key in the HTML exists in the
// dict, switching updates all text/alt/title/html lang/localStorage, stored
// choice and navigator.language detection work, and missing keys fall back
// to English. Also does a lightweight HTML tag-balance check.
"use strict";
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const htmlPath = path.join(__dirname, "index.html");
const html = fs.readFileSync(htmlPath, "utf8");
let failures = 0;
let checks = 0;
function check(name, ok, extra) {
  checks++;
  if (ok) {
    console.log("  PASS " + name);
  } else {
    failures++;
    console.log("  FAIL " + name + (extra ? " — " + extra : ""));
  }
}

const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) { console.log("FAIL: no <script> block found"); process.exit(1); }
const scriptSrc = scriptMatch[1];

// ---- DOM stub -------------------------------------------------------------
function makeEl(attrs) {
  const el = {
    _attrs: Object.assign({}, attrs),
    textContent: "",
    _listeners: {},
    getAttribute(n) { return this._attrs[n]; },
    setAttribute(n, v) { this._attrs[n] = v; },
    addEventListener(ev, fn) { this._listeners[ev] = fn; },
    click() { if (this._listeners.click) this._listeners.click.call(this); },
  };
  return el;
}

function buildSandbox(opts) {
  opts = opts || {};
  const store = Object.assign({}, opts.stored || {});
  const i18nEls = [];
  const altEls = [];
  const btnEls = [];
  const reI18n = /data-i18n="([^"]+)"/g;
  const reAlt = /data-i18n-alt="([^"]+)"/g;
  const reBtn = /<button[^>]*data-lang="([^"]+)"[^>]*>/g;
  let m;
  while ((m = reI18n.exec(html))) i18nEls.push(makeEl({ "data-i18n": m[1] }));
  while ((m = reAlt.exec(html))) altEls.push(makeEl({ "data-i18n-alt": m[1] }));
  while ((m = reBtn.exec(html))) btnEls.push(makeEl({ "data-lang": m[1], "aria-pressed": "false" }));
  const meta = makeEl({ content: "" });
  const documentElement = { lang: "en" };
  const documentStub = {
    documentElement,
    title: "",
    querySelectorAll(sel) {
      if (sel === "[data-i18n]") return i18nEls;
      if (sel === "[data-i18n-alt]") return altEls;
      if (sel === ".langbar button") return btnEls;
      return [];
    },
    querySelector(sel) {
      if (sel === 'meta[name="description"]') return meta;
      return null;
    },
  };
  const sandbox = {
    document: documentStub,
    navigator: { language: opts.navigatorLanguage || "en-US" },
    localStorage: {
      getItem(k) { return k in store ? store[k] : null; },
      setItem(k, v) { store[k] = String(v); },
    },
    console,
    _store: store,
    _i18nEls: i18nEls,
    _altEls: altEls,
    _btnEls: btnEls,
    _meta: meta,
  };
  sandbox.window = sandbox;
  return sandbox;
}

function runScript(sandbox) {
  vm.createContext(sandbox);
  vm.runInContext(scriptSrc, sandbox, { filename: "hub-i18n.js" });
  return sandbox;
}

// ---- 1. Script parses and runs -------------------------------------------
console.log("== 1. script parse / run ==");
let sb;
try {
  sb = runScript(buildSandbox());
  check("script parses and runs without error", true);
} catch (e) {
  check("script parses and runs without error", false, e.message);
  process.exit(1);
}

// ---- 2. I18N dict completeness -------------------------------------------
console.log("== 2. I18N dict completeness ==");
const I18N = sb.I18N;
const LANGS = ["en", "pt", "es", "zh", "ja", "fr", "ko"];
check("I18N has all 7 languages", LANGS.every((l) => I18N[l]));
const enKeys = Object.keys(I18N.en);
console.log("  keys in en: " + enKeys.length);
for (const lang of LANGS) {
  const keys = Object.keys(I18N[lang]);
  const missing = enKeys.filter((k) => !(k in I18N[lang]));
  const extra = keys.filter((k) => enKeys.indexOf(k) === -1);
  const empty = keys.filter((k) => !I18N[lang][k] || !String(I18N[lang][k]).trim());
  check(lang + ": " + keys.length + " keys, none missing/extra/empty",
    missing.length === 0 && extra.length === 0 && empty.length === 0,
    "missing=" + JSON.stringify(missing) + " extra=" + JSON.stringify(extra) + " empty=" + JSON.stringify(empty));
}
// No placeholder text
// (TODO/XXX matched case-sensitively: "todo/todos" is a normal word in pt/es)
const placeholderRe = /lorem|placeholder|\bTODO\b|\bXXX\b/;
const bad = [];
for (const lang of LANGS) for (const k of Object.keys(I18N[lang])) {
  if (placeholderRe.test(I18N[lang][k])) bad.push(lang + ":" + k);
}
check("no placeholder / lorem text in any language", bad.length === 0, JSON.stringify(bad));
// Proper names preserved in every language
const proper = ["Five-Card Poker", "Black Nyack", "RNG Chess", "Cavalaria", "Wellington",
  "Battle Bonyas", "Nyau", "Cthulhu Ascending", "Andrée Wallin", "CULT-ULHU"];
const nameFails = [];
for (const lang of LANGS) {
  const all = Object.values(I18N[lang]).join(" ");
  for (const n of proper) if (all.indexOf(n) === -1) nameFails.push(lang + " missing " + n);
}
check("proper names intact in all languages", nameFails.length === 0, JSON.stringify(nameFails));

// ---- 3. Every HTML key exists in the dict --------------------------------
console.log("== 3. HTML keys covered by dict ==");
const htmlKeys = new Set();
for (const el of sb._i18nEls) htmlKeys.add(el.getAttribute("data-i18n"));
for (const el of sb._altEls) htmlKeys.add(el.getAttribute("data-i18n-alt"));
const uncovered = [...htmlKeys].filter((k) => !(k in I18N.en));
check("all " + htmlKeys.size + " data-i18n/data-i18n-alt keys exist in dict",
  uncovered.length === 0, JSON.stringify(uncovered));
check("switcher has 7 language buttons", sb._btnEls.length === 7,
  "found " + sb._btnEls.length);

// ---- 4. Switching works for every language -------------------------------
console.log("== 4. switching ==");
for (const lang of LANGS) {
  const s = runScript(buildSandbox());
  s.applyLang(lang);
  const textOk = s._i18nEls.every((el) => el.textContent === s.I18N[lang][el.getAttribute("data-i18n")]);
  const altOk = s._altEls.every((el) => el.getAttribute("alt") === s.I18N[lang][el.getAttribute("data-i18n-alt")]);
  const titleOk = s.document.title === s.I18N[lang]["meta.title"];
  const metaOk = s._meta.getAttribute("content") === s.I18N[lang]["meta.description"];
  const langOk = s.document.documentElement.lang === lang;
  const storeOk = s._store.lang === lang;
  const pressed = s._btnEls.filter((b) => b.getAttribute("aria-pressed") === "true");
  const pressedOk = pressed.length === 1 && pressed[0].getAttribute("data-lang") === lang;
  const nonEmpty = s._i18nEls.every((el) => el.textContent && el.textContent.trim().length > 0);
  check(lang + ": text+alt+title+meta+html lang+localStorage+aria-pressed all applied",
    textOk && altOk && titleOk && metaOk && langOk && storeOk && pressedOk && nonEmpty,
    JSON.stringify({ textOk, altOk, titleOk, metaOk, langOk, storeOk, pressedOk, nonEmpty }));
  // Spot-check one distinctive translated string per language
  const spot = { pt: "Cinco jogos", es: "Cinco juegos", zh: "五款免费游戏", ja: "無料ゲーム5つ", fr: "Cinq jeux gratuits", ko: "무료 게임 다섯 개", en: "Five free games" }[lang];
  const tagline = s._i18nEls.find((el) => el.getAttribute("data-i18n") === "tagline.a").textContent;
  check(lang + ": tagline reads as expected", tagline.indexOf(spot) !== -1, tagline);
}

// ---- 5. Click path + detection + fallback --------------------------------
console.log("== 5. click, detection, fallback ==");
{
  const s = runScript(buildSandbox({ navigatorLanguage: "en-US" }));
  const koBtn = s._btnEls.find((b) => b.getAttribute("data-lang") === "ko");
  koBtn.click();
  check("clicking KO button switches language", s.document.documentElement.lang === "ko" && s._store.lang === "ko");
}
{
  const s = runScript(buildSandbox({ stored: { lang: "pt" }, navigatorLanguage: "en-US" }));
  check("stored 'lang=pt' wins on load", s.document.documentElement.lang === "pt",
    "got " + s.document.documentElement.lang);
}
{
  const s = runScript(buildSandbox({ navigatorLanguage: "ja-JP" }));
  check("navigator ja-JP maps to ja", s.document.documentElement.lang === "ja",
    "got " + s.document.documentElement.lang);
}
{
  const s = runScript(buildSandbox({ navigatorLanguage: "pt-BR" }));
  check("navigator pt-BR maps to pt", s.document.documentElement.lang === "pt",
    "got " + s.document.documentElement.lang);
}
{
  const s = runScript(buildSandbox({ navigatorLanguage: "de-DE" }));
  check("unsupported navigator language falls back to en", s.document.documentElement.lang === "en",
    "got " + s.document.documentElement.lang);
}
{
  const s = runScript(buildSandbox({ stored: { lang: "xx" }, navigatorLanguage: "fr-FR" }));
  check("invalid stored value falls through to navigator (fr)", s.document.documentElement.lang === "fr",
    "got " + s.document.documentElement.lang);
}
{
  const s = runScript(buildSandbox());
  delete s.I18N.ko["poker.desc"];
  const got = s.t("poker.desc", "ko");
  check("missing key falls back to English", got === s.I18N.en["poker.desc"], String(got).slice(0, 60));
}
{
  const s = runScript(buildSandbox());
  check("applyLang('xx') falls back to en", (s.applyLang("xx"), s.document.documentElement.lang === "en"));
}

// ---- 6. Lightweight HTML tag balance --------------------------------------
console.log("== 6. HTML structure ==");
{
  const voidEls = new Set(["meta", "br", "img", "link", "input", "hr"]);
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*\/?>/g;
  const stack = [];
  let m2, bad2 = null;
  while ((m2 = tagRe.exec(html))) {
    const full = m2[0], name = m2[1].toLowerCase();
    if (full.startsWith("</")) {
      if (stack.length === 0 || stack[stack.length - 1] !== name) { bad2 = "mismatched close </" + name + ">"; break; }
      stack.pop();
    } else if (!full.endsWith("/>") && !voidEls.has(name)) {
      stack.push(name);
    }
  }
  if (!bad2 && stack.length) bad2 = "unclosed: " + stack.join(", ");
  check("HTML tags balanced", !bad2, bad2 || "");
  check("version string present in footer", html.indexOf("Cassinosuke Games v1.0.0") !== -1);
  check("all game links unchanged", [
    "https://five-card-poker.pages.dev",
    "https://black-nyack.pages.dev",
    "https://rng-chess.pages.dev",
    "https://cavalaria.pages.dev",
    "https://wellington-online.pages.dev",
    "https://cultulhu-lobby.pages.dev/",
    "https://github.com/HMJ-ONES/CULTHULU",
  ].every((u) => html.indexOf(u) !== -1));
}

console.log("\n" + checks + " checks, " + failures + " failures");
process.exit(failures ? 1 : 0);
