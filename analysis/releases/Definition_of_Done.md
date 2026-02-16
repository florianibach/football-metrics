# Definition of Done (DoD) – Football Metrics Web App

Diese Definition of Done gilt releaseübergreifend (MVP, R1, R1.5, R2) für fachliche Stories, technische Stories und Bugfixes.

## 1) Fachliche Abnahme
- [ ] User Story ist vollständig umgesetzt und erfüllt alle definierten Acceptance Criteria.
- [ ] Ergebnis ist aus Anwendersicht nachvollziehbar (Single-User-Perspektive).
- [ ] Fachliche Grenzfälle wurden berücksichtigt (z. B. fehlendes GPS, fehlende HF, fehlerhafte TCX-Struktur).

## 2) Datenqualität & Analytik
- [ ] Eingangsvalidierung für TCX-Daten ist vorhanden und getestet.
- [ ] Fehlende oder unplausible Daten werden transparent ausgewiesen (kein stilles „Durchmogeln“).
- [ ] Berechnungen nutzen dokumentierte Regeln/Schwellen/Parameter.
- [ ] Bei Änderungen an Algorithmen ist nachvollziehbar, was geändert wurde und warum.
- [ ] Falls vorgesehen, wird die Rohdatei unverändert und referenzierbar gespeichert.

## 3) UX & Transparenz
- [ ] Mobile-First ist der Standard in Konzeption und Umsetzung (Layout, Navigation, Lesbarkeit, Interaktion).
- [ ] Erfolg, Warnungen und Fehler werden nutzerverständlich kommuniziert.
- [ ] Nicht verfügbare Metriken sind klar gekennzeichnet (nicht mit 0 verwechselt).
- [ ] Zu jeder Metrik ist ein verständlicher Info-Text (Zweck, Einheit, Interpretation) verfügbar.
- [ ] Interne und externe Metriken sind in der UI eindeutig unterscheidbar.
- [ ] Relevante Informationen sind auf Mobile und Desktop bedienbar.

## 4) Technische Qualität
- [ ] Code entspricht Projektkonventionen und wurde mit sinnvoller Struktur umgesetzt.
- [ ] Es gibt keine offensichtlichen Regressionen in vorhandenen Kernfunktionen.
- [ ] Logging ist ausreichend, um Fehler im Betrieb zu analysieren.
- [ ] Sicherheit und Datenschutzanforderungen der Story wurden berücksichtigt.

## 5) Tests
- [ ] Jedes einzelne Acceptance Criterion (AC) ist durch mindestens einen automatisierten Test abgedeckt.
- [ ] Testfälle sind auf das jeweilige AC rückverfolgbar (z. B. AC-ID im Testnamen oder in der Testbeschreibung).
- [ ] Für E2E-Tests ist zusätzlich ein klarer Story-Bezug im Test hinterlegt/kommentiert (Story-ID + Ziel der Story).
- [ ] Alle betroffenen automatisierten Tests sind lokal in der Entwicklung grün, bevor committet/merged wird.
- [ ] Es gibt lokale Quality Gates (z. B. pre-commit/pre-push Hooks), damit Testfehler früh auffallen und nicht erst im Buildserver.
- [ ] Falls notwendige Prüftools fehlen, werden sie im Dev-Setup nachinstalliert und in einem Bootstrap-Skript/README dokumentiert.

## 6) Dokumentation
- [ ] Story-spezifische Dokumentation wurde aktualisiert (z. B. Verhalten, Parameter, Einschränkungen).
- [ ] Bei API-/Datenmodelländerungen sind Schnittstellen sauber dokumentiert.
- [ ] Release Notes/Change Summary sind für Stakeholder verständlich formuliert.

## 7) Release-Readiness
- [ ] Feature ist deploybar und durch Konfiguration steuerbar, falls notwendig.
- [ ] Monitoring/Alerting-Anforderungen der Story sind erfüllt (mindestens für kritische Pfade).
- [ ] Rückroll- oder Fallback-Strategie ist für risikoreiche Änderungen definiert.

## 8) Abnahme-Check (Kurzform)
Eine Story gilt erst dann als „Done“, wenn:
1. **Fachlich korrekt** (AC erfüllt),
2. **technisch stabil** (Tests/Qualität),
3. **für Nutzer verständlich** (UX/Transparenz),
4. **operativ betreibbar** (Monitoring/Doku).
