/**
 * NordicWall Print — TWF1000 Interactive Wall Visualizer & Dynamic Pricing Engine
 * Pure Vanilla JavaScript (ES6+)
 */

// ============================================================================
// 1. PRICING CONFIGURATION (Let at tilpasse priser og grænseværdier her)
// ============================================================================
const PRICING_CONFIG = {
  basePricePerSqm: 950,          // Grundpris pr. m² (kr.)
  startupFee: 1500,              // Fast opstarts- og kalibreringsgebyr (kr.)
  whiteUnderprintPerSqm: 120,    // Tillæg for hvidt UV-underprint på mørk væg (kr./m²)
  heightThresholdCm: 250,        // Grænse for printhøjde fra gulv før højdetillæg (cm)
  heightSurcharge: 1800,         // Fast tillæg ved tophøjde > 250 cm (forlængermast/stillads) (kr.)
  vatRate: 0.25,                 // Dansk moms (25 %)

  surfaces: {
    plaster: {
      label: 'Malet gips / glat puds',
      surchargePerSqm: 0
    },
    brick: {
      label: 'Mursten / rå beton',
      surchargePerSqm: 150
    },
    glass: {
      label: 'Glas / fliser / metal',
      surchargePerSqm: 200
    }
  },

  floors: {
    flat: {
      label: 'Plant og jævnt gulv (Standard hjuldrift)',
      surchargeFixed: 0
    },
    track: {
      label: 'Ujævnt gulv / udendørs / tæppe (Kræver skinnesystem)',
      surchargeFixed: 1200
    }
  }
};

// ============================================================================
// 2. APPLICATION STATE
// ============================================================================
const state = {
  wallWidthCm: 350,              // Kalibreret vægbredde i billedet (cm)
  wallPreset: 'plaster',         // 'plaster' | 'brick' | 'concrete' | 'custom'
  customWallImg: null,           // Image objekt ved brugeruploadet væg

  artPreset: 'nordic',           // 'nordic' | 'botanic' | 'logo' | 'custom'
  artImg: null,                  // Aktuelt motiv som Image/Canvas-kilde
  artAspect: 1.42,               // Bredde / højde-forhold på motiv

  // Motivets placering og størrelse i canvas-koordinater (900 x 580)
  artX: 270,
  artY: 135,
  artW: 360,
  artH: 253,
  baseArtW: 360,                 // Referencebredde ved 100% skalering

  simulateTexture: true,         // Om motivet blender naturligt med vægstrukturen
  manualTopHeightOverride: false,// Hvis brugeren skriver tophøjden manuelt i feltet
  topHeightCm: 210,              // Beregnet eller indtastet tophøjde fra gulv (cm)

  // Interaktionsstatus (træk / skalering på canvas)
  interactionMode: null,         // 'drag' | 'resize-tl' | 'resize-tr' | 'resize-bl' | 'resize-br' | null
  dragStartX: 0,
  dragStartY: 0,
  initialArtX: 0,
  initialArtY: 0,
  initialArtW: 0,
  initialArtH: 0,

  // Gulvlinje i canvas-koordinater (bruges til højdeestimering på vægbilledet)
  floorLineY: 500
};

// ============================================================================
// 3. DOM ELEMENTS
// ============================================================================
const canvas = document.getElementById('wall-canvas');
const ctx = canvas.getContext('2d');

const wallPresetBtns = document.querySelectorAll('[data-wall-preset]');
const artPresetBtns = document.querySelectorAll('[data-art-preset]');
const wallUploadInput = document.getElementById('wall-upload-input');
const artUploadInput = document.getElementById('art-upload-input');

const scaleSlider = document.getElementById('scale-slider');
const scalePercentLabel = document.getElementById('scale-percent-label');
const textureBlendToggle = document.getElementById('texture-blend-toggle');
const centerArtworkBtn = document.getElementById('center-artwork-btn');

const wallWidthInput = document.getElementById('wall-width-input');
const printTopHeightInput = document.getElementById('print-top-height-input');
const surfaceSelect = document.getElementById('surface-select');
const floorSelect = document.getElementById('floor-select');
const whiteUnderprintCheckbox = document.getElementById('white-underprint-checkbox');
const heightWarningBanner = document.getElementById('height-warning-banner');

