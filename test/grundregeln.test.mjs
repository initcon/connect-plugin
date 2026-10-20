// Plugin 0.1.5: Grundregeln für Manager (SessionStart) und jeden KI-Assistenten (SubagentStart). Aufruf: node --test test/grundregeln.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { grundregelnJson } from "../scripts/grundregeln-json.mjs";

const PLUGIN = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "connect");
const md = readFileSync(path.join(PLUGIN, "regeln", "grundregeln.md"), "utf8");
const roh = readFileSync(path.join(PLUGIN, "regeln", "grundregeln.json"), "utf8");
const hooks = JSON.parse(readFileSync(path.join(PLUGIN, "hooks", "hooks.json"), "utf8")).hooks;

test("grundregeln.json ist gültig und enthält genau den Text aus grundregeln.md", () => {
  const j = JSON.parse(roh);
  assert.equal(j.hookSpecificOutput.hookEventName, "SubagentStart");
  assert.equal(j.hookSpecificOutput.additionalContext, md);
  assert.equal(roh, grundregelnJson(md), "grundregeln.json neu bauen: node scripts/grundregeln-json.mjs");
  assert.ok(/^[\x00-\x7e]*$/.test(roh), "nur ASCII im JSON");
});

test("zehn Grundregeln, nichts aus einem bestimmten Betrieb", () => {
  for (let i = 1; i <= 10; i++) assert.match(md, new RegExp(`^ ?${i}\\. \\*\\*`, "m"), `Regel ${i} fehlt`);
  for (const wort of ["Christof", "InitCon (Christof)", "SMS", "betrieb/"]) assert.ok(!md.includes(wort), `„${wort}“ gehört nicht in die Grundregeln`);
});

test("SessionStart gibt die Grundregeln vor den Connect-Regeln aus, bei jedem Start", () => {
  const befehle = hooks.SessionStart.flatMap((g) => g.hooks.map((h) => ({ m: g.matcher, c: h.command })));
  const g = befehle.findIndex((b) => /regeln\/grundregeln\.md/.test(b.c || ""));
  const c = befehle.findIndex((b) => /regeln\/connect\.md/.test(b.c || ""));
  assert.ok(g >= 0 && c >= 0 && g < c);
  assert.equal(befehle[g].m, "startup|resume|clear|compact");
  assert.match(befehle[g].c, /^cat "\$\{CLAUDE_PLUGIN_ROOT\}\/regeln\/grundregeln\.md"$/);
});

test("SubagentStart gibt das JSON für jeden Assistenten aus, ohne Matcher und ohne Node", () => {
  assert.equal(hooks.SubagentStart.length, 1);
  const g = hooks.SubagentStart[0];
  assert.equal(g.matcher, undefined);
  assert.equal(g.hooks[0].type, "command");
  assert.equal(g.hooks[0].command, 'cat "${CLAUDE_PLUGIN_ROOT}/regeln/grundregeln.json"');
  const aus = spawnSync("sh", ["-c", g.hooks[0].command], { env: { ...process.env, CLAUDE_PLUGIN_ROOT: PLUGIN }, encoding: "utf8" });
  assert.equal(aus.status, 0);
  assert.equal(JSON.parse(aus.stdout).hookSpecificOutput.additionalContext, md);
});
