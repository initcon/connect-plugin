// Connect 0.1.4 (T1098): Schickt beim Sitzungsstart den Stand der Regeln an Connect (Seite „Regeln“ unter Team, ab Connect 0.18.15).
//
// Was mitgeht, und nur das:
//  - aus jeder Datei in .claude/agents/: die Kopfzeilen name, description, model, tools und die Zeilen unter „## Steckbrief“,
//  - aus der CLAUDE.md: die Zeilen unter „## Steckbrief“ (Manager) und die Abschnitte mit den Überschriften aus ABSCHNITTE,
//  - je Hook (Projekt und eingeschaltete Plugins): Ereignis, Matcher, Art, eine Kurzbeschreibung und die Herkunft,
//  - je eingeschaltetes Plugin: Name, Version, Beschreibung und die Regeldateien, die es beim Start lädt.
// Keine ganzen Dateien, keine Erinnerungen (memory), nichts aus dem übrigen Inhalt, keine Befehle im Wortlaut.
//
// Ein Fehler hält den Start nie auf: alles in try/catch, Ausgabe nur ins Leere, Exit-Code immer 0, Zeitlimit für die Anfrage.
// Schlüssel und Adresse kommen aus der Umgebung (Claude Code setzt CLAUDE_PLUGIN_OPTION_<KEY> für Hooks), nie aus der Befehlszeile.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

export const PLUGIN_VERSION = "0.1.4";
export const METHODE = "initcon/regeln_melden";
/** Überschriften (Ebene 2) der CLAUDE.md, die als Regeln gelten: Anfang der Überschrift, ohne Groß- und Kleinschreibung */
export const ABSCHNITTE = ["Arbeitsweise", "Leitbild", "Freigabe", "Sprache", "Regeln", "Grenzen", "Datenschutz"];
const MAX_BYTES = 60_000;
const ZEITLIMIT_MS = 4000;

const lesen = (p) => { try { return readFileSync(p, "utf8").replace(/\r\n?/g, "\n"); } catch { return null; } };
const json = (p) => { const t = lesen(p); if (t === null) return null; try { return JSON.parse(t); } catch { return null; } };
const ohneKommentare = (t) => t.replace(/<!--[\s\S]*?-->/g, "");