// Readouts
const readoutWidth = document.getElementById('readout-width');
const readoutHeight = document.getElementById('readout-height');
const readoutArea = document.getElementById('readout-area');
const readoutTopHeight = document.getElementById('readout-top-height');

// Price Breakdown Elements
const priceStartupEl = document.getElementById('price-startup');
const priceBaseLabelEl = document.getElementById('price-base-label');
const priceBaseEl = document.getElementById('price-base');
const priceSurfaceLabelEl = document.getElementById('price-surface-label');
const priceSurfaceEl = document.getElementById('price-surface');
const priceUnderprintRow = document.getElementById('price-underprint-row');
const priceUnderprintLabelEl = document.getElementById('price-underprint-label');
const priceUnderprintEl = document.getElementById('price-underprint');
const priceFloorRow = document.getElementById('price-floor-row');
const priceFloorEl = document.getElementById('price-floor');
const priceHeightRow = document.getElementById('price-height-row');
const priceHeightEl = document.getElementById('price-height');
const priceTotalEl = document.getElementById('price-total');
const priceTotalInclVatEl = document.getElementById('price-total-incl-vat');

// Modal Elements
const leadModal = document.getElementById('lead-modal');
const openLeadModalBtn = document.getElementById('open-lead-modal-btn');
const closeLeadModalBtn = document.getElementById('close-lead-modal-btn');
const modalSnapshotImg = document.getElementById('modal-snapshot-img');
const downloadSnapshotLink = document.getElementById('download-snapshot-link');
const leadForm = document.getElementById('lead-form');
const leadSuccessMessage = document.getElementById('lead-success-message');

const summaryDimensionsEl = document.getElementById('summary-dimensions');
const summaryTopHeightEl = document.getElementById('summary-top-height');
const summarySurfaceEl = document.getElementById('summary-surface');
const summaryFloorEl = document.getElementById('summary-floor');
const summaryUnderprintEl = document.getElementById('summary-underprint');
const summaryPriceEl = document.getElementById('summary-price');

// ============================================================================
// 4. PROCEDURAL BUILT-IN WALL BACKGROUNDS & SAMPLE ARTWORKS (CORS-FREE)
// ============================================================================
const wallCanvasCache = {};

