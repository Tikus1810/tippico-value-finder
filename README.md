# Value Finder – Wett-Analyse-App (PC & Handy)

Eine private Web-App (PWA), die Tipico-Quoten mit mehreren anderen Buchmachern vergleicht,
daraus eine faire Gewinnwahrscheinlichkeit schätzt und dir Value-Wetten inkl. Einsatzvorschlag
(1-10€) und Konfidenz-Score anzeigt. Läuft im Browser auf PC und Handy (installierbar als App).

## 🌐 Live

Läuft öffentlich unter **https://value-finder.onrender.com** (Render.com, kostenloser Tarif).
Schläft nach ~15 Min. Inaktivität ein (erster Aufruf danach dauert 30–50 Sek.), Wett-Verlauf
kann bei einem Neu-Deploy zurückgesetzt werden. Läuft komplett unabhängig von der lokalen
Version unten (eigene, separate Datenbank).

## ⚠️ Wichtig – bitte lesen

- **Keine Gewinngarantie.** Die "faire Wahrscheinlichkeit" ist eine statistische Schätzung auf
  Basis eines Quotenvergleichs mehrerer Buchmacher (sogenanntes Value Betting / "de-vigging").
  Buchmacher wie Tipico kalkulieren ihre Quoten im Schnitt sehr effizient – ein positiver "Edge"
  in der App bedeutet einen rechnerischen Erwartungswert-Vorteil, keine sichere Vorhersage.
- **Die App platziert keine Wetten für dich.** Sie zeigt dir nur Empfehlungen an. Die Wette
  schließt du selbst bei Tipico ab.
- **Setz nur Geld ein, dessen Verlust du dir leisten kannst.** Wenn sich Wetten für dich nicht
  mehr wie eine bewusste Entscheidung anfühlen, sondern wie ein Zwang, ist das ein Warnsignal –
  die BZgA bietet unter [checkdeinspiel.de](https://www.checkdeinspiel.de) und der Hotline
  **0800 1 37 27 00** kostenlose, anonyme Beratung.

## Architektur

```
tippico-value-finder/
  backend/    Node.js + Express + SQLite (node:sqlite) – holt Quoten, berechnet Value/Kombis & Konfidenz, speichert Verlauf
  frontend/   React + Vite PWA – Dashboard, Kombi-Vorschläge, eigene Wetten erfassen, Verlauf/Statistik, Ligen-Einstellungen
```

Die Datenbank läuft über Node's eingebautes `node:sqlite`-Modul (kein separates natives Paket
nötig) – braucht Node.js **22.5 oder neuer**.

- **Datenquelle:** [The Odds API](https://the-odds-api.com/) (kostenloser Tier: 500 Requests/Monat).
  Tipico ist dort unter dem Bookmaker-Key `tipico_de` (Region `eu`) gelistet.
- **Value-Berechnung:** Für jedes Match werden die Quoten mehrerer Vergleichs-Buchmacher
  (Pinnacle, Bet365, 1xBet, …) "entvigged" (Marge rausgerechnet) und gemittelt → faire
  Wahrscheinlichkeit. Ist `faire_Wahrscheinlichkeit × Tipico_Quote > 1`, hat die Wette einen
  positiven Erwartungswert ("Edge"). Der Konfidenz-Score (0-100) gewichtet Edge-Höhe, Anzahl der
  Vergleichs-Buchmacher und wie einig sie sich sind – daraus ergibt sich der 1-10€-Einsatzvorschlag.
  Details: [`backend/src/valueCalc.js`](backend/src/valueCalc.js).

## Setup

### 1. API-Key besorgen

Kostenlos registrieren auf [the-odds-api.com](https://the-odds-api.com/) → API-Key kopieren.

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
# .env öffnen und ODDS_API_KEY eintragen
npm run dev
```

Backend läuft dann auf `http://localhost:4000`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend läuft auf `http://localhost:5173` und spricht im Dev-Betrieb automatisch mit dem
Backend (Proxy).

### 4. Erste Schritte in der App

1. Tab **Einstellungen** öffnen → Ligen auswählen (auch kleinere Ligen sind verfügbar).
2. Tab **Empfehlungen** öffnen → "Aktualisieren" klicken.
3. Wette bei Tipico wie gewohnt selbst platzieren, dann in der App auf
   "Als platziert vormerken" klicken, um sie im Verlauf zu tracken.
4. Nach Spielende im Tab **Verlauf** Status auf "gewonnen"/"verloren" setzen → Statistik
   (Trefferquote, ROI) aktualisiert sich automatisch.

## Zugriff vom Handy (gleiches WLAN)

1. IP-Adresse deines PCs herausfinden: `ipconfig` (Windows) → z. B. `192.168.1.23`.
2. Frontend mit `npm run dev -- --host` starten (macht `vite.config.js` bereits über
   `server.host: true`).
3. Auf dem Handy im selben WLAN `http://192.168.1.23:5173` öffnen.
4. Damit das Handy auch das Backend erreicht, beim Frontend-Start
   `VITE_API_BASE_URL=http://192.168.1.23:4000 npm run dev` setzen (oder die Variable in einer
   `.env`-Datei im `frontend/`-Ordner hinterlegen).
5. Im Handy-Browser über "Zum Startbildschirm hinzufügen" installieren → App-artiges Icon.

Für dauerhaften Zugriff von unterwegs (nicht nur im Heim-WLAN) müsste die App später auf einen
kleinen Server/Hosting-Dienst deployed werden – sag Bescheid, wenn du das als nächsten Schritt
willst.

## Produktions-Build (optional)

```bash
cd frontend
npm run build      # erzeugt frontend/dist
```

`frontend/dist` kann z. B. vom Backend mitausgeliefert oder auf einen Static-Host gelegt werden.

## Bekannte Grenzen / nächste Ausbaustufen

- Die Liste der Vergleichs-Buchmacher in
  [`backend/src/routes/recommendations.js`](backend/src/routes/recommendations.js) ist eine
  sinnvolle Startauswahl – falls The Odds API einen Key davon ablehnt oder umbenennt, dort
  anpassen (aktuelle Keys: <https://the-odds-api.com/sports-odds-data/bookmaker-apis.html>).
- Die **automatische Empfehlungs-/Kombi-Berechnung** wertet nur den Markt **1X2 / h2h**
  (Sieg/Unentschieden/Niederlage) aus. Andere Wetten (Über/Unter, Beide Teams treffen,
  Torschütze, Handicap, ...) kannst du im Dashboard über "+ Eigene Wette erfassen" manuell
  eintragen (auch als Kombi mit mehreren Beinen) - die werden nur getrackt, nicht bewertet.
- Kombi-Vorschläge kombinieren nur unabhängige Einzel-Value-Wetten aus verschiedenen Spielen;
  die Konfidenz wird pro zusätzlichem Bein bewusst reduziert, da sich die Marge jedes
  Buchmachers mit jedem Bein multipliziert.
- Kein Login/Mehrbenutzer-Betrieb – für den persönlichen Gebrauch gedacht.
- Der Konfidenz-Score ist eine selbst gewählte Heuristik, kein statistisch validiertes Modell.
