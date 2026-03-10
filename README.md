# Sportkijken

Nederlandstalige sportkijkgids voor `sportkijken.paulzuiderduin.com`.

## MVP

- Selecteer sport(en): voetbal, formule 1, tennis
- Bekijk per event: starttijd (NL), kanaal/stream en gratis of betaald
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
npm run data:normalize
```

Dit script valideert verplichte velden, sorteert events op datum en schrijft de dataset terug.

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

Deze MVP gebruikt nu handmatig samengestelde data. Uitzendrechten en tijden kunnen wijzigen; controleer altijd op de wedstrijddag.