function getBuiltInWallCanvas(type) {
  if (wallCanvasCache[type]) return wallCanvasCache[type];

  const off = document.createElement('canvas');
  off.width = canvas.width;
  off.height = canvas.height;
  const c = off.getContext('2d');
  const W = off.width;
  const H = off.height;
  const floorY = state.floorLineY;

  if (type === 'plaster') {
    // Skandinavisk lys stuevæg (glat puds / malet gips)
    const wallGrad = c.createLinearGradient(0, 0, W, floorY);
    wallGrad.addColorStop(0, '#f8fafc');
    wallGrad.addColorStop(0.6, '#f1f5f9');
    wallGrad.addColorStop(1, '#e2e8f0');
    c.fillStyle = wallGrad;
    c.fillRect(0, 0, W, floorY);

    // Subtil puds-struktur
    c.fillStyle = 'rgba(148, 163, 184, 0.06)';
    for (let i = 0; i < 1800; i++) {
      const rx = (i * 97) % W;
      const ry = (i * 53) % floorY;
      c.fillRect(rx, ry, 2, 2);
    }

    // Lysindfald fra venstre vindue
    const sunGrad = c.createLinearGradient(0, 0, W * 0.65, floorY);
    sunGrad.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
    sunGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    c.fillStyle = sunGrad;
    c.fillRect(0, 0, W, floorY);
  } else if (type === 'brick') {
    // New Yorker / dansk rå murstensvæg
    c.fillStyle = '#b8aaa0';
    c.fillRect(0, 0, W, floorY);

    const brickW = 68;
    const brickH = 24;
    const mortar = 4;
    const palette = ['#9a4b38', '#8c3f2f', '#a85742', '#7c3626', '#ad624c'];

    for (let row = 0; row * (brickH + mortar) < floorY; row++) {
      const y = row * (brickH + mortar);
      const offset = (row % 2) * (brickW / 2);
      for (let col = -1; col * (brickW + mortar) < W + brickW; col++) {
        const x = col * (brickW + mortar) + offset;
        const colorIdx = Math.abs((row * 17 + col * 31) % palette.length);
        c.fillStyle = palette[colorIdx];
        c.fillRect(x, y, brickW, brickH);

        // Tekstur på mursten
        c.fillStyle = 'rgba(0,0,0,0.08)';
        c.fillRect(x + 3, y + brickH - 4, brickW - 6, 3);
        c.fillStyle = 'rgba(255,255,255,0.07)';
        c.fillRect(x + 2, y + 2, brickW - 4, 2);
      }
    }
  } else if (type === 'concrete') {
    // Moderne arkitektonisk rå betonvæg med støbeskel
    const concGrad = c.createLinearGradient(0, 0, W, floorY);
    concGrad.addColorStop(0, '#cbd5e1');
    concGrad.addColorStop(0.5, '#94a3b8');
    concGrad.addColorStop(1, '#64748b');
    c.fillStyle = concGrad;
    c.fillRect(0, 0, W, floorY);

    // Betonpaneler og centerhuller
    const panelW = 225;
    c.strokeStyle = 'rgba(30, 41, 59, 0.22)';
    c.lineWidth = 2;
    for (let px = panelW; px < W; px += panelW) {
      c.beginPath();
      c.moveTo(px, 0);
      c.lineTo(px, floorY);
      c.stroke();
    }
    c.beginPath();
    c.moveTo(0, floorY / 2);
    c.lineTo(W, floorY / 2);
    c.stroke();

    // Form-huller i beton
    c.fillStyle = 'rgba(30, 41, 59, 0.35)';
    for (let px = 0; px < W; px += panelW) {
      [40, floorY / 2 - 35, floorY / 2 + 35, floorY - 40].forEach(py => {
        c.beginPath();
        c.arc(px + 28, py, 4, 0, Math.PI * 2);
        c.arc(px + panelW - 28, py, 4, 0, Math.PI * 2);
        c.fill();
      });
    }
  }

  // Fodpanel (Skirting board)
  c.fillStyle = '#ffffff';
  c.fillRect(0, floorY - 12, W, 12);
  c.strokeStyle = '#cbd5e1';
  c.lineWidth = 1;
  c.strokeRect(0, floorY - 12, W, 12);

  // Nordisk egetræsgulv
  const floorGrad = c.createLinearGradient(0, floorY, 0, H);
  floorGrad.addColorStop(0, '#d6c3a5');
  floorGrad.addColorStop(1, '#bfa582');
  c.fillStyle = floorGrad;
  c.fillRect(0, floorY, W, H - floorY);

  // Gulvplanker i perspektiv
  c.strokeStyle = 'rgba(120, 90, 55, 0.22)';
  c.lineWidth = 1;
  for (let i = 1; i <= 4; i++) {
    const py = floorY + i * 19;
    c.beginPath();
    c.moveTo(0, py);
    c.lineTo(W, py);
    c.stroke();
  }

  // Diskret arkitektonisk potteplante og bænk i hjørnet for størrelsesfornemmelse
  // Træbænk nederst til højre
  c.fillStyle = '#78350f';
  c.fillRect(W - 205, floorY - 48, 165, 12);
  c.fillStyle = '#451a03';
  c.fillRect(W - 190, floorY - 36, 10, 44);
  c.fillRect(W - 65, floorY - 36, 10, 44);

  // Krukke til venstre
  c.fillStyle = '#334155';
  c.beginPath();
  c.roundRect(42, floorY - 78, 54, 84, [6, 6, 14, 14]);
  c.fill();
  // Grønne blade
  c.fillStyle = '#15803d';
  c.beginPath();
  c.ellipse(52, floorY - 102, 16, 32, -0.35, 0, Math.PI * 2);
  c.ellipse(78, floorY - 110, 16, 36, 0.25, 0, Math.PI * 2);
  c.ellipse(65, floorY - 122, 14, 34, 0, 0, Math.PI * 2);
  c.fill();

  wallCanvasCache[type] = off;
  return off;
}

