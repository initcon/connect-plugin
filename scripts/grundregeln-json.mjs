// Baut connect/regeln/grundregeln.json aus grundregeln.md (SubagentStart-Hook gibt das JSON mit cat aus, ohne Node beim Kunden).
// Aufruf nach jeder Änderung an grundregeln.md: node scripts/grundregeln-json.mjs
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REGELN = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "connect", "regeln");

export function grundregelnJson(text) {
  // Umlaute als \uXXXX, damit die Codepage unter Windows keine Rolle spielt
  return JSON.stringify({ hookSpecificOutput: { hookEventName: "SubagentStart", additionalContext: text } }).replace(/[\u007f-\uffff]/g, (z) => "\\u" + z.charCodeAt(0).toString(16).padStart(4, "0")) + "\n";
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const text = readFileSync(path.join(REGELN, "grundregeln.md"), "utf8");
  writeFileSync(path.join(REGELN, "grundregeln.json"), grundregelnJson(text));
  console.log("grundregeln.json geschrieben");
}
