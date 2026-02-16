# MVP – User Stories (TCX-Upload & Basisanalyse)

## Zielbild MVP
Im MVP sollen Amateurspieler ihre TCX-Dateien selbst hochladen können und eine erste verlässliche Basisanalyse ihrer Einheiten erhalten – auch wenn GPS nicht verfügbar ist. Der Fokus liegt auf robuster Datenerfassung, Transparenz der Datenqualität und einem nutzbaren ersten Mehrwert für einen einzelnen Nutzer.

---

## Story MVP-01: TCX-Datei manuell hochladen
**Als** Amateurspieler  
**möchte ich** meine TCX-Datei manuell in die Web-App hochladen  
**damit** meine Trainingseinheit zur Analyse verarbeitet wird.

### Acceptance Criteria
- [ ] Das System akzeptiert einen Datei-Upload über die Weboberfläche (Drag&Drop und Dateiauswahl).
- [ ] Es werden ausschließlich `.tcx` Dateien akzeptiert; andere Formate werden mit verständlicher Fehlermeldung abgelehnt.
- [ ] Die maximale Dateigröße ist klar kommuniziert; zu große Dateien werden sauber abgefangen.
- [ ] Nach erfolgreichem Upload sieht der Nutzer eine eindeutige Bestätigung (inkl. Dateiname und Upload-Zeit).
- [ ] Bei Fehlern (korrupt, unlesbar, unvollständig) erhält der Nutzer eine konkrete Fehlermeldung mit nächstem Schritt.

---

## Story MVP-02: Rohdatei zusätzlich in der Datenbank speichern
**Als** Nutzer  
**möchte ich** dass meine hochgeladene Datei zusätzlich im Rohformat gespeichert wird  
**damit** Analysen reproduzierbar sind und die Datei bei Bedarf erneut verarbeitet werden kann.

### Acceptance Criteria
- [ ] Nach erfolgreichem Upload wird die originale TCX-Datei unverändert im Rohformat in der DB abgelegt.
- [ ] Rohdatei ist eindeutig mit der Session verknüpft (z. B. via Session-ID/Upload-ID).
- [ ] Es wird ein Hash/Prüfwert gespeichert, um Datenintegrität zu prüfen.
- [ ] Bei Speicherfehler wird der Upload als fehlgeschlagen markiert und verständlich gemeldet.

---

## Story MVP-03: Grunddaten aus TCX extrahieren
**Als** Nutzer  
**möchte ich** nach dem Upload die wichtigsten Basisdaten sehen  
**damit** ich verstehe, ob meine Datei korrekt erkannt wurde.

### Acceptance Criteria
- [ ] Das System extrahiert mindestens: Startzeit, Dauer, Distanz (falls vorhanden), Herzfrequenz (falls vorhanden), Anzahl Trackpunkte.
- [ ] Fehlende Werte (z. B. keine GPS-Daten) führen nicht zum Abbruch, sondern werden als „nicht vorhanden“ markiert.
- [ ] Alle Einheiten werden konsistent angezeigt (z. B. Minuten, Meter/Kilometer, bpm).
- [ ] Zeitstempel werden in einer für den Nutzer verständlichen lokalen Darstellung angezeigt.

---

## Story MVP-04: Erste Qualitätsprüfung der Daten
**Als** Nutzer  
**möchte ich** einen einfachen Qualitätsstatus für meine Datei sehen  
**damit** ich weiß, wie belastbar die Analyse ist.

### Acceptance Criteria
- [ ] Das System zeigt einen Qualitätsstatus (z. B. „hoch“, „mittel“, „niedrig“).
- [ ] Die Bewertung berücksichtigt mindestens: Anteil fehlender Punkte, unplausible Sprünge, Vollständigkeit von Herzfrequenz/GPS.
- [ ] Die Gründe für die Einstufung werden transparent in Klartext angezeigt.
- [ ] Die Qualitätslogik ist dokumentiert und für spätere Iterationen erweiterbar.

---

## Story MVP-05: Session-Liste mit Upload-Historie
**Als** Nutzer  
**möchte ich** eine Liste meiner hochgeladenen Dateien sehen  
**damit** ich meine bisherigen Einheiten wiederfinde.

### Acceptance Criteria
- [ ] Es gibt eine tabellarische oder kartenbasierte Übersicht aller hochgeladenen Sessions.
- [ ] Pro Eintrag werden mindestens angezeigt: Dateiname, Upload-Zeit, Aktivitätszeitpunkt, Qualitätsstatus.
- [ ] Die Liste ist nach Upload-Zeit sortierbar (neueste zuerst als Default).
- [ ] Ein Klick auf einen Eintrag öffnet die Detailansicht der Session.

---

## Story MVP-06: Basis-Detailseite je Session
**Als** Nutzer  
**möchte ich** eine Detailansicht je Session sehen  
**damit** ich die extrahierten Daten im Kontext prüfen kann.

### Acceptance Criteria
- [ ] Detailseite zeigt Basiskennzahlen (Dauer, Distanz, HF min/avg/max sofern vorhanden, Punkteanzahl).
- [ ] Sichtbarer Hinweis, ob GPS-Daten vorhanden sind oder nicht.
- [ ] Bei fehlenden Daten werden nachvollziehbare Hinweise anstelle leerer/defekter Diagramme gezeigt.
- [ ] Die Seite ist auf Mobile und Desktop lesbar und bedienbar.