function createSampleArtworkCanvas(type) {
  const off = document.createElement('canvas');
  off.width = 720;
  off.height = 500;
  const c = off.getContext('2d');
  const W = off.width;
  const H = off.height;

  if (type === 'nordic') {
    // Nordisk Geometri & Arkitektur vægmaleri
    c.fillStyle = '#0f172a';
    c.beginPath();
    c.arc(215, 250, 175, 0, Math.PI * 2);
    c.fill();

    c.fillStyle = '#2563eb';
    c.beginPath();
    c.roundRect(290, 65, 290, 360, [145, 145, 12, 12]);
    c.fill();

    c.fillStyle = '#f59e0b';
    c.beginPath();
    c.arc(485, 195, 78, 0, Math.PI * 2);
    c.fill();

    c.fillStyle = '#f8fafc';
    for (let i = 0; i < 6; i++) {
      c.fillRect(140 + i * 24, 250, 12, 175);
    }

    c.strokeStyle = '#0ea5e9';
    c.lineWidth = 10;
    c.beginPath();
    c.moveTo(95, 390);
    c.bezierCurveTo(230, 260, 420, 440, 635, 295);
    c.stroke();
  } else if (type === 'botanic') {
    // Botanisk Linjekunst & Organiske Former
    c.fillStyle = '#1e293b';
    c.beginPath();
    c.ellipse(250, 270, 155, 185, -0.15, 0, Math.PI * 2);
    c.fill();

    c.fillStyle = '#0d9488';
    c.beginPath();
    c.ellipse(455, 235, 145, 175, 0.2, 0, Math.PI * 2);
    c.fill();

    // Organiske blade i hvid og guld
    c.strokeStyle = '#f8fafc';
    c.lineWidth = 6;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(350, 440);
    c.quadraticCurveTo(345, 240, 395, 80);
    c.stroke();

    const leaves = [
      { x: 355, y: 340, dx: -110, dy: -55 },
      { x: 360, y: 270, dx: 115, dy: -50 },
      { x: 368, y: 205, dx: -95, dy: -60 },
      { x: 378, y: 145, dx: 90, dy: -45 }
    ];
    leaves.forEach(lf => {
      c.beginPath();
      c.moveTo(lf.x, lf.y);
      c.quadraticCurveTo(lf.x + lf.dx * 0.6, lf.y + lf.dy - 25, lf.x + lf.dx, lf.y + lf.dy);
      c.quadraticCurveTo(lf.x + lf.dx * 0.5, lf.y + 10, lf.x, lf.y);
      c.stroke();
    });
  } else if (type === 'logo') {
    // Erhvervslogo & Typografi ( Kontorvæg )
    c.fillStyle = '#1e3a8a';
    c.beginPath();
    c.roundRect(45, 85, 630, 330, 24);
    c.fill();

    // Geometrisk ikon
    c.fillStyle = '#38bdf8';
    c.beginPath();
    c.moveTo(115, 325);
    c.lineTo(185, 165);
    c.lineTo(255, 325);
    c.closePath();
    c.fill();

    c.fillStyle = '#ffffff';
    c.beginPath();
    c.moveTo(165, 325);
    c.lineTo(220, 200);
    c.lineTo(275, 325);
    c.closePath();
    c.fill();

    c.fillStyle = '#ffffff';
    c.font = '800 54px "Plus Jakarta Sans", sans-serif';
    c.fillText('NORDIC STUDIO', 300, 242);

    c.fillStyle = '#93c5fd';
    c.font = '600 22px "Inter", sans-serif';
    c.fillText('ARCHITECTURE • DESIGN • INNOVATION', 303, 286);
  }

  return off;
}

