# Spieldaten-Importformat

Import: `npx tsx scripts/import-gamedata.ts datei.json` (im Container: `docker compose exec app npx tsx scripts/import-gamedata.ts /app/storage/gamedata.json`).
Jeder Import legt eine **neue Version** an (`GameDataVersion`), alte bleiben erhalten. Die Datei wird strikt validiert; es wird nichts ergänzt oder geschätzt. Werte gelten für **Server-Speed 1**, Zeiten werden beim Anzeigen durch die Server-Geschwindigkeit geteilt.

```json
{
  "source": "https://knowledgebase.legends.travian.com/… (abgerufen 2026-10-14)",
  "serverSpeed": 1,
  "notes": "",
  "tribes": [{ "key": "romans", "name": "Römer", "traits": {} }],
  "buildings": [{
    "key": "main_building", "name": "Hauptgebäude", "category": "infrastructure",
    "tribeRestriction": null, "maxLevel": 20, "prerequisites": [], "description": "",
    "levels": [{ "level": 1, "costWood": 0, "costClay": 0, "costIron": 0, "costCrop": 0,
                 "upkeep": 0, "buildTimeSec": 0, "culturePoints": 0, "effects": {} }]
  }],
  "units": [{
    "tribe": "romans", "key": "legionnaire", "name": "Legionär",
    "attack": 0, "defInf": 0, "defCav": 0, "speed": 0, "carry": 0,
    "costWood": 0, "costClay": 0, "costIron": 0, "costCrop": 0, "upkeep": 0,
    "trainTimeSec": 0, "building": "barracks", "researchReq": {}
  }]
}
```
(Die Zahlen oben sind Platzhalter für die Struktur, keine Spielwerte.)

Regeln: `key` nur `a-z0-9_`; Stufen je Gebäude lückenlos ab 1 und ≤ `maxLevel`; Einheiten verweisen auf ein Volk aus `tribes`; `tribeRestriction` muss ein Volk-Key sein; keine doppelten Keys.
