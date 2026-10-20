// T1098 (Plugin 0.1.4): scripts/regeln-senden.mjs. Aufruf: node --test test/regeln-senden.test.mjs. Alle Daten erfunden (Malerbetrieb Brandt).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DATEI_MAX, ganz, hookKurz, kopfzeilen, kuerzen, METHODE, ohneKopf, sammeln, senden } from "../connect/scripts/regeln-senden.mjs";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const SKRIPT = path.join(HIER, "..", "connect", "scripts", "regeln-senden.mjs");
const PLUGIN = path.join(HIER, "..", "connect");

function ordnerAnlegen() {
  const wurzel = mkdtempSync(path.join(os.tmpdir(), "regeln-"));
  const projekt = path.join(wurzel, "brandt"), home = path.join(wurzel, "home");
  mkdirSync(path.join(projekt, ".claude", "agents"), { recursive: true });
  mkdirSync(path.join(projekt, ".claude", "memory"), { recursive: true });
  mkdirSync(path.join(home, ".claude", "plugins"), { recursive: true });
  writeFileSync(path.join(projekt, "CLAUDE.md"), `# Malerbetrieb Brandt – Manager

## Steckbrief
- Rolle: Verteilt die Aufträge von Frau Brandt.
- Darf: Dateien im Ordner Brandt lesen und ändern.

## Ablage
- INHALT-ABLAGE geht seit dem Nachtrag mit.

## Freigaben – immer erst fragen
- Mails **versenden** tut Frau Brandt selbst.
<!-- interne Notiz INHALT-KOMMENTAR -->

## Arbeitsweise
1. Auftrag verstehen.
\`\`\`
## Sprache im Codeblock ist keine Überschrift
\`\`\`
2. Kurz berichten.

## Sprache
Deutsch, Du-Form.
`);
  writeFileSync(path.join(projekt, ".claude", "agents", "postfach.md"), `---
name: postfach
description: Liest das Postfach und schreibt Antworten vor.
model: sonnet
tools:
  - Read
  - mcp__gmail__create_draft
---

Du bist der Postfach-Assistent. INHALT-AUFTRAGSTEXT geht mit.

## Steckbrief
- Rolle: Postfach-Assistent
- Freigabe: Löschen
- Darf: Mails lesen, Entwürfe schreiben. Nichts abschicken.

## Arbeitsweise des Assistenten
- INHALT-ARBEITSWEISE
`);
  writeFileSync(path.join(projekt, ".claude", "agents", "buero.md"), "---\nname: buero\ndescription: Büro\ntools: Read, Write\n---\nOhne Steckbrief.\n");
  writeFileSync(path.join(projekt, ".claude", "memory", "MEMORY.md"), "GEHEIM-ERINNERUNG\n");
  writeFileSync(path.join(projekt, ".claude", "agents", "notiz.txt"), "GEHEIM-ANDERE\n");
  writeFileSync(path.join(projekt, "ANDERE.md"), "GEHEIM-ANDERE\n");
  writeFileSync(path.join(projekt, ".claude", "settings.json"), JSON.stringify({
    hooks: { PreToolUse: [{ matcher: "mcp__gmail__send_message", hooks: [{ type: "command", command: "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/block-send.sh --token GEHEIM-TOKEN" }] }] },
    enabledPlugins: { "connect@initcon": true, "aus@irgendwo": false },
  }));
  writeFileSync(path.join(home, ".claude", "plugins", "installed_plugins.json"), JSON.stringify({ version: 2, plugins: {
    "connect@initcon": [{ scope: "local", projectPath: path.join(wurzel, "anderswo"), installPath: "/gibt/es/nicht", version: "0.0.1" },
      { scope: "local", projectPath: projekt, installPath: PLUGIN, version: "0.1.4" }],
  } }));
  return { wurzel, projekt, home };
}

test("Kopfzeilen: Werte und Listen", () => {
  assert.deepEqual(kopfzeilen("---\nname: a\nmodel: \"opus\"\ntools:\n  - Read\n  - Write\n---\nText"), { name: "a", model: "opus", tools: "Read, Write" });
  assert.deepEqual(kopfzeilen("kein Kopf"), {});
});

test("Ganze Datei: Text ohne Kopfzeilen, höchstens DATEI_MAX Zeichen, sonst gekürzt", () => {
  assert.equal(ohneKopf("---\nname: a\n---\n## Steckbrief\n- Rolle: A\n"), "## Steckbrief\n- Rolle: A\n");
  assert.equal(ohneKopf("ohne Kopf"), "ohne Kopf");
  assert.deepEqual(ganz("kurz", "a.md"), { datei: "a.md", text: "kurz", gekuerzt: false });
  const g = ganz("x".repeat(DATEI_MAX + 10), "a.md");
  assert.equal(g.text.length, DATEI_MAX); assert.equal(g.gekuerzt, true);
});

