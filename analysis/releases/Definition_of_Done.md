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
- [ ] Relevante automatisierte Tests wurden ergänzt/angepasst (Unit/Integration/E2E je nach Scope).
- [ ] Alle betroffenen Tests laufen lokal oder in CI erfolgreich.
- [ ] Für nicht automatisierte Aspekte liegt ein dokumentierter manueller Testfall vor.

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