/** Kopfzeilen zwischen den ersten beiden „---“; Listen (- x) werden mit Komma verbunden */
export function kopfzeilen(text) {
  const m = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(text);
  const aus = {};
  if (!m) return aus;
  let schluessel = null;
  for (const zeile of m[1].split("\n")) {
    const k = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(zeile);
    if (k) { schluessel = k[1]; aus[schluessel] = k[2].replace(/^["']|["']$/g, "").trim(); continue; }
    const li = /^\s+-\s+(.*)$/.exec(zeile);
    if (li && schluessel) aus[schluessel] = [aus[schluessel], li[1].replace(/^["']|["']$/g, "").trim()].filter(Boolean).join(", ");
  }
  return aus;
}

/** Zeilen „- Feld: Wert“ unter einer Überschrift „## Steckbrief“ (oder ###), bis zur nächsten Überschrift */
export function steckbrief(text) {
  const zeilen = ohneKommentare(text).split("\n");
  const start = zeilen.findIndex((z) => /^#{2,3}\s+Steckbrief\s*$/i.test(z));
  if (start < 0) return [];
  const aus = [];
  for (const z of zeilen.slice(start + 1)) {
    if (/^#{1,3}\s/.test(z)) break;
    const m = /^\s*[-*]\s+\**([A-ZÄÖÜ][\wäöüßÄÖÜ -]{0,30}?)\**:\**\s+(.+)$/.exec(z);
    if (m) aus.push({ feld: m[1].trim(), wert: m[2].trim() });
  }
  return aus;
}

/** Abschnitte der Ebene 2, deren Überschrift mit einem Wort aus ABSCHNITTE beginnt; Text bis zur nächsten Überschrift Ebene 1–2 */
export function abschnitte(text, woerter = ABSCHNITTE) {
  const zeilen = ohneKommentare(text).split("\n");
  const aus = [];
  let akt = null, imCode = false;
  for (const z of zeilen) {
    if (/^\s*(```|~~~)/.test(z)) imCode = !imCode;
    const kopf = !imCode && /^(#{1,2})\s+(.+?)\s*#*\s*$/.exec(z);
    if (kopf) {
      if (akt) aus.push(akt);
      const titel = kopf[2].trim();
      akt = kopf[1].length === 2 && woerter.some((w) => titel.toLowerCase().startsWith(w.toLowerCase())) ? { titel, text: "" } : null;
      continue;
    }
    if (akt) akt.text += z + "\n";
  }
  if (akt) aus.push(akt);
  return aus.map((a) => ({ titel: a.titel, text: a.text.trim() })).filter((a) => a.text);
}

/** Kurzbeschreibung eines Hooks ohne den Befehl im Wortlaut */
export function hookKurz(h) {
  const art = h && h.type;
  if (art === "mcp_tool") {
    const was = h.input && typeof h.input.was === "string" ? ": " + h.input.was : "";
    return String(h.tool || "") + was;
  }
  if (art === "command") {
    const teile = String(h.command || "").split(/\s+/).filter(Boolean).map((t) => t.replace(/^["']+|["';]+$/g, ""))
      .filter((t) => t && !/^[<>|&]|^\d?>|^\/dev\/null$/.test(t) && !/^(-|exit$|command$|then$|fi$)/.test(t));
    // Nur das Programm und der Name des Skripts, nie weitere Angaben (sie können Schlüssel enthalten)
    const skript = teile.find((t) => t.includes("/"));
    const programm = teile[0] && !teile[0].includes("/") && !/[$=]/.test(teile[0]) ? teile[0] : "";
    return [programm, skript ? path.basename(skript) : ""].filter(Boolean).join(" ").slice(0, 80);
  }
  if (art === "prompt" || art === "agent") return String(h.prompt || "").split(/(?<=[.:!?])\s|\n/)[0].slice(0, 80);
  if (art === "http") { try { return new URL(String(h.url)).host; } catch { return "http"; } }
  return String(art || "");
}

/** Hooks aus einem Objekt { Ereignis: [{ matcher, hooks: [...] }] } */
export function hooksAus(obj, herkunft) {
  const aus = [];
  if (!obj || typeof obj !== "object") return aus;
  for (const [ereignis, gruppen] of Object.entries(obj)) {
    if (!Array.isArray(gruppen)) continue;
    for (const g of gruppen) for (const h of (g && Array.isArray(g.hooks) ? g.hooks : [])) {
      aus.push({ ereignis, matcher: typeof g.matcher === "string" ? g.matcher : "", art: String(h.type || ""), kurz: hookKurz(h), herkunft });
    }
  }
  return aus;
}

/** Eingeschaltete Plugins: Benutzer, dann Projekt, dann lokal; spätere gehen vor */
export function eingeschaltet(projekt, home) {
  const an = {};
  for (const p of [path.join(home, ".claude", "settings.json"), path.join(projekt, ".claude", "settings.json"), path.join(projekt, ".claude", "settings.local.json")]) {
    const s = json(p);
    if (s && s.enabledPlugins && typeof s.enabledPlugins === "object") Object.assign(an, s.enabledPlugins);
  }
  return Object.entries(an).filter(([, v]) => v === true).map(([k]) => k);
}

/** Ordner eines installierten Plugins: Eintrag für dieses Projekt vor dem für den Benutzer */
function installiert(name, projekt, home) {
  const liste = json(path.join(home, ".claude", "plugins", "installed_plugins.json"));
  const eintraege = liste && liste.plugins && Array.isArray(liste.plugins[name]) ? liste.plugins[name] : [];
  const e = eintraege.find((x) => x.projectPath && path.resolve(x.projectPath) === path.resolve(projekt)) || eintraege.find((x) => x.scope === "user") || eintraege[0];
  return e && e.installPath ? { ordner: e.installPath, version: e.version || "" } : null;
}

/** Regeldateien, die ein Plugin beim Start lädt: SessionStart-Hook „cat "${CLAUDE_PLUGIN_ROOT}/….md"“ */
function regeldateien(ordner, hooks) {
  const aus = [];
  for (const g of (hooks && Array.isArray(hooks.SessionStart) ? hooks.SessionStart : [])) for (const h of (g && Array.isArray(g.hooks) ? g.hooks : [])) {
    const m = h.type === "command" && /^cat\s+"?\$\{CLAUDE_PLUGIN_ROOT\}\/([\w./-]+\.md)"?\s*$/.exec(String(h.command || ""));
    if (!m || m[1].includes("..")) continue;
    const t = lesen(path.join(ordner, m[1]));
    if (t && !aus.some((d) => d.datei === m[1])) aus.push({ datei: m[1], text: ohneKommentare(t).trim() });
  }
  return aus;
}

function pluginLesen(name, ordner, version) {
  const kopf = json(path.join(ordner, ".claude-plugin", "plugin.json")) || {};
  let hooks = null;
  if (kopf.hooks && typeof kopf.hooks === "object" && !Array.isArray(kopf.hooks)) hooks = kopf.hooks.hooks || kopf.hooks;
  else hooks = (json(path.join(ordner, "hooks", "hooks.json")) || {}).hooks || null;
  return {
    plugin: { name, version: kopf.version || version || "", beschreibung: String(kopf.description || ""), regeln: regeldateien(ordner, hooks) },
    hooks: hooksAus(hooks, "Plugin " + name),
  };
}

/** Alles einsammeln, was mitgeht */
export function sammeln({ projekt, home = os.homedir(), pluginRoot = null } = {}) {
  const meldung = { plugin_version: PLUGIN_VERSION, allgemein: [], hooks: [], plugins: [], assistenten: [], manager: null };
  const claude = lesen(path.join(projekt, "CLAUDE.md"));
  if (claude) {
    meldung.allgemein = abschnitte(claude);
    const s = steckbrief(claude);
    if (s.length) meldung.manager = { steckbrief: s };
  }
  const agenten = path.join(projekt, ".claude", "agents");
  if (existsSync(agenten)) {
    for (const datei of readdirSync(agenten).filter((d) => d.endsWith(".md")).sort()) {
      const t = lesen(path.join(agenten, datei));
      if (t === null) continue;
      const k = kopfzeilen(t);
      meldung.assistenten.push({ datei: datei.replace(/\.md$/, ""), name: k.name || datei.replace(/\.md$/, ""), beschreibung: k.description || "",
        modell: k.model || "", werkzeuge: k.tools || "", steckbrief: steckbrief(t) });
    }
  }
  for (const [p, wo] of [[path.join(projekt, ".claude", "settings.json"), "Projekt"], [path.join(projekt, ".claude", "settings.local.json"), "Projekt, nur dieser Rechner"]]) {
    const s = json(p);
    if (s && s.hooks) meldung.hooks.push(...hooksAus(s.hooks, wo));
  }
  const namen = eingeschaltet(projekt, home);
  const gesehen = new Set();
  for (const name of namen) {
    const inst = installiert(name, projekt, home);
    if (!inst || !existsSync(inst.ordner)) continue;
    const r = pluginLesen(name, inst.ordner, inst.version);
    meldung.plugins.push(r.plugin); meldung.hooks.push(...r.hooks); gesehen.add(path.resolve(inst.ordner));
  }
  // Dieses Plugin selbst, falls es nicht über die Liste kam (etwa mit --plugin-dir gestartet)
  if (pluginRoot && !gesehen.has(path.resolve(pluginRoot)) && existsSync(pluginRoot)) {
    const r = pluginLesen("connect@initcon", pluginRoot, PLUGIN_VERSION);
    if (!meldung.plugins.some((p) => p.name === "connect@initcon")) { meldung.plugins.push(r.plugin); meldung.hooks.push(...r.hooks); }
  }
  return kuerzen(meldung);
}

/** Unter MAX_BYTES bleiben: zuerst die Regeldateien der Plugins weglassen, dann Abschnitte von hinten */
export function kuerzen(m) {
  const groesse = () => Buffer.byteLength(JSON.stringify(m));
  if (groesse() > MAX_BYTES) for (const p of m.plugins) p.regeln = [];
  while (groesse() > MAX_BYTES && m.allgemein.length) m.allgemein.pop();
  return m;
}

export async function senden(meldung, { adresse, schluessel, fetchFn = fetch }) {
  const ziel = String(adresse || "https://app.initcon.ai").replace(/\/+$/, "") + "/mcp";
  const antwort = await fetchFn(ziel, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", Authorization: "Bearer " + schluessel, "MCP-Protocol-Version": "2025-06-18" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: METHODE, params: meldung }),
    signal: AbortSignal.timeout(ZEITLIMIT_MS),
  });
  return antwort.status;
}

async function haupt() {
  const schluessel = process.env.CLAUDE_PLUGIN_OPTION_SCHLUESSEL;
  const projekt = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const meldung = sammeln({ projekt, pluginRoot: process.env.CLAUDE_PLUGIN_ROOT || null });
  // Nur zum Prüfen: statt zu senden in eine Datei schreiben
  if (process.env.CONNECT_REGELN_AUSGABE) { writeFileSync(process.env.CONNECT_REGELN_AUSGABE, JSON.stringify(meldung, null, 2)); return; }
  if (!schluessel) return;
  await senden(meldung, { adresse: process.env.CLAUDE_PLUGIN_OPTION_ADRESSE, schluessel });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  haupt().catch(() => {}).finally(() => process.exit(0));
}
