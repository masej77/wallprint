# NordicWall Print — TWF1000 UV Væg- & Gulvprint Webapplikation

Komplet, responsiv dansk webapplikation til en vertikal væg- og gulvprint-forretning baseret på **TWF1000 UV Wall & Floor Printer**. Bygget i ren **HTML5, CSS3 og Vanilla JavaScript** uden tunge eksterne afhængigheder, så den kan deployes direkte som et statisk site (f.eks. Cloudflare Pages eller GitHub Pages).

## Projektstruktur

```text
wallprint/
├── public/
│   ├── index.html    # Semantisk HTML5 struktur (Navigation, Hero, TWF1000 Specs, Visualizer, FAQ, Modal)
│   ├── styles.css    # Skandinavisk arkitektonisk designsystem & responsivt layout
│   └── app.js        # Interaktivt HTML5 <canvas>, skalering, målberegning & dynamisk prismotor
├── src/
│   └── worker.js     # Cloudflare Worker entry point (serverer statiske filer fra public/)
├── wrangler.jsonc    # Cloudflare Wrangler konfiguration
└── README.md         # Projektdokumentation
```

## Nøglefunktioner

1. **Skandinavisk Arkitektonisk Design:**
   - Neutral `#f8fafc` baggrund, `#ffffff` kort, `#e2e8f0` kanter, `#0f172a` typografi (`Plus Jakarta Sans` & `Inter`) og `#2563eb` industriel blå accent.
2. **Interaktiv Væg-Visualizer (`<canvas>`):**
   - Indbyggede testvægge (*Glat stuevæg*, *Rå mursten*, *Moderne beton*) samt upload af kundens eget vægbillede.
   - Indbyggede demomotiver (*Nordisk Arkitektur*, *Botanisk Kunst*, *Erhvervslogo*) samt upload af eget motiv/logo.
   - Træk motivet frit og skaler proportionalt med både hjørnehåndtag på lærredet og størrelsesslider (understøtter både mus og touch).
   - Realtids målsætning tegnet direkte på lærredet: **Bredde (cm) × Højde (cm)**, **Printareal ($m^2$)** og **Tophøjde fra gulv (cm)**.
   - Toggle til **"Simuler på vægstruktur"** for naturlig sammensmeltning med væggens struktur.
3. **TWF1000 Dynamisk Prisberegner (`PRICING_CONFIG`):**
   - **Opstartsgebyr:** `1.500 kr.`
   - **Grundpris:** `950 kr./m²`
   - **Underlag:**
     - *Malet gips / glat puds:* `0 kr.`
     - *Mursten / rå beton:* `+150 kr./m²`
     - *Glas / fliser / metal:* `+200 kr./m²`
   - **Gulvforhold & Køreskinner:**
     - *Plant og jævnt gulv:* `0 kr.`
     - *Ujævnt gulv / udendørs / tæppe (skinnesystem):* `+1.200 kr.`
   - **Mørk væg / hvidt UV-underprint:** `+120 kr./m²`
   - **Automatisk højdetjek:** Ved print-tophøjde over `250 cm` aktiveres automatisk **Højdetillæg (forlængermast/stillads)** på `+1.800 kr.` samt advarselsbanner.
4. **Forbehold & Lead Capture Modal med PNG-Snapshot:**
   - Tydelig *Forbehold*-boks med fysiske TWF1000-krav (min. 60 cm fri afstand fra væg, 230V strøm m.m.).
   - Modal der opsummerer alle mål, valg og priser, genererer et **downloadbart PNG-billede** af kundens væg-mockup og indsamler kontaktdata.

## Tilpasning af priser

Alle priser og grænseværdier er samlet i `PRICING_CONFIG` øverst i `app.js`:

```javascript
const PRICING_CONFIG = {
  basePricePerSqm: 950,
  startupFee: 1500,
  whiteUnderprintPerSqm: 120,
  heightThresholdCm: 250,
  heightSurcharge: 1800,
  vatRate: 0.25,
  // ...
};
```
