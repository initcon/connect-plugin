# InitCon Connect für Claude Code

Dieses Plugin verbindet Claude Code mit [InitCon Connect](https://app.initcon.ai). Dort siehst du die Aufgaben deines
KI-Teams, beantwortest seine Fragen und gibst frei, was rausgeht. Claude Code holt sich deine Antworten bei jeder
Nachricht ab und trägt Ergebnisse selbst ein.

Du brauchst ein Konto bei Connect. Das richtet InitCon für dich ein.

## Einrichten

1. Leg in Connect einen Schlüssel an: Einstellungen, Karte „Verbundene Geräte“, Namen für den Rechner eintragen,
   „Schlüssel anlegen“, „Schlüssel kopieren“.
2. Öffne das Terminal, wechsle in den Ordner, in dem dein KI-Team arbeitet, und starte `claude`.
3. Gib nacheinander ein:

   ```
   /plugin marketplace add initcon/connect-plugin
   /plugin install connect@initcon
   ```

   Wähl „local“, dann gilt Connect nur in diesem Ordner.
4. Claude Code fragt nach dem Schlüssel. Füg ihn ein.
5. Claude Code beenden und neu starten.

Zum Prüfen fragst du: „Was ist offen in Connect?“

Den Schlüssel speichert Claude Code im Schlüsselbund deines Rechners, nicht in einer Datei.

## Was das Plugin mitbringt

- Die Verbindung zu Connect.
- Hooks: Bei jeder Nachricht kommen neue Antworten aus Connect mit. In Connect siehst du live, welcher KI-Assistent
  gerade arbeitet. In Claude Desktop siehst du dort auch die Schrittliste des Managers (braucht Connect 0.17.17).
  Will Claude eine Entscheidung von dir, stellt es sie in Connect statt nur im Chat.
- Regeln, die bei jedem Start geladen werden. Die wichtigste: Entscheiden, freigeben, löschen und versenden tust nur du.
  Claude kauft nie etwas.
- Den Befehl `/connect:weiter`. Er holt alles Offene aus Connect und arbeitet deine Antworten ab.

## Wenn etwas nicht geht

- `/mcp` zeigt `plugin:connect:initcon-connect` mit Fehler: Der Schlüssel fehlt oder gilt nicht mehr. Leg in Connect einen
  neuen an und trag ihn mit `/plugin configure connect@initcon` ein.
- Neue Fassungen holst du mit `/plugin marketplace update initcon`. Automatisch geht das, wenn du unter `/plugin`,
  Reiter „Marketplaces“, „Enable auto-update“ einschaltest.

Fragen beantwortet InitCon unter connect@initcon.de.
