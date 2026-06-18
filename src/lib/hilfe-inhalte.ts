import type { Permission } from "@/lib/types";

// Hilfe-Inhalte als reine Daten: durchsuchbar (Stichwortsuche läuft über
// titel + stichworte + alle Texte) und pro Artikel mit dem Recht getaggt,
// das die beschriebene Funktion voraussetzt. Die Hilfe-Seite filtert gegen
// profile.permissions — jede Rolle sieht nur, was sie auch tun kann.
//
// Pflege-Regel: Beschriftungen (Buttons, Tabs, Menüpunkte) exakt so
// schreiben, wie sie in der App stehen. Wer eine Funktion umbenennt oder
// entfernt, zieht den betroffenen Artikel hier nach.

export type HilfeArtikel = {
  id: string;
  titel: string;
  /** Synonyme und Suchbegriffe, die nicht im Text vorkommen. */
  stichworte: string[];
  absaetze: string[];
  /** Optional: nummerierter Klickweg. */
  schritte?: string[];
  /** Optional: hervorgehobener Hinweis am Artikelende. */
  hinweis?: string;
  /** Nur anzeigen, wenn der Nutzer dieses Recht hat. Ohne Angabe: alle. */
  recht?: Permission;
  /** Nur für den Plattform-Betreiber. */
  nurPlattformAdmin?: boolean;
};

export type HilfeKategorie = {
  id: string;
  titel: string;
  artikel: HilfeArtikel[];
};