// ============================================================================
// 5. DIMENSION & PRICE CALCULATION ENGINE
// ============================================================================
function calculateMetricsAndPrice() {
  // Omregningsfaktor: hele canvas-bredden (900px) svarer til state.wallWidthCm
  const cmPerPixel = state.wallWidthCm / canvas.width;

  const printWidthCm = Math.round(state.artW * cmPerPixel);
  const printHeightCm = Math.round(state.artH * cmPerPixel);
  const areaSqm = Math.max(0.1, (printWidthCm * printHeightCm) / 10000);

  // Beregn tophøjde fra gulvlinjen, medmindre brugeren har overskrevet feltet manuelt
  if (!state.manualTopHeightOverride) {
    const pixelsFromFloorToTop = Math.max(20, state.floorLineY - state.artY);
    state.topHeightCm = Math.round(pixelsFromFloorToTop * cmPerPixel);
    printTopHeightInput.value = state.topHeightCm;
  } else {
    state.topHeightCm = Math.max(50, Number(printTopHeightInput.value) || 210);
  }

  const surfaceKey = surfaceSelect.value;
  const floorKey = floorSelect.value;
  const needsWhiteUnderprint = whiteUnderprintCheckbox.checked;
  const exceedsHeightLimit = state.topHeightCm > PRICING_CONFIG.heightThresholdCm;

  // Prisberegning
  const startupCost = PRICING_CONFIG.startupFee;
  const basePrintCost = Math.round(areaSqm * PRICING_CONFIG.basePricePerSqm);

  const surfaceConfig = PRICING_CONFIG.surfaces[surfaceKey] || PRICING_CONFIG.surfaces.plaster;
  const surfaceCost = Math.round(areaSqm * surfaceConfig.surchargePerSqm);

  const underprintCost = needsWhiteUnderprint
    ? Math.round(areaSqm * PRICING_CONFIG.whiteUnderprintPerSqm)
    : 0;

  const floorConfig = PRICING_CONFIG.floors[floorKey] || PRICING_CONFIG.floors.flat;
  const floorCost = floorConfig.surchargeFixed;

  const heightCost = exceedsHeightLimit ? PRICING_CONFIG.heightSurcharge : 0;

  const totalExclVat = startupCost + basePrintCost + surfaceCost + underprintCost + floorCost + heightCost;
  const totalInclVat = Math.round(totalExclVat * (1 + PRICING_CONFIG.vatRate));

  return {
    printWidthCm,
    printHeightCm,
    areaSqm,
    topHeightCm: state.topHeightCm,
    exceedsHeightLimit,
    surfaceConfig,
    floorConfig,
    needsWhiteUnderprint,
    startupCost,
    basePrintCost,
    surfaceCost,
    underprintCost,
    floorCost,
    heightCost,
    totalExclVat,
    totalInclVat
  };
}

function formatKr(amount) {
  return `${amount.toLocaleString('da-DK')} kr.`;
}