test("Kurzbeschreibung eines Hooks: kein Befehl im Wortlaut, keine Argumente", () => {
  assert.equal(hookKurz({ type: "mcp_tool", tool: "aktivitaet_melden", input: { was: "start", kurz: "${tool_input.description}" } }), "aktivitaet_melden: start");
  assert.equal(hookKurz({ type: "command", command: "cat \"${CLAUDE_PLUGIN_ROOT}/regeln/connect.md\"" }), "cat connect.md");
  assert.equal(hookKurz({ type: "command", command: "command -v node >/dev/null 2>&1 && node \"${CLAUDE_PLUGIN_ROOT}/scripts/regeln-senden.mjs\" >/dev/null 2>&1; exit 0" }), "node regeln-senden.mjs");
  assert.equal(hookKurz({ type: "prompt", prompt: "Du prüfst die Antwort. Danach mehr." }), "Du prüfst die Antwort.");
  assert.equal(hookKurz({ type: "http", url: "https://hooks.example.test/x?key=1" }), "hooks.example.test");
});

test("sammeln: nur CLAUDE.md und agents (je ganz), Hooks, Plugins; keine memory-Dateien, keine Befehle im Wortlaut", () => {
  const { projekt, home, wurzel } = ordnerAnlegen();
  try {
    const m = sammeln({ projekt, home, pluginRoot: PLUGIN });
    const roh = JSON.stringify(m);
    assert.doesNotMatch(roh, /GEHEIM-ERINNERUNG/, "keine Erinnerungen");
    assert.doesNotMatch(roh, /GEHEIM-TOKEN/, "keine Argumente aus Befehlen");
    assert.doesNotMatch(roh, /GEHEIM-ANDERE/, "keine anderen Dateien");
    assert.deepEqual(m.claude_md, { datei: "CLAUDE.md", text: readFileSync(path.join(projekt, "CLAUDE.md"), "utf8"), gekuerzt: false }, "CLAUDE.md 1:1");
    const p = m.assistenten.find((a) => a.datei === "postfach");
    assert.equal(p.name, "postfach"); assert.equal(p.modell, "sonnet"); assert.equal(p.werkzeuge, "Read, mcp__gmail__create_draft");
    assert.equal(p.beschreibung, "Liest das Postfach und schreibt Antworten vor.");
    assert.equal(p.text, ohneKopf(readFileSync(path.join(projekt, ".claude", "agents", "postfach.md"), "utf8")).replace(/^\n+/, ""), "Text unter den Kopfzeilen 1:1");
    assert.match(p.text, /INHALT-AUFTRAGSTEXT/); assert.match(p.text, /INHALT-ARBEITSWEISE/);
    assert.equal(p.gekuerzt, false);
    assert.deepEqual(Object.keys(m).sort(), ["assistenten", "claude_md", "hooks", "plugin_version", "plugins"]);
    const sperre = m.hooks.find((h) => h.herkunft === "Projekt");
    assert.deepEqual(sperre, { ereignis: "PreToolUse", matcher: "mcp__gmail__send_message", art: "command", kurz: "block-send.sh", herkunft: "Projekt" });
    assert.equal(m.plugins.length, 1, "nur eingeschaltete Plugins, das eigene nicht doppelt");
    assert.equal(m.plugins[0].name, "connect@initcon");
    assert.equal(m.plugins[0].version, JSON.parse(readFileSync(path.join(PLUGIN, ".claude-plugin", "plugin.json"), "utf8")).version, "Version aus plugin.json");
    assert.deepEqual(m.plugins[0].regeln.map((d) => d.datei), ["regeln/grundregeln.md", "regeln/connect.md"]);
    assert.ok(m.hooks.some((h) => h.herkunft === "Plugin connect@initcon" && h.ereignis === "SessionStart" && h.kurz === "node regeln-senden.mjs"));
  } finally { rmSync(wurzel, { recursive: true, force: true }); }
});

test("kuerzen: unter 900 000 Bytes, zuerst ohne Regeldateien, dann die längste Datei gekürzt", () => {
  const m = { claude_md: { datei: "CLAUDE.md", text: "x".repeat(200_000), gekuerzt: false }, plugins: [{ name: "p", regeln: [{ datei: "r.md", text: "z".repeat(10_000) }] }], hooks: [],
    assistenten: Array.from({ length: 5 }, (_, i) => ({ datei: "a" + i, text: "y".repeat(190_000), gekuerzt: false })) };
  kuerzen(m);
  assert.deepEqual(m.plugins[0].regeln, []);
  assert.ok(Buffer.byteLength(JSON.stringify(m)) <= 900_000);
  assert.ok([m.claude_md, ...m.assistenten].some((d) => d.gekuerzt));
});

