// Baut connect/regeln/grundregeln.json aus grundregeln.md (SubagentStart-Hook gibt das JSON mit cat aus, ohne Node beim Kunden).
// Aufruf nach jeder Änderung an grundregeln.md: node scripts/grundregeln-json.mjs
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REGELN = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "connect", "regeln");

export function grundregelnJson(text) {
  return JSON.stringify({ hookSpecificOutput: { hookEventName: "SubagentStart", additionalContext: text } }) + "\n";
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const text = readFileSync(path.join(REGELN, "grundregeln.md"), "utf8");
  writeFileSync(path.join(REGELN, "grundregeln.json"), grundregelnJson(text));
  console.log("grundregeln.json geschrieben");
}