function formatArea(area) {
  return area.toLocaleString('da-DK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function updateUI() {
  const m = calculateMetricsAndPrice();

  // Opdater målbokse under canvas
  readoutWidth.textContent = `${m.printWidthCm} cm`;
  readoutHeight.textContent = `${m.printHeightCm} cm`;
  readoutArea.textContent = `${formatArea(m.areaSqm)} m²`;
  readoutTopHeight.textContent = `${m.topHeightCm} cm`;

  // Vis/skjul advarselsbanner ved højde > 250 cm
  heightWarningBanner.hidden = !m.exceedsHeightLimit;

  // Opdater prislinjer
  priceStartupEl.textContent = formatKr(m.startupCost);
  priceBaseLabelEl.textContent = `Grundpris UV-print (${formatArea(m.areaSqm)} m² × ${PRICING_CONFIG.basePricePerSqm} kr./m²)`;
  priceBaseEl.textContent = formatKr(m.basePrintCost);

  priceSurfaceLabelEl.textContent = `Underlag (${m.surfaceConfig.label})`;
  priceSurfaceEl.textContent = formatKr(m.surfaceCost);

  priceUnderprintRow.hidden = !m.needsWhiteUnderprint;
  priceUnderprintLabelEl.textContent = `Hvidt UV-underprint (${formatArea(m.areaSqm)} m² × ${PRICING_CONFIG.whiteUnderprintPerSqm} kr./m²)`;
  priceUnderprintEl.textContent = formatKr(m.underprintCost);

  priceFloorRow.hidden = m.floorCost === 0;
  priceFloorEl.textContent = formatKr(m.floorCost);

  priceHeightRow.hidden = !m.exceedsHeightLimit;
  priceHeightEl.textContent = formatKr(m.heightCost);

  priceTotalEl.textContent = formatKr(m.totalExclVat);
  priceTotalInclVatEl.textContent = `Inkl. 25 % moms: ${formatKr(m.totalInclVat)}`;

  renderCanvas(m, true);
}

// ============================================================================
// 6. CANVAS RENDERING (WALL + ARTWORK + REAL-TIME DIMENSION OVERLAY)
// ============================================================================
function renderCanvas(metrics = calculateMetricsAndPrice(), showHandles = true) {
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // 1. Tegn vægbaggrund
  if (state.wallPreset === 'custom' && state.customWallImg) {
    drawImageCover(ctx, state.customWallImg, 0, 0, W, H);
  } else {
    const wallBg = getBuiltInWallCanvas(state.wallPreset);
    ctx.drawImage(wallBg, 0, 0);
  }

  // 2. Tegn motiv med valgfri vægstruktur-blend
  if (state.artImg) {
    ctx.save();
    if (state.simulateTexture) {
      ctx.globalAlpha = 0.9;
      ctx.shadowColor = 'rgba(15, 23, 42, 0.14)';
      ctx.shadowBlur = 4;
    } else {
      ctx.globalAlpha = 1.0;
    }
    ctx.drawImage(state.artImg, state.artX, state.artY, state.artW, state.artH);
    ctx.restore();
  }

  // 3. Tegn teknisk målsætning & ramme (kun når showHandles = true eller på snapshot)
  ctx.save();

  // Stiplet markeringsramme omkring motivet
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(state.artX, state.artY, state.artW, state.artH);
  ctx.setLineDash([]);

  // Bredde-målelinje øverst på motivet
  const topLabelY = Math.max(26, state.artY - 14);
  drawDimensionBadge(
    ctx,
    state.artX + state.artW / 2,
    topLabelY,
    `Bredde: ${metrics.printWidthCm} cm  •  Højde: ${metrics.printHeightCm} cm  (${formatArea(metrics.areaSqm)} m²)`
  );

  // Tophøjde-badge nederst på motivet
  const bottomLabelY = Math.min(H - 22, state.artY + state.artH + 22);
  const topBadgeColor = metrics.exceedsHeightLimit ? '#d97706' : '#0f172a';
  drawDimensionBadge(
    ctx,
    state.artX + state.artW / 2,
    bottomLabelY,
    `Tophøjde fra gulv: ${metrics.topHeightCm} cm${metrics.exceedsHeightLimit ? ' (>250 cm mast)' : ''}`,
    topBadgeColor
  );

  // Hjørnehåndtag til interaktiv skalering
  if (showHandles) {
    const corners = getHandlePositions();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2.5;
    corners.forEach(pt => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  }

  ctx.restore();
}

function drawDimensionBadge(context, centerX, centerY, text, bgColor = '#2563eb') {
  context.save();
  context.font = '600 12.5px "Inter", sans-serif';
  const paddingX = 11;
  const textWidth = context.measureText(text).width;
  const boxW = textWidth + paddingX * 2;
  const boxH = 24;
  const clampedX = Math.max(boxW / 2 + 8, Math.min(canvas.width - boxW / 2 - 8, centerX));

  context.fillStyle = bgColor;
  context.beginPath();
  context.roundRect(clampedX - boxW / 2, centerY - boxH / 2, boxW, boxH, 999);
  context.fill();

  context.fillStyle = '#ffffff';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, clampedX, centerY + 0.5);
  context.restore();
}

function drawImageCover(context, img, x, y, w, h) {
  const imgRatio = img.width / img.height;
  const winRatio = w / h;
  let drawW = w;
  let drawH = h;
  let offsetX = x;
  let offsetY = y;

  if (imgRatio > winRatio) {
    drawW = h * imgRatio;
    offsetX = x - (drawW - w) / 2;
  } else {
    drawH = w / imgRatio;
    offsetY = y - (drawH - h) / 2;
  }
  context.drawImage(img, offsetX, offsetY, drawW, drawH);
}

// ============================================================================
// 7. POINTER & TOUCH INTERACTION (DRAG & PROPORTIONAL RESIZE)
// ============================================================================
function getHandlePositions() {
  return [
    { id: 'resize-tl', x: state.artX, y: state.artY },
    { id: 'resize-tr', x: state.artX + state.artW, y: state.artY },
    { id: 'resize-bl', x: state.artX, y: state.artY + state.artH },
    { id: 'resize-br', x: state.artX + state.artW, y: state.artY + state.artH }
  ];
}

function getCanvasCoordinates(evt) {
  const rect = canvas.getBoundingClientRect();
  const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
  const clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;
  return {
    x: ((clientX - rect.left) / rect.width) * canvas.width,
    y: ((clientY - rect.top) / rect.height) * canvas.height
  };
}

function hitTestHandle(px, py) {
  const hitRadius = 16;
  const handles = getHandlePositions();
  for (const h of handles) {
    const dist = Math.hypot(px - h.x, py - h.y);
    if (dist <= hitRadius) return h.id;
  }
  return null;
}

function isInsideArtwork(px, py) {
  return (
    px >= state.artX &&
    px <= state.artX + state.artW &&
    py >= state.artY &&
    py <= state.artY + state.artH
  );
}

function onPointerDown(evt) {
  const pos = getCanvasCoordinates(evt);
  const handle = hitTestHandle(pos.x, pos.y);

  if (handle) {
    state.interactionMode = handle;
  } else if (isInsideArtwork(pos.x, pos.y)) {
    state.interactionMode = 'drag';
  } else {
    return;
  }

  if (evt.cancelable) evt.preventDefault();
  state.manualTopHeightOverride = false;
  state.dragStartX = pos.x;
  state.dragStartY = pos.y;
  state.initialArtX = state.artX;
  state.initialArtY = state.artY;
  state.initialArtW = state.artW;
  state.initialArtH = state.artH;
}

function onPointerMove(evt) {
  const pos = getCanvasCoordinates(evt);

  if (!state.interactionMode) {
    // Opdater musemarkør ved hover over hjørner eller motiv
    const handle = hitTestHandle(pos.x, pos.y);
    if (handle) {
      canvas.style.cursor = 'nwse-resize';
    } else if (isInsideArtwork(pos.x, pos.y)) {
      canvas.style.cursor = 'move';
    } else {
      canvas.style.cursor = 'default';
    }
    return;
  }

  if (evt.cancelable) evt.preventDefault();
  const dx = pos.x - state.dragStartX;
  const dy = pos.y - state.dragStartY;

  if (state.interactionMode === 'drag') {
    state.artX = Math.max(10, Math.min(canvas.width - state.artW - 10, state.initialArtX + dx));
    state.artY = Math.max(10, Math.min(canvas.height - state.artH - 10, state.initialArtY + dy));
  } else if (state.interactionMode.startsWith('resize-')) {
    const signX = state.interactionMode.endsWith('r') ? 1 : -1;
    const newW = Math.max(70, Math.min(canvas.width - 40, state.initialArtW + dx * signX));
    const newH = newW / state.artAspect;

    if (state.interactionMode.endsWith('l')) {
      state.artX = state.initialArtX + (state.initialArtW - newW);
    }
    if (state.interactionMode.startsWith('resize-t')) {
      state.artY = state.initialArtY + (state.initialArtH - newH);
    }

    state.artW = newW;
    state.artH = newH;

    // Synkronisér størrelsesslider
    const pct = Math.round((state.artW / state.baseArtW) * 100);
    scaleSlider.value = Math.max(15, Math.min(220, pct));
    scalePercentLabel.textContent = `${scaleSlider.value}%`;
  }

  updateUI();
}

function onPointerUp() {
  state.interactionMode = null;
}

// Mouse & Touch Event Listeners
canvas.addEventListener('mousedown', onPointerDown);
window.addEventListener('mousemove', onPointerMove);
window.addEventListener('mouseup', onPointerUp);

canvas.addEventListener('touchstart', onPointerDown, { passive: false });
window.addEventListener('touchmove', (e) => {
  if (state.interactionMode) onPointerMove(e);
}, { passive: false });
window.addEventListener('touchend', onPointerUp);

// ============================================================================
// 8. TOOLBAR, UPLOAD & PARAMETER EVENT LISTENERS
// ============================================================================
function loadSampleArtwork(presetName) {
  state.artPreset = presetName;
  state.artImg = createSampleArtworkCanvas(presetName);
  state.artAspect = state.artImg.width / state.artImg.height;
  state.artH = state.artW / state.artAspect;
  updateUI();
}

// Skift mellem indbyggede vægge
wallPresetBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    wallPresetBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.wallPreset = btn.dataset.wallPreset;

    // Foreslå automatisk matchende underlag i prisberegneren
    if (state.wallPreset === 'brick' || state.wallPreset === 'concrete') {
      surfaceSelect.value = 'brick';
    } else if (state.wallPreset === 'plaster') {
      surfaceSelect.value = 'plaster';
    }
    updateUI();
  });
});

