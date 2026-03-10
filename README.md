# Sportkijken

Nederlandstalige sportkijkgids voor `sportkijken.paulzuiderduin.com`.

## MVP

- Selecteer sport(en): voetbal, formule 1, tennis, basketbal, american football, honkbal, ijshockey, golf, vechtsport
- Filter op aanbieders (bijvoorbeeld NOS.nl, NPO 1/2/3, NPO Start, Ziggo Sport, Viaplay, ESPN)
- Bekijk per event: starttijd (NL), kanaal/stream en gratis of betaald
- Directe kliklinks naar provider/livestreampagina's waar beschikbaar
- Filter op periode en toegangstype
- Lokale voorkeuren opslaan in browser (`localStorage`)
- Export van huidige selectie als `.ics` kalenderbestand

## Stack

- React + Vite
- GitHub Pages deploy
- Geen login en geen Supabase voor MVP

## Lokaal draaien

```bash
npm install
npm run dev
```

## Data bijwerken

Dataset staat in `src/data/events.nl.json`.

```bash
npm run data:update
npm run data:normalize
```

- `data:update` haalt automatisch events op uit meerdere bronnen:
  ESPN-scoreboards (o.a. voetbal, formule 1, tennis) + NOS sport-livestreams (`nos.nl/sport`),
  past NL-kijkkanaalregels toe (inclusief NOS/NPO gratis streams bij relevante events)
  en markeert bij UEFA-voetbal geselecteerde Ziggo Sport-wedstrijden als gratis (heuristiek voor NL-clubs/finalerondes),
  en schrijft alleen weg als eventdata echt veranderd is.
- `data:normalize` valideert verplichte velden, sorteert events op datum en schrijft de dataset terug.

## Automatische updates

- Workflow: `.github/workflows/update-data.yml`
- Frequentie: elk uur (`cron: 17 * * * *`, UTC)
- Bij gewijzigde data commit + push naar `main`, waarna de Pages deploy-workflow automatisch draait.

## Deploy-doel

- Domein: `sportkijken.paulzuiderduin.com`
- Deploy: GitHub Pages

## Handmatige vervolgstappen

1. Maak een nieuwe GitHub repository `sportkijken` (public).
2. Push deze map als eigen repository naar GitHub.
3. Zet GitHub Pages aan op de `main` branch via GitHub Actions.
4. Voeg in `mijn.host` het DNS-record voor `sportkijken.paulzuiderduin.com` toe.
5. Stel custom domain in GitHub Pages in en forceer HTTPS.
6. Voeg vanaf de landing page op `paulzuiderduin.com` een link naar Sportkijken toe.

## Opmerking

Tijden worden automatisch ververst, maar uitzendrechten in Nederland kunnen per wedstrijd wijzigen.
Controleer bij twijfel altijd de zender op wedstrijddag.

Olympische eventdata komt niet altijd betrouwbaar uit de huidige externe feeds. Gebruik
`src/data/major-events.nl.json` voor handmatige toevoegingen van grote events wanneer nodig.