test("senden: JSON-RPC an /mcp mit Schlüssel im Kopf", async () => {
  let anfrage = null;
  const status = await senden({ allgemein: [] }, { adresse: "https://connect.example.test/", schluessel: "kc1.test", fetchFn: async (url, o) => { anfrage = { url, o }; return { status: 200 }; } });
  assert.equal(status, 200);
  assert.equal(anfrage.url, "https://connect.example.test/mcp");
  assert.equal(anfrage.o.headers.Authorization, "Bearer kc1.test");
  const rumpf = JSON.parse(anfrage.o.body);
  assert.equal(rumpf.method, METHODE);
  assert.deepEqual(rumpf.params, { allgemein: [] });
});

test("Als Hook: schickt an den Dienst, schreibt nichts nach stdout, Exit 0 auch ohne Schlüssel und ohne Dienst", async () => {
  const { projekt, home, wurzel } = ordnerAnlegen();
  const angekommen = [];
  const server = http.createServer((req, res) => { let t = ""; req.on("data", (x) => (t += x)); req.on("end", () => { angekommen.push({ kopf: req.headers, rumpf: JSON.parse(t) }); res.writeHead(200, { "Content-Type": "application/json" }); res.end("{}"); }); });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  const lauf = (env) => new Promise((fertig) => {
    const k = spawnSync(process.execPath, [SKRIPT], { env: { PATH: process.env.PATH, HOME: home, CLAUDE_PROJECT_DIR: projekt, CLAUDE_PLUGIN_ROOT: PLUGIN, ...env }, encoding: "utf8", timeout: 15_000 });
    fertig(k);
  });
  try {
    // spawnSync blockiert den Server dieses Prozesses: darum den Lauf mit Dienst asynchron
    const { spawn } = await import("node:child_process");
    const mitDienst = await new Promise((fertig) => {
      const k = spawn(process.execPath, [SKRIPT], { env: { PATH: process.env.PATH, HOME: home, CLAUDE_PROJECT_DIR: projekt, CLAUDE_PLUGIN_ROOT: PLUGIN, CLAUDE_PLUGIN_OPTION_SCHLUESSEL: "kc1.erfunden", CLAUDE_PLUGIN_OPTION_ADRESSE: `http://127.0.0.1:${port}` } });
      let aus = ""; k.stdout.on("data", (x) => (aus += x));
      k.on("close", (code) => fertig({ code, aus }));
    });
    assert.equal(mitDienst.code, 0);
    assert.equal(mitDienst.aus, "");
    assert.equal(angekommen.length, 1);
    assert.equal(angekommen[0].kopf.authorization, "Bearer kc1.erfunden");
    assert.equal(angekommen[0].rumpf.method, METHODE);
    assert.equal(angekommen[0].rumpf.params.assistenten.length, 2);
    const ohneSchluessel = await lauf({});
    assert.equal(ohneSchluessel.status, 0); assert.equal(ohneSchluessel.stdout, "");
    const ohneDienst = await lauf({ CLAUDE_PLUGIN_OPTION_SCHLUESSEL: "kc1.erfunden", CLAUDE_PLUGIN_OPTION_ADRESSE: "http://127.0.0.1:1" });
    assert.equal(ohneDienst.status, 0); assert.equal(ohneDienst.stdout, "");
    const kaputt = await lauf({ CLAUDE_PROJECT_DIR: path.join(wurzel, "gibt-es-nicht"), CLAUDE_PLUGIN_OPTION_SCHLUESSEL: "kc1.erfunden", CLAUDE_PLUGIN_OPTION_ADRESSE: "nicht einmal eine Adresse" });
    assert.equal(kaputt.status, 0); assert.equal(kaputt.stdout, "");
    assert.equal(angekommen.length, 1);
  } finally { server.close(); rmSync(wurzel, { recursive: true, force: true }); }
});

test("hooks.json: Hook beim Start, im Hintergrund, Fehler bleiben still", () => {
  const h = JSON.parse(readFileSync(path.join(PLUGIN, "hooks", "hooks.json"), "utf8")).hooks.SessionStart;
  const e = h.flatMap((g) => g.hooks).find((x) => String(x.command).includes("regeln-senden.mjs"));
  assert.ok(e, "Hook vorhanden");
  assert.equal(e.async, true);
  assert.match(e.command, /exit 0$/);
  assert.doesNotMatch(e.command, /user_config/, "Schlüssel nie in der Befehlszeile");
  assert.match(JSON.parse(readFileSync(path.join(PLUGIN, ".claude-plugin", "plugin.json"), "utf8")).version, /^0\.1\.([4-9]|\d\d+)$/, "Stand der Regeln gibt es seit 0.1.4");
});