export const HILFE_KATEGORIEN: HilfeKategorie[] = [
  {
    id: "erste-schritte",
    titel: "Erste Schritte",
    artikel: [
      {
        id: "was-ist-vox",
        titel: "Was ist VOX und wofür ist es da?",
        stichworte: ["überblick", "einführung", "zweck", "bürgertelefon", "krise"],
        absaetze: [
          "VOX ist das interne Werkzeug für das Bürgertelefon im Krisenfall. Es bündelt alles, was das Team am Telefon braucht: die freigegebenen Antworten auf häufige Fragen (FAQs), die Aufnahme neuer Bürgeranfragen, deren Klärung mit den zuständigen Fachstellen und eine Lagekarte für die schnelle Adressprüfung.",
          "Das Grundprinzip: Jede Antwort, die das Team herausgibt, ist vorher geprüft und freigegeben worden. So bekommen alle Anrufenden dieselbe, verlässliche Auskunft, unabhängig davon, wer den Hörer abnimmt.",
        ],
      },
      {
        id: "anmeldung",
        titel: "Anmelden mit dem Anmeldelink",
        stichworte: ["login", "magic link", "e-mail", "registrieren", "konto", "passwort"],
        absaetze: [
          "VOX verwendet keine Passwörter. Du meldest dich mit deiner dienstlichen E-Mail-Adresse an und erhältst einen Anmeldelink per E-Mail.",
        ],
        schritte: [
          "Öffne die Anmeldeseite und gib deine dienstliche E-Mail-Adresse ein.",
          "Öffne die E-Mail mit deinem Anmeldelink in deinem Postfach.",
          "Klicke auf „Jetzt anmelden“. Damit bist du angemeldet.",
        ],
        hinweis:
          "Der Link ist nur kurze Zeit und nur einmal gültig. Kommt keine E-Mail an, hilft der Artikel „Anmeldelink kommt nicht an“ weiter unten.",
      },
      {
        id: "aufbau",
        titel: "Aufbau der App: Tabs, Posteingang, Notizen",
        stichworte: ["navigation", "menü", "kopfleiste", "header", "glocke", "briefkasten", "symbol"],
        absaetze: [
          "Oben in der Kopfleiste findest du die Tabs Übersicht, Karte, Bürgeranfragen und FAQs. Karte, Bürgeranfragen und FAQs erscheinen nur, solange eine Lage aktiv ist. Den Tab Einstellungen sehen nur Personen mit Verwaltungsrechten.",
          "Rechts in der Kopfleiste liegen drei Symbole: Der Posteingang (Briefkasten-Symbol) sammelt, was für dich neu ist. Je nach Rolle sind das neue oder geänderte FAQs oder Bürgeranfragen, die eine Entscheidung brauchen. Das Zettel-Symbol öffnet deine persönlichen Notizen. Hinter deinen Initialen liegt das Benutzermenü mit deiner Rolle, dieser Hilfe und der Abmeldung.",
        ],
      },
      {
        id: "rollen-und-rechte",
        titel: "Rollen und Rechte: Warum sehe ich etwas nicht?",
        stichworte: ["berechtigung", "permission", "telefonist", "leitung", "administrator", "sichtbarkeit"],
        absaetze: [
          "Was du in VOX sehen und tun kannst, bestimmt deine Rolle. Jede Behörde startet mit drei Rollen: Telefonist:in (Auskunft geben, Anfragen aufnehmen), Leitung (zusätzlich Antworten freigeben, Lage und Inhalte steuern) und Administrator:in (zusätzlich Team und Organisation verwalten). Deine Behörde kann darüber hinaus eigene Rollen mit eigenen Rechten definieren.",
          "Deine aktuelle Rolle siehst du im Benutzermenü hinter deinen Initialen. Wenn dir ein Knopf oder Tab fehlt, der hier oder bei Kolleginnen und Kollegen erwähnt wird, fehlt deiner Rolle das entsprechende Recht. Wende dich in diesem Fall an die Verwaltung deiner Behörde.",
        ],
        hinweis:
          "Auch diese Hilfe passt sich an: Sie zeigt nur Artikel zu Funktionen, die deine Rolle nutzen kann.",
      },
    ],
  },
  {
    id: "auskunft",
    titel: "Auskunft am Telefon",
    artikel: [
      {
        id: "anruf-beantworten",
        titel: "Einen Anruf mit der Übersicht beantworten",
        stichworte: ["suche", "startseite", "themen", "kacheln", "häufig gestellt", "anrufannahme"],
        absaetze: [
          "Die Übersicht ist deine Anlaufstelle, wenn ein Anruf eingeht. Das Suchfeld ist beim Öffnen bereits aktiv, sodass du sofort lostippen kannst. Die Suche findet Treffer in Frage und Antwort aller veröffentlichten FAQs.",
          "Ohne Suchbegriff zeigt die Übersicht drei Einstiege: die zuletzt aktualisierten FAQs, die am häufigsten aufgerufenen FAQs und die Themen-Kacheln. Ein Klick auf eine Themen-Kachel öffnet alle FAQs dieser Kategorie.",
        ],
        recht: "faq.lesen",
      },
      {
        id: "faq-vorlesen",
        titel: "Ein FAQ öffnen und die Antwort weitergeben",
        stichworte: ["antwort", "vorlesen", "detail", "stand", "aktualität"],
        absaetze: [
          "Ein Klick auf ein FAQ öffnet die vollständige Antwort. Gib die Antwort im Wortlaut oder sinngemäß an die Anruferin oder den Anrufer weiter.",
          "Achte auf die Angabe „Stand“ unten im FAQ: Sie zeigt, wann die Antwort zuletzt aktualisiert wurde. In dynamischen Lagen lohnt ein Blick darauf, bevor du eine zeitkritische Information weitergibst.",
        ],
        hinweis:
          "Beantwortet das FAQ die Frage nicht vollständig, kannst du direkt aus dem geöffneten FAQ eine Rückfrage stellen (siehe „Rückfrage zu einem bestehenden FAQ stellen“).",
        recht: "faq.lesen",
      },
      {
        id: "faqs-durchsuchen",
        titel: "Alle FAQs durchsuchen und filtern",
        stichworte: ["faq-liste", "kategorie", "filter", "wissensbasis"],
        absaetze: [
          "Der Tab FAQs zeigt die vollständige FAQ-Liste der aktuellen Lage mit Suchfeld und Kategorie-Filter. Hier verschaffst du dir einen Überblick über den Wissensstand, zum Beispiel zu Schichtbeginn.",
          "Wer FAQs nicht selbst pflegt, bekommt neue und geänderte FAQs zusätzlich im Posteingang (Briefkasten-Symbol oben rechts) angezeigt, bis sie gelesen sind. So verpasst du keine Aktualisierung zwischen zwei Anrufen.",
        ],
        recht: "faq.lesen",
      },
    ],
  },
  {
    id: "anfragen",
    titel: "Bürgeranfragen aufnehmen und klären",
    artikel: [
      {
        id: "status-verstehen",
        titel: "Der Weg einer Anfrage: die vier Status",
        stichworte: ["ampel", "rot", "gelb", "grün", "workflow", "ablauf", "neu", "freigegeben"],
        absaetze: [
          "Jede Bürgeranfrage im Tab Bürgeranfragen durchläuft bis zu vier Status. Neu (rot): Die Frage ist aufgenommen, aber noch unbeantwortet. Bei Fachstelle (gelb): Die Frage liegt zur Klärung bei einer Fachstelle. Antwort eingegangen (mit dem Hinweis „Freigabe nötig“): Die Fachstelle hat geantwortet, die Antwort wartet auf Prüfung. Freigegeben (grün, am Telefon als „Beantwortet“ angezeigt): Die Antwort ist geprüft und darf herausgegeben werden.",
          "Wer Antworten nicht selbst freigibt, sieht den Zwischenschritt „Antwort eingegangen“ nicht. Aus dieser Sicht bleibt die Anfrage „bei Fachstelle“, bis die Antwort freigegeben ist. So ist sichergestellt, dass am Telefon nur geprüfte Antworten herausgehen.",
          "Mit jeder Freigabe entsteht automatisch ein FAQ. Die Antwort steht damit sofort dem ganzen Team zur Verfügung.",
        ],
      },
      {
        id: "frage-erfassen",
        titel: "Eine neue Bürgerfrage erfassen",
        stichworte: ["aufnehmen", "notieren", "anruferfrage", "unbeantwortet", "weiterleiten"],
        absaetze: [
          "Wenn kein FAQ die Frage beantwortet, erfasse sie, damit sie geklärt wird und beim nächsten Anruf eine Antwort bereitsteht.",
        ],
        schritte: [
          "Öffne den Tab Bürgeranfragen und klicke auf „Bürgerfrage erfassen“.",
          "Notiere die Frage so konkret wie möglich, möglichst mit Kontext (z. B. Ortsteil oder besondere Umstände der Anruferin oder des Anrufers).",
          "Klicke auf „Erfassen“. Die Weiterleitung an die zuständige Fachstelle übernimmt danach die Leitung.",
        ],
        hinweis:
          "Sag den Anrufenden nicht zu, dass zurückgerufen wird. Verweise stattdessen darauf, dass die Antwort beim nächsten Anruf vorliegt oder über die offiziellen Kanäle veröffentlicht wird.",
        recht: "anfrage.erfassen",
      },
      {
        id: "rueckfrage-zum-faq",
        titel: "Rückfrage zu einem bestehenden FAQ stellen",
        stichworte: ["präzisierung", "ergänzung", "unklar", "veraltet", "bezug"],
        absaetze: [
          "Wenn ein FAQ die Frage fast beantwortet, aber eine Präzisierung nötig wäre (etwa ein Sonderfall, den die Antwort nicht abdeckt), stell eine Rückfrage mit Bezug auf dieses FAQ, statt eine lose neue Frage zu erfassen.",
        ],
        schritte: [
          "Öffne das betroffene FAQ und klicke auf „Rückfrage zum FAQ stellen“.",
          "Beschreibe, welche Präzisierung oder Ergänzung nötig wäre. Das FAQ samt bestehender Antwort wird automatisch als Bezug mitgeschickt.",
          "Klicke auf „Rückfrage senden“.",
        ],
        hinweis:
          "Der Vorteil gegenüber einer neuen Frage: Nach der Klärung wird das bestehende FAQ aktualisiert. Das Wissen bleibt an einer Stelle, statt sich auf mehrere Einträge zu verteilen.",
        recht: "anfrage.erfassen",
      },
      {
        id: "an-fachstelle-senden",
        titel: "Eine Anfrage an eine Fachstelle senden",
        stichworte: ["weiterleiten", "e-mail", "zuständig", "amt", "experten", "link"],
        absaetze: [
          "Fragen, die das Team nicht selbst beantworten kann, gehen per E-Mail an die zuständige Fachstelle (z. B. Tiefbauamt oder Gesundheitsamt). Die Fachstelle braucht dafür kein eigenes VOX-Konto.",
        ],
        schritte: [
          "Öffne die Anfrage im Tab Bürgeranfragen und klicke auf „An Fachstelle senden“.",
          "Trage eine oder mehrere E-Mail-Adressen ein.",
          "VOX verschickt die E-Mail mit der Frage und einem Antwort-Link. Der Status springt auf „Bei Fachstelle“.",
        ],
        hinweis:
          "Der Antwort-Link ist 7 Tage gültig. Erhalten mehrere Personen denselben Auftrag, wird nur die zuerst eingegangene Antwort übernommen. Meldet sich eine Fachstelle nicht, kannst du über „Erneut senden“ nachfassen oder eine andere Adresse wählen.",
        recht: "anfrage.an_fachstelle",
      },
      {
        id: "fachstellen-antwort",
        titel: "Wie die Fachstelle antwortet",
        stichworte: ["token", "extern", "verlauf", "schriftwechsel", "antwortseite"],
        absaetze: [
          "Die Fachstelle erhält eine E-Mail mit der Bürgerfrage und einem persönlichen Link. Der Link führt auf eine einfache Antwortseite: Frage lesen, Antwort schreiben, absenden. Mehr muss die Fachstelle nicht tun. Sobald die Antwort eingeht, wechselt die Anfrage in den Status „Antwort eingegangen“ und wartet auf die Freigabe.",
          "Der gesamte Schriftwechsel mit der Fachstelle (Frage, Antwort, eventuelle Rückfragen) wird an der Anfrage als Verlauf dokumentiert und ist für die freigabeberechtigten Personen einsehbar.",
        ],
        recht: "anfrage.an_fachstelle",
      },
      {
        id: "antwort-selbst",
        titel: "Eine Antwort selbst eintragen (ohne Fachstelle)",
        stichworte: ["manuell", "direkt beantworten", "intern", "selber"],
        absaetze: [
          "Nicht jede Frage braucht eine Fachstelle: Wenn die Antwort intern bekannt ist oder telefonisch geklärt wurde, trag sie direkt ein.",
        ],
        schritte: [
          "Öffne die Anfrage und klicke auf „Antwort manuell“.",
          "Trag die Antwort ein und speichere.",
          "Die Antwort durchläuft anschließend die normale Freigabe. Auch selbst eingetragene Antworten gehen erst nach Freigabe ans Team.",
        ],
        recht: "anfrage.freigeben",
      },
      {
        id: "freigeben",
        titel: "Antworten prüfen und freigeben",
        stichworte: ["freigabe", "redaktion", "überarbeiten", "qualität", "veröffentlichen"],
        absaetze: [
          "Sobald eine Antwort eingegangen ist (Posteingang und Status „Antwort eingegangen“), prüf sie: Ist sie verständlich, vollständig und für die Weitergabe am Telefon geeignet?",
          "Du hast drei Möglichkeiten: „Freigeben“ übernimmt die Antwort unverändert. „Überarbeiten und freigeben“ lässt dich die Antwort redaktionell anpassen (etwa Amtsdeutsch in vorlesbare Sprache übersetzen), bevor sie freigegeben wird. „Rückfrage an Fachstelle“ schickt die Anfrage mit deiner Rückfrage zurück, wenn die Antwort nicht ausreicht.",
          "Mit der Freigabe entsteht automatisch ein neues FAQ in der passenden Kategorie. War die Anfrage eine Rückfrage zu einem bestehenden FAQ, wird stattdessen dieses FAQ aktualisiert.",
        ],
        recht: "anfrage.freigeben",
      },
    ],
  },
  {
    id: "karte",
    titel: "Karte",
    artikel: [
      {
        id: "adresse-pruefen",
        titel: "Eine Adresse gegen die Lage prüfen",
        stichworte: ["adresssuche", "betroffen", "sperrgebiet", "evakuierung", "wohnort", "prüfung"],
        absaetze: [
          "Die häufigste Frage am Telefon: „Bin ich betroffen?“ Die Karte beantwortet sie in Sekunden. Gib die Adresse in die Adresssuche oben rechts ein. Die Karte springt zur Adresse und prüft automatisch, ob sie innerhalb eines eingezeichneten Bereichs (Fläche oder Radius) liegt.",
          "Ein Klick auf ein eingezeichnetes Objekt zeigt dessen Titel und Beschreibung, zum Beispiel um welche Art Sperrung es sich handelt und was dort gilt.",
        ],
        recht: "karte.ansehen",
      },
      {
        id: "zeichnen",
        titel: "Bereiche, Linien und Punkte einzeichnen",
        stichworte: ["polygon", "kreis", "radius", "marker", "sperrung", "zeichnen", "werkzeug", "farbe"],
        absaetze: [
          "Mit den Zeichenwerkzeugen oben links auf der Karte hältst du die Lage räumlich fest. Vier Objekttypen stehen bereit: Flächen (Polygone) für Gebiete wie Überschwemmungs- oder Sperrzonen, Kreise mit Radius für Evakuierungsradien (z. B. um einen Bombenfund), Linien für gesperrte Straßenabschnitte und Punkte für einzelne Orte wie Anlaufstellen oder Ausgabestellen.",
          "Nach dem Zeichnen vergibst du Titel, Beschreibung und eine von sieben Farben. Bewährt hat sich eine feste Farblogik, etwa Rot für Sperrungen und Gefahren, Grün für Hilfsangebote und Blau für Informationsbereiche.",
        ],
        hinweis:
          "Flächen und Kreise fließen automatisch in die Adressprüfung ein. Zeichne Gefahrenbereiche daher als Fläche oder Kreis, nicht als Linie.",
        recht: "karte.zeichnen",
      },
      {
        id: "objekte-verwalten",
        titel: "Kartenobjekte ändern oder löschen",
        stichworte: ["bearbeiten", "entfernen", "aktualisieren", "veraltet"],
        absaetze: [
          "Wenn sich die Lage ändert, sollte die Karte mitziehen. Eingezeichnete Objekte lassen sich nachträglich bearbeiten (Titel, Beschreibung, Farbe, Geometrie) oder löschen, wenn z. B. eine Sperrung aufgehoben wurde.",
          "Veraltete Objekte sind auf einer Lagekarte gefährlicher als fehlende: Prüf bei jeder Lageänderung, ob die eingezeichneten Bereiche noch stimmen.",
        ],
        recht: "karte.bearbeiten",
      },
    ],
  },
  {
    id: "verwaltung",
    titel: "Lage, Vorlagen und FAQs pflegen",
    artikel: [
      {
        id: "lage-starten",
        titel: "Eine Lage starten, mit oder ohne Vorlage",
        stichworte: ["szenario", "beginnen", "einsatz", "aktivieren", "kartenfokus"],
        absaetze: [
          "Es ist immer genau eine Lage aktiv. Erst mit einer aktiven Lage erscheinen Karte, Bürgeranfragen und FAQs für das Team.",
        ],
        schritte: [
          "Öffne Einstellungen → Lage.",
          "Wähle eine Vorlage (übernimmt deren Kategorien und Standard-FAQs als Startpunkt) oder „Ohne Vorlage (leere Lage)“ für ein Szenario, auf das keine Vorlage passt.",
          "Vergib einen Namen und leg den Karten-Fokus fest, also den Ort, auf den die Karte für alle zentriert wird.",
          "Nach dem Start: Standard-FAQs durchgehen, Platzhalter (z. B. konkrete Adressen und Telefonnummern) ausfüllen und die FAQs sichtbar schalten.",
        ],
        hinweis:
          "Der Start einer neuen Lage beendet eine noch laufende Lage automatisch.",
        recht: "lage.verwalten",
      },
      {
        id: "lage-beenden",
        titel: "Eine Lage beenden",
        stichworte: ["abschließen", "ende", "historie", "archiv", "nachbereitung"],
        absaetze: [
          "Ist die Krise vorbei, beende die Lage unter Einstellungen → Lage. Die inhaltlichen Tabs verschwinden daraufhin für das Team, bis eine neue Lage startet.",
          "Alle Daten der Lage (FAQs, Bürgeranfragen, Kartenobjekte) bleiben erhalten. Sie eignen sich für die Nachbereitung und als Grundlage, um die Vorlagen für das nächste Mal zu verbessern.",
        ],
        recht: "lage.verwalten",
      },
      {
        id: "vorlagen",
        titel: "Vorlagen für Szenarien vorbereiten",
        stichworte: ["hochwasser", "bombenfund", "stromausfall", "vorbereitung", "standard-faq", "prävention"],
        absaetze: [
          "Vorlagen sind deine Vorbereitung auf den Ernstfall: Für jedes denkbare Szenario (z. B. Hochwasser, Bombenfund, Stromausfall) hinterlegst du unter Einstellungen → Vorlagen die passenden Kategorien und Standard-FAQs. Beim Lage-Start ist das Grundgerüst dann in Sekunden da, statt unter Zeitdruck bei null zu beginnen.",
          "Schreib in die Standard-FAQs alles, was vorab feststeht, und markiere das Lagespezifische mit Platzhaltern wie „[vor Lage-Start eintragen]“. So sieht das Team beim Start sofort, was noch auszufüllen ist.",
        ],
        hinweis:
          "Der beste Zeitpunkt für Vorlagenpflege ist die ruhige Zeit zwischen den Lagen. Nach einer Lage lohnt der Blick, welche Fragen tatsächlich kamen und in die Vorlage gehören.",
        recht: "vorlage.verwalten",
      },
      {
        id: "faq-pflegen",
        titel: "FAQs anlegen, ändern und sichtbar schalten",
        stichworte: ["entwurf", "draft", "veröffentlichen", "verstecken", "wissensbasis", "redaktion"],
        absaetze: [
          "Im Tab FAQs pflegst du die Wissensbasis der laufenden Lage: neue FAQs anlegen, bestehende anpassen, überholte löschen.",
          "Jedes FAQ hat einen Sichtbarkeits-Schalter. Sichtbare FAQs sind für das ganze Team veröffentlicht; unsichtbare sind Entwürfe, die nur Personen mit Bearbeitungsrecht sehen. So bereitest du Antworten in Ruhe vor und schaltest sie erst frei, wenn sie geprüft sind.",
          "Bei jeder Änderung wird der „Stand“ des FAQs aktualisiert, und das Team wird über den Posteingang auf die Neuerung hingewiesen.",
        ],
        recht: "faq.erstellen",
      },
    ],
  },
  {
    id: "team",
    titel: "Team und Behörde",
    artikel: [
      {
        id: "team-aufnehmen",
        titel: "Mitarbeitende aufnehmen",
        stichworte: ["einladen", "kollegen", "beitritt", "domain", "registrierung", "neu"],
        absaetze: [
          "Neue Mitarbeitende lädst du nicht einzeln ein. Sie nehmen sich selbst auf: Wer sich mit einer E-Mail-Adresse deiner Behörden-Domain anmeldet, wird automatisch als Telefonist:in (der Rolle mit den wenigsten Rechten) aufgenommen. Der Besitz des dienstlichen Postfachs ist dabei der Vertrauensanker.",
          "Deine Aufgabe danach: unter Einstellungen → Nutzer die Rolle anpassen, falls die Person mehr können soll als die Basisrolle.",
        ],
        hinweis:
          "Es zählt die Domain, also der Teil hinter dem @-Zeichen. Private Adressen (z. B. Freemail-Anbieter) können keiner Behörde zugeordnet werden.",
        recht: "nutzer.einladen",
      },
      {
        id: "rollen-zuweisen",
        titel: "Rollen zuweisen",
        stichworte: ["befördern", "rechte ändern", "hochstufen", "nutzerverwaltung"],
        absaetze: [
          "Unter Einstellungen → Nutzer siehst du alle Mitglieder deiner Behörde und weist jeder Person eine Rolle zu. Die Rolle bestimmt, welche Funktionen die Person nutzen kann, vom reinen Auskunftgeben bis zur vollen Verwaltung.",
          "Rollenänderungen wirken sofort, spätestens beim nächsten Seitenwechsel der betroffenen Person.",
        ],
        recht: "nutzer.rollen_verwalten",
      },
      {
        id: "sperren-entfernen",
        titel: "Konten sperren oder Personen entfernen",
        stichworte: ["deaktivieren", "ausschluss", "verlassen", "offboarding", "zugriff entziehen"],
        absaetze: [
          "Unter Einstellungen → Nutzer gibt es zwei Stufen: Sperren deaktiviert das Konto vorübergehend. Die Person kann sich nicht mehr anmelden, bleibt aber Mitglied und kann wieder entsperrt werden.",
          "Entfernen löst die Person ganz aus der Behörde und setzt ihre E-Mail-Adresse auf eine Ausschlussliste. Sie kommt beim nächsten Anmelden nicht automatisch wieder herein. Bei Bedarf kannst du die Adresse später wieder zulassen.",
        ],
        recht: "nutzer.sperren",
      },
      {
        id: "organigramm",
        titel: "Eigene Rollen und Rechte definieren",
        stichworte: ["organigramm", "rechteverwaltung", "rollen anlegen", "anpassen", "struktur"],
        absaetze: [
          "Unter Einstellungen → Organigramm passt du das Rollenmodell an deine Behörde an: neue Rollen anlegen und für jede Rolle einzeln festlegen, welche Rechte sie hat, von FAQ-Pflege über Kartenzeichnen bis zur Nutzerverwaltung.",
          "Die drei Standardrollen decken den Normalfall ab. Eigene Rollen lohnen sich, wenn deine Struktur feiner ist, etwa eine Redaktionsrolle, die FAQs pflegt, aber keine Nutzer verwaltet.",
        ],
        recht: "behoerde.konfigurieren",
      },
      {
        id: "dokumentation",
        titel: "Dokumentation: Wer hat wann was geändert?",
        stichworte: ["audit", "protokoll", "nachvollziehen", "log", "änderungsverlauf"],
        absaetze: [
          "Unter Einstellungen → Dokumentation führt VOX automatisch Buch über die wesentlichen Änderungen: wer wann eine Lage gestartet, ein FAQ geändert oder eine Antwort freigegeben hat.",
          "Das dient der Nachvollziehbarkeit im Einsatz und der sauberen Nachbereitung. Niemand muss von Hand protokollieren.",
        ],
        recht: "audit.einsehen",
      },
      {
        id: "plattform-verwaltung",
        titel: "Plattform-Verwaltung: Behörden freigeben und sperren",
        stichworte: ["betreiber", "mandanten", "behörden verwalten"],
        absaetze: [
          "Als Plattform-Betreiber siehst du unter Einstellungen → Plattform-Verwaltung alle Behörden der Plattform mit Status und Mitgliederzahl. Neue Behörden sind sofort nutzbar. Bei Missbrauch kannst du eine Behörde sperren, sodass deren Mitglieder nicht mehr in die App kommen.",
        ],
        nurPlattformAdmin: true,
      },
    ],
  },
  {
    id: "probleme",
    titel: "Wenn etwas nicht klappt",
    artikel: [
      {
        id: "login-link-fehlt",
        titel: "Anmeldelink kommt nicht an",
        stichworte: ["spam", "keine mail", "e-mail fehlt", "login klappt nicht", "firewall"],
        absaetze: [
          "Prüf zuerst den Spam- bzw. Junk-Ordner und ob die E-Mail-Adresse korrekt eingegeben wurde. Fordere dann einen neuen Link an. Jeder Link ist nur einmal und nur kurze Zeit gültig; ein älterer Link aus einem früheren Versuch funktioniert nicht mehr.",
          "Kommt dauerhaft keine E-Mail an, blockiert möglicherweise der Mailserver deiner Behörde den Absender. In diesem Fall hilft nur deine IT-Stelle weiter (Stichwort: Absender-Freischaltung).",
        ],
      },
      {
        id: "keine-lage-aktiv",
        titel: "„Keine Lage aktiv“: Was heißt das?",
        stichworte: ["tabs fehlen", "leere app", "karte weg", "nichts sichtbar"],
        absaetze: [
          "Wenn die Übersicht „Keine Lage aktiv“ zeigt und die Tabs Karte, Bürgeranfragen und FAQs fehlen, läuft gerade kein Einsatz. Das ist der Normalzustand zwischen zwei Krisen, kein Fehler.",
          "Sobald die Verwaltung eine Lage startet, erscheinen die Tabs und Inhalte automatisch.",
        ],
      },
      {
        id: "aktualitaet",
        titel: "Sehe ich immer den neuesten Stand?",
        stichworte: ["aktualisieren", "neu laden", "refresh", "veraltet", "synchron"],
        absaetze: [
          "Ja. Übersicht, Bürgeranfragen und Posteingang aktualisieren sich von selbst in kurzen Abständen. Du musst die Seite nicht von Hand neu laden, um neue FAQs oder Anfragen zu sehen.",
          "Wirkt etwas dennoch veraltet (etwa nach einer instabilen Internetverbindung), hilft ein Neuladen der Seite im Browser.",
        ],
      },
      {
        id: "notizen",
        titel: "Persönliche Notizen nutzen",
        stichworte: ["zettel", "merkzettel", "gedächtnis", "privat", "schichtübergabe"],
        absaetze: [
          "Hinter dem Zettel-Symbol oben rechts liegt dein persönlicher Notizblock. Er eignet sich für Dinge, die nirgendwo sonst hingehören: eine halbfertige Recherche, eine Durchwahl, eine Erinnerung für die Schichtübergabe.",
          "Die Notizen gehören zu deinem Konto. Inhalte, die das ganze Team braucht, gehören nicht in die Notizen, sondern in ein FAQ.",
        ],
      },
    ],
  },
];
