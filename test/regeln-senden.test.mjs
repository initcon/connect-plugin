// T1098 (Plugin 0.1.4): scripts/regeln-senden.mjs. Aufruf: node --test test/. Alle Daten erfunden (Malerbetrieb Brandt).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { abschnitte, hookKurz, kopfzeilen, kuerzen, METHODE, sammeln, senden, steckbrief } from "../connect/scripts/regeln-senden.mjs";

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
- GEHEIM-ABLAGE steht nicht in der Meldung.

## Freigaben – immer erst fragen
- Mails **versenden** tut Frau Brandt selbst.
<!-- interne Notiz GEHEIM-KOMMENTAR -->

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

Du bist der Postfach-Assistent. GEHEIM-AUFTRAGSTEXT steht nicht in der Meldung.

## Steckbrief
- Rolle: Postfach-Assistent
- Freigabe: Löschen
- Darf: Mails lesen, Entwürfe schreiben. Nichts abschicken.

## Arbeitsweise des Assistenten
- GEHEIM-ARBEITSWEISE
`);
  writeFileSync(path.join(projekt, ".claude", "agents", "buero.md"), "---\nname: buero\ndescription: Büro\ntools: Read, Write\n---\nOhne Steckbrief.\n");
  writeFileSync(path.join(projekt, ".claude", "memory", "MEMORY.md"), "GEHEIM-ERINNERUNG\n");
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

test("Steckbrief: nur die Zeilen darunter, bis zur nächsten Überschrift", () => {
  assert.deepEqual(steckbrief("## Steckbrief\n- Rolle: A\n- **Darf:** B, C\nfreier Text\n## Weiter\n- Rolle: X"), [{ feld: "Rolle", wert: "A" }, { feld: "Darf", wert: "B, C" }]);
  assert.deepEqual(steckbrief("## Anderes\n- Rolle: A"), []);
});

test("Abschnitte: nur die regelnden Überschriften der Ebene 2, Codeblöcke und Kommentare zählen nicht", () => {
  const { projekt, wurzel } = ordnerAnlegen();
  try {
    const a = abschnitte(readFileSync(path.join(projekt, "CLAUDE.md"), "utf8"));
    assert.deepEqual(a.map((x) => x.titel), ["Freigaben – immer erst fragen", "Arbeitsweise", "Sprache"]);
    assert.match(a[1].text, /Sprache im Codeblock ist keine Überschrift/);
    assert.equal(a[2].text, "Deutsch, Du-Form.");
    assert.doesNotMatch(JSON.stringify(a), /GEHEIM/);
  } finally { rmSync(wurzel, { recursive: true, force: true }); }
});

test("Kurzbeschreibung eines Hooks: kein Befehl im Wortlaut, keine Argumente", () => {
  assert.equal(hookKurz({ type: "mcp_tool", tool: "aktivitaet_melden", input: { was: "start", kurz: "${tool_input.description}" } }), "aktivitaet_melden: start");
  assert.equal(hookKurz({ type: "command", command: "cat \"${CLAUDE_PLUGIN_ROOT}/regeln/connect.md\"" }), "cat connect.md");
  assert.equal(hookKurz({ type: "command", command: "command -v node >/dev/null 2>&1 && node \"${CLAUDE_PLUGIN_ROOT}/scripts/regeln-senden.mjs\" >/dev/null 2>&1; exit 0" }), "node regeln-senden.mjs");
  assert.equal(hookKurz({ type: "prompt", prompt: "Du prüfst die Antwort. Danach mehr." }), "Du prüfst die Antwort.");
  assert.equal(hookKurz({ type: "http", url: "https://hooks.example.test/x?key=1" }), "hooks.example.test");
});

test("sammeln: Steckbriefe, Abschnitte, Hooks, Plugins; keine Erinnerungen, kein übriger Inhalt", () => {
  const { projekt, home, wurzel } = ordnerAnlegen();
  try {
    const m = sammeln({ projekt, home, pluginRoot: PLUGIN });
    const roh = JSON.stringify(m);
    assert.doesNotMatch(roh, /GEHEIM/, "nichts aus dem übrigen Inhalt, keine Erinnerungen, keine Token aus Befehlen");
    assert.deepEqual(m.manager.steckbrief.map((z) => z.feld), ["Rolle", "Darf"]);
    const p = m.assistenten.find((a) => a.datei === "postfach");
    assert.deepEqual(p, { datei: "postfach", name: "postfach", beschreibung: "Liest das Postfach und schreibt Antworten vor.", modell: "sonnet",
      werkzeuge: "Read, mcp__gmail__create_draft", steckbrief: [{ feld: "Rolle", wert: "Postfach-Assistent" }, { feld: "Freigabe", wert: "Löschen" }, { feld: "Darf", wert: "Mails lesen, Entwürfe schreiben. Nichts abschicken." }] });
    assert.deepEqual(m.assistenten.find((a) => a.datei === "buero").steckbrief, []);
    const sperre = m.hooks.find((h) => h.herkunft === "Projekt");
    assert.deepEqual(sperre, { ereignis: "PreToolUse", matcher: "mcp__gmail__send_message", art: "command", kurz: "block-send.sh", herkunft: "Projekt" });
    assert.equal(m.plugins.length, 1, "nur eingeschaltete Plugins, das eigene nicht doppelt");
    assert.equal(m.plugins[0].name, "connect@initcon");
    assert.equal(m.plugins[0].version, "0.1.4");
    assert.deepEqual(m.plugins[0].regeln.map((d) => d.datei), ["regeln/connect.md"]);
    assert.doesNotMatch(m.plugins[0].regeln[0].text, /<!--/);
    assert.ok(m.hooks.some((h) => h.herkunft === "Plugin connect@initcon" && h.ereignis === "SessionStart" && h.kurz === "node regeln-senden.mjs"));
  } finally { rmSync(wurzel, { recursive: true, force: true }); }
});

test("kuerzen: unter 60 000 Bytes, zuerst ohne Regeldateien", () => {
  const m = { allgemein: [{ titel: "A", text: "x".repeat(30_000) }, { titel: "B", text: "y".repeat(30_000) }], plugins: [{ name: "p", regeln: [{ datei: "r.md", text: "z".repeat(10_000) }] }], hooks: [], assistenten: [] };
  kuerzen(m);
  assert.deepEqual(m.plugins[0].regeln, []);
  assert.deepEqual(m.allgemein.map((a) => a.titel), ["A"]);
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
  assert.equal(JSON.parse(readFileSync(path.join(PLUGIN, ".claude-plugin", "plugin.json"), "utf8")).version, "0.1.4");
});