// Skift mellem indbyggede motiver
artPresetBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    artPresetBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    loadSampleArtwork(btn.dataset.artPreset);
  });
});

// Upload brugerens eget vægbillede
wallUploadInput.addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      state.customWallImg = img;
      state.wallPreset = 'custom';
      wallPresetBtns.forEach(b => b.classList.remove('active'));
      updateUI();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});

// Upload brugerens eget motiv/logo
artUploadInput.addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      state.artImg = img;
      state.artPreset = 'custom';
      state.artAspect = img.width / img.height;
      state.artH = state.artW / state.artAspect;
      artPresetBtns.forEach(b => b.classList.remove('active'));
      updateUI();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});

// Størrelsesslider
scaleSlider.addEventListener('input', () => {
  const pct = Number(scaleSlider.value);
  scalePercentLabel.textContent = `${pct}%`;

  const centerX = state.artX + state.artW / 2;
  const centerY = state.artY + state.artH / 2;

  state.artW = (state.baseArtW * pct) / 100;
  state.artH = state.artW / state.artAspect;
  state.artX = Math.max(10, Math.min(canvas.width - state.artW - 10, centerX - state.artW / 2));
  state.artY = Math.max(10, Math.min(canvas.height - state.artH - 10, centerY - state.artH / 2));
  state.manualTopHeightOverride = false;
  updateUI();
});

