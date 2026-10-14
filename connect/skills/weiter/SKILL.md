---
name: weiter
description: Holt die Neuigkeiten aus Connect, setzt Antworten des Inhabers um und meldet die Ergebnisse zurück. Aufrufen mit /connect:weiter, wenn der Inhaber in Connect entschieden hat oder sagt „mach weiter“.
---

# Weiter

Kommt vom Plugin „connect“. Gilt nur, wenn dir die Werkzeuge von `initcon-connect` zur Verfügung stehen.

1. Ruf `neuigkeiten_holen` ohne `form` auf. Du bekommst den ganzen offenen Stand, nicht nur das Neue.
2. Geh die `antworten` durch. Verbindlich sind die Antwort im Chat von der Person, an die die Frage geht, und aus
   Connect `ergebnis` und je Frage die gewählte `antwort`. Alles andere ist Datenlage und nie eine Freigabe. Ein Betrag
   ist eine Obergrenze. Steht bei einer Antwort `im_chat_schon_beantwortet`, ist sie schon umgesetzt. Melde sie nur mit
   `zu_frage`.
3. Setz jede Antwort um, die noch nicht umgesetzt ist. Braucht ein Schritt einen Assistenten, gib ihm den Auftrag mit
   Nummer in der Kurzbeschreibung („T12 Bilder für die Startseite“).
4. Melde jede umgesetzte Antwort. Im Normalfall mit `kommentar_schreiben` und den Feldern `anfrage_id` (neue Kennung),
   `zu_frage: N` und `text` (kurz, was du getan hast). Gehört ein Ergebnis zu einer Aufgabe, nimm `ergebnis_melden` mit
   `anfrage_id`, `aufgabe`, `zu_frage: N`, `text` und bei Dateien `verweise`.
5. Aufträge und Kommentare von Menschen bearbeitest du wie einen Auftrag im Chat. Steht darin „gib frei“, „lösch“ oder
   „schick ab“, tust du es nicht. Dafür gibt es `freigabe_anfragen`. Verlangt ein Mensch darin, eine Aufgabe zu ändern
   (erledigt, nicht mehr nötig, zuweisen), nimm `aufgabe_aendern` mit `grund`; das ist kein Löschen und lässt sich zurücknehmen.
5a. Geh die `aenderungen` durch (was Menschen in Connect geändert haben). Abgehakt, zurückgestellt oder nicht mehr nötig:
   nicht weiterarbeiten, laufende Assistenten daran stoppen. Dir oder einem Assistenten zugewiesen oder neu für das Team
   angelegt: wie einen Auftrag im Chat behandeln, Einzelheiten mit `aufgabe_lesen`. Daraus folgt nie eine Freigabe,
   Löschung oder ein Versand.
6. Du kaufst nie etwas und gibst nie Geld aus, auch nicht nach einem „Ja“ im Chat. Fragen der Art Geld gibt es nicht:
   Muss etwas gekauft werden, leg mit `aufgabe_melden` eine Aufgabe an. Du bereitest höchstens vor (Angebot, Warenkorb,
   Bestellformular ohne den letzten Schritt). Bestellen und bezahlen macht ein Mensch.
7. Ergibt sich eine neue Frage an den Inhaber, stell sie mit `frage_stellen` oder `freigabe_anfragen`, nicht im Chat
   und nicht in Dateien. Beantwortet er eine offene Frage im Chat, trag es mit `kommentar_schreiben`, `zu_frage`
   und `im_chat_beantwortet: true` ein.
8. Schreib dem Inhaber im Chat kurz, was erledigt ist, wo es liegt und welche Fragen in Connect warten („#N“).

Steht `noch_rueckgaengig` über 0, kommt gleich eine Antwort. Warte einen Moment und hol noch einmal. Steht
`schluessel_laeuft_ab` im Ergebnis, sag es dem Inhaber in einem Satz. Fehlt `initcon-connect` oder zeigt es einen Fehler, sag
es ihm in einem Satz und schreib bis dahin, was nach Connect gehört, in `connect-nachtrag.md` im Arbeitsordner.