// Vægstruktur-blend toggle
textureBlendToggle.addEventListener('change', () => {
  state.simulateTexture = textureBlendToggle.checked;
  updateUI();
});

// Centrer motiv på væggen
centerArtworkBtn.addEventListener('click', () => {
  state.artX = (canvas.width - state.artW) / 2;
  state.artY = (state.floorLineY - state.artH) / 2;
  state.manualTopHeightOverride = false;
  updateUI();
});

// Kalibrering og tekniske parametre
wallWidthInput.addEventListener('input', () => {
  const val = Number(wallWidthInput.value);
  if (val >= 50 && val <= 3000) {
    state.wallWidthCm = val;
    updateUI();
  }
});

printTopHeightInput.addEventListener('input', () => {
  state.manualTopHeightOverride = true;
  updateUI();
});

surfaceSelect.addEventListener('change', updateUI);
floorSelect.addEventListener('change', updateUI);
whiteUnderprintCheckbox.addEventListener('change', updateUI);

// ============================================================================
// 9. LEAD CAPTURE MODAL & PNG MOCKUP SNAPSHOT
// ============================================================================
function openLeadModal() {
  const m = calculateMetricsAndPrice();

  // Generér rent PNG-snapshot af væg-designet
  renderCanvas(m, false);
  const dataUrl = canvas.toDataURL('image/png');
  renderCanvas(m, true);

  modalSnapshotImg.src = dataUrl;
  downloadSnapshotLink.href = dataUrl;

  // Udfyld specifikationsresumé i modalen
  summaryDimensionsEl.textContent = `${m.printWidthCm} × ${m.printHeightCm} cm (${formatArea(m.areaSqm)} m²)`;
  summaryTopHeightEl.textContent = `${m.topHeightCm} cm${m.exceedsHeightLimit ? ' (Inkl. højdetillæg)' : ''}`;
  summarySurfaceEl.textContent = m.surfaceConfig.label;
  summaryFloorEl.textContent = m.floorConfig.label;
  summaryUnderprintEl.textContent = m.needsWhiteUnderprint ? 'Ja (+120 kr./m²)' : 'Nej';
  summaryPriceEl.textContent = `${formatKr(m.totalExclVat)} (Inkl. moms: ${formatKr(m.totalInclVat)})`;

  leadSuccessMessage.hidden = true;
  leadModal.hidden = false;
}

function closeLeadModal() {
  leadModal.hidden = true;
}

openLeadModalBtn.addEventListener('click', openLeadModal);
closeLeadModalBtn.addEventListener('click', closeLeadModal);

leadModal.addEventListener('click', (e) => {
  if (e.target === leadModal) closeLeadModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !leadModal.hidden) closeLeadModal();
});

leadForm.addEventListener('submit', (e) => {
  e.preventDefault();
  leadSuccessMessage.hidden = false;
  leadForm.reset();
});

// ============================================================================
// 10. INITIALIZATION
// ============================================================================
loadSampleArtwork('nordic');
