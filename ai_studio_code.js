/**
 * AETHERIS SMART GRID // CLIENT CONTROLLER & SIMULATION ENGINE
 * Pure Vanilla ES6+ JavaScript - Zero Dependencies
 */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  // =========================================================================
  // STATE MANAGEMENT
  // =========================================================================
  const state = {
    solarCapMW: 650,
    windCapMW: 500,
    fossilRatioPct: 35,
    demandMultiplierPct: 100,
    currentTheme: 'dark',
    tableSortCol: 'hour',
    tableSortAsc: true,
    tableSearchQuery: '',
    simulationActive: false,
    hoveredHourIndex: null,
    // Diurnal 24-hour capacity factors
    solarCurveFactor: [
      0.0, 0.0, 0.0, 0.0, 0.0, 0.05, 0.22, 0.50, 0.76, 0.92, 1.0, 0.98,
      0.95, 0.88, 0.72, 0.52, 0.28, 0.08, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0
    ],
    windCurveFactor: [
      0.75, 0.80, 0.84, 0.82, 0.78, 0.70, 0.62, 0.55, 0.48, 0.45, 0.50, 0.55,
      0.58, 0.62, 0.68, 0.75, 0.82, 0.88, 0.92, 0.90, 0.85, 0.80, 0.76, 0.72
    ],
    baseDemandMW: [
      480, 440, 420, 410, 430, 520, 680, 820, 910, 940, 920, 890,
      870, 860, 880, 920, 980, 1040, 1060, 1020, 960, 870, 720, 580
    ],
    hourlyData: [],
    kpiValues: {
      energy: 0,
      co2: 0,
      stability: 0,
      cost: 0
    }
  };

  // Presets definition
  const PRESETS = {
    eco: {
      solar: 1100,
      wind: 900,
      fossil: 10,
      demand: 100,
      label: 'Eco-Maximalist'
    },
    balanced: {
      solar: 650,
      wind: 500,
      fossil: 35,
      demand: 100,
      label: 'Balanced Grid'
    },
    peak: {
      solar: 400,
      wind: 350,
      fossil: 80,
      demand: 125,
      label: 'Peak Load Survival'
    }
  };

  // =========================================================================
  // DOM ELEMENT REFERENCES
  // =========================================================================
  const elements = {
    // Inputs & Sliders
    solarSlider: document.getElementById('solarSlider'),
    solarInput: document.getElementById('solarInput'),
    windSlider: document.getElementById('windSlider'),
    windInput: document.getElementById('windInput'),
    fossilSlider: document.getElementById('fossilSlider'),
    fossilInput: document.getElementById('fossilInput'),
    demandSlider: document.getElementById('demandSlider'),
    demandInput: document.getElementById('demandInput'),

    // Preset Badges & Buttons
    presetBadge: document.getElementById('currentPresetBadge'),
    presetEcoBtn: document.getElementById('presetEcoBtn'),
    presetBalancedBtn: document.getElementById('presetBalancedBtn'),
    presetPeakBtn: document.getElementById('presetPeakBtn'),

    // Action Buttons
    runSimBtn: document.getElementById('runSimBtn'),
    resetBtn: document.getElementById('resetBtn'),

    // Theme & Live Clock
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    themeIconSun: document.getElementById('themeIconSun'),
    themeIconMoon: document.getElementById('themeIconMoon'),
    liveClock: document.getElementById('liveClock'),
    gridFreq: document.getElementById('gridFreq'),

    // KPIs
    valTotalEnergy: document.getElementById('valTotalEnergy'),
    valCO2Offset: document.getElementById('valCO2Offset'),
    valGridStability: document.getElementById('valGridStability'),
    valCostPerKWh: document.getElementById('valCostPerKWh'),
    stabilityPill: document.getElementById('stabilityPill'),
    stabilityIcon: document.getElementById('stabilityIcon'),
    stabilityText: document.getElementById('stabilityText'),
    co2Subtext: document.getElementById('co2Subtext'),

    // Canvas & Tooltip
    canvasViewport: document.getElementById('canvasViewport'),
    canvas: document.getElementById('gridCanvas'),
    tooltip: document.getElementById('chartTooltip'),

    // Meter Segments
    segSolar: document.getElementById('segSolar'),
    segWind: document.getElementById('segWind'),
    segFossil: document.getElementById('segFossil'),
    meterSolarPct: document.getElementById('meterSolarPct'),
    meterWindPct: document.getElementById('meterWindPct'),
    meterFossilPct: document.getElementById('meterFossilPct'),

    // Table
    tableBody: document.getElementById('tableBody'),
    tableRowCount: document.getElementById('tableRowCount'),
    statusSearchInput: document.getElementById('statusSearchInput'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    exportCsvBtn: document.getElementById('exportCsvBtn'),
    tableHeaders: document.querySelectorAll('#gridDataTable th.sortable')
  };

  const ctx = elements.canvas.getContext('2d');

  // =========================================================================
  // DEFENSIVE MATH VALIDATORS
  // =========================================================================
  function safeVal(val, defaultVal = 0) {
    if (typeof val !== 'number' || isNaN(val) || !isFinite(val)) {
      return defaultVal;
    }
    return val;
  }

  function clamp(val, min, max) {
    return Math.min(Math.max(safeVal(val), min), max);
  }

  // =========================================================================
  // CLOCK & TELEMETRY HEARTBEAT
  // =========================================================================
  function updateLiveClock() {
    const now = new Date();
    const utcHours = String(now.getUTCHours()).padStart(2, '0');
    const utcMinutes = String(now.getUTCMinutes()).padStart(2, '0');
    const utcSeconds = String(now.getUTCSeconds()).padStart(2, '0');
    elements.liveClock.textContent = `${utcHours}:${utcMinutes}:${utcSeconds} UTC`;

    // Realistic micro-jitter in Grid Frequency around 60.00 Hz
    const jitter = (Math.random() - 0.5) * 0.04;
    const freq = (60.00 + jitter).toFixed(2);
    elements.gridFreq.textContent = `${freq} Hz`;
  }
  setInterval(updateLiveClock, 1000);
  updateLiveClock();

  // =========================================================================
  // THEME TOGGLE
  // =========================================================================
  elements.themeToggleBtn.addEventListener('click', () => {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') !== 'light';
    const nextTheme = isDark ? 'light' : 'dark';
    html.setAttribute('data-theme', nextTheme);
    state.currentTheme = nextTheme;

    if (nextTheme === 'light') {
      elements.themeIconSun.classList.add('hidden');
      elements.themeIconMoon.classList.remove('hidden');
    } else {
      elements.themeIconSun.classList.remove('hidden');
      elements.themeIconMoon.classList.add('hidden');
    }
    renderCanvasChart();
  });

  // =========================================================================
  // INPUT PAIR SYNCHRONIZATION
  // =========================================================================
  function bindSliderInputPair(slider, input, stateKey, min, max) {
    const sync = (value) => {
      let numeric = parseFloat(value);
      if (isNaN(numeric)) numeric = min;
      numeric = clamp(numeric, min, max);

      slider.value = numeric;
      input.value = numeric;
      state[stateKey] = numeric;

      // Update custom visual range track gradient
      const percent = ((numeric - min) / (max - min)) * 100;
      slider.style.background = `linear-gradient(to right, rgba(59, 130, 246, 0.8) 0%, rgba(59, 130, 246, 0.8) ${percent}%, rgba(255, 255, 255, 0.12) ${percent}%, rgba(255, 255, 255, 0.12) 100%)`;

      detectActivePreset();
      recalculateAll();
    };

    slider.addEventListener('input', (e) => sync(e.target.value));
    input.addEventListener('input', (e) => sync(e.target.value));
    input.addEventListener('blur', (e) => sync(e.target.value));
    sync(slider.value);
  }

  bindSliderInputPair(elements.solarSlider, elements.solarInput, 'solarCapMW', 0, 1500);
  bindSliderInputPair(elements.windSlider, elements.windInput, 'windCapMW', 0, 1200);
  bindSliderInputPair(elements.fossilSlider, elements.fossilInput, 'fossilRatioPct', 0, 100);
  bindSliderInputPair(elements.demandSlider, elements.demandInput, 'demandMultiplierPct', 50, 150);

  // =========================================================================
  // STRATEGY PRESETS
  // =========================================================================
  function applyPreset(presetKey) {
    const p = PRESETS[presetKey];
    if (!p) return;

    elements.solarSlider.value = p.solar;
    elements.solarInput.value = p.solar;
    state.solarCapMW = p.solar;

    elements.windSlider.value = p.wind;
    elements.windInput.value = p.wind;
    state.windCapMW = p.wind;

    elements.fossilSlider.value = p.fossil;
    elements.fossilInput.value = p.fossil;
    state.fossilRatioPct = p.fossil;

    elements.demandSlider.value = p.demand;
    elements.demandInput.value = p.demand;
    state.demandMultiplierPct = p.demand;

    // Synchronize UI track visuals
    [
      { s: elements.solarSlider, min: 0, max: 1500, val: p.solar },
      { s: elements.windSlider, min: 0, max: 1200, val: p.wind },
      { s: elements.fossilSlider, min: 0, max: 100, val: p.fossil },
      { s: elements.demandSlider, min: 50, max: 150, val: p.demand }
    ].forEach(item => {
      const pct = ((item.val - item.min) / (item.max - item.min)) * 100;
      item.s.style.background = `linear-gradient(to right, rgba(59, 130, 246, 0.8) 0%, rgba(59, 130, 246, 0.8) ${pct}%, rgba(255, 255, 255, 0.12) ${pct}%, rgba(255, 255, 255, 0.12) 100%)`;
    });

    setActivePresetButton(presetKey, p.label);
    recalculateAll();
  }

  function setActivePresetButton(activeKey, label) {
    [elements.presetEcoBtn, elements.presetBalancedBtn, elements.presetPeakBtn].forEach(btn => {
      if (btn.dataset.preset === activeKey) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    elements.presetBadge.textContent = label;
  }

  function detectActivePreset() {
    let matchedKey = 'custom';
    let matchedLabel = 'Custom Config';

    for (const [key, p] of Object.entries(PRESETS)) {
      if (
        state.solarCapMW === p.solar &&
        state.windCapMW === p.wind &&
        state.fossilRatioPct === p.fossil &&
        state.demandMultiplierPct === p.demand
      ) {
        matchedKey = key;
        matchedLabel = p.label;
        break;
      }
    }

    [elements.presetEcoBtn, elements.presetBalancedBtn, elements.presetPeakBtn].forEach(btn => {
      if (btn.dataset.preset === matchedKey) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    elements.presetBadge.textContent = matchedLabel;
  }

  elements.presetEcoBtn.addEventListener('click', () => applyPreset('eco'));
  elements.presetBalancedBtn.addEventListener('click', () => applyPreset('balanced'));
  elements.presetPeakBtn.addEventListener('click', () => applyPreset('peak'));

  // =========================================================================
  // ACTIONS: SIMULATION RUN & RESET
  // =========================================================================
  elements.resetBtn.addEventListener('click', () => {
    applyPreset('balanced');
  });

  let simSweepHour = 0;

  elements.runSimBtn.addEventListener('click', () => {
    if (state.simulationActive) return;
    state.simulationActive = true;
    simSweepHour = 0;
    elements.runSimBtn.disabled = true;
    elements.runSimBtn.innerHTML = `
      <svg class="btn-svg" viewBox="0 0 24 24" style="animation: spin 1s linear infinite;">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" stroke-dasharray="30 60"/>
      </svg>
      <span>Simulating 24h Cycle...</span>
    `;

    const sweepInterval = setInterval(() => {
      if (simSweepHour < 24) {
        state.hoveredHourIndex = simSweepHour;
        renderCanvasChart();
        highlightTableRow(simSweepHour);
        simSweepHour++;
      } else {
        clearInterval(sweepInterval);
        state.hoveredHourIndex = null;
        state.simulationActive = false;
        elements.runSimBtn.disabled = false;
        elements.runSimBtn.innerHTML = `
          <svg viewBox="0 0 24 24" class="btn-svg" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          <span>Run Grid Simulation</span>
        `;
        renderCanvasChart();
        unhighlightTableRows();
      }
    }, 110);
  });

  function highlightTableRow(hour) {
    const rows = elements.tableBody.querySelectorAll('tr');
    rows.forEach(r => {
      if (parseInt(r.dataset.hourIndex, 10) === hour) {
        r.style.backgroundColor = 'rgba(59, 130, 246, 0.28)';
        r.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        r.style.backgroundColor = '';
      }
    });
  }

  function unhighlightTableRows() {
    const rows = elements.tableBody.querySelectorAll('tr');
    rows.forEach(r => r.style.backgroundColor = '');
  }

  // =========================================================================
  // REAL-TIME CALCULATION ENGINE
  // =========================================================================
  function recalculateAll() {
    const demandScale = safeVal(state.demandMultiplierPct) / 100;
    const maxFossilCapacityMW = 900;
    const activeFossilMW = safeVal(maxFossilCapacityMW * (state.fossilRatioPct / 100));

    let sumTotalSupplyMWh = 0;
    let sumDemandMWh = 0;
    let sumSolarMWh = 0;
    let sumWindMWh = 0;
    let sumFossilMWh = 0;
    let sumStability = 0;

    const hourly = [];

    for (let h = 0; h < 24; h++) {
      const solarMW = safeVal(state.solarCapMW * state.solarCurveFactor[h]);
      const windMW = safeVal(state.windCapMW * state.windCurveFactor[h]);
      const fossilMW = activeFossilMW;
      const supplyMW = safeVal(solarMW + windMW + fossilMW);
      const demandMW = safeVal(state.baseDemandMW[h] * demandScale);
      const netBalanceMW = safeVal(supplyMW - demandMW);

      // Formula: Grid Stability = 100 - |(Supply - Demand) / Demand * 100|
      let stabilityPct = 100;
      if (demandMW > 0) {
        const devPct = Math.abs((supplyMW - demandMW) / demandMW) * 100;
        stabilityPct = 100 - devPct;
      }
      stabilityPct = clamp(stabilityPct, 0, 100);

      // Status classification
      let status = 'Optimal';
      let statusClass = 'status-optimal';
      if (netBalanceMW > 120) {
        status = 'Surplus';
        statusClass = 'status-surplus';
      } else if (netBalanceMW >= -30 && netBalanceMW <= 120) {
        status = 'Optimal';
        statusClass = 'status-optimal';
      } else if (netBalanceMW >= -120 && netBalanceMW < -30) {
        status = 'Deficit';
        statusClass = 'status-deficit';
      } else {
        status = 'Critical';
        statusClass = 'status-critical';
      }

      hourly.push({
        hour: h,
        hourLabel: `${String(h).padStart(2, '0')}:00`,
        solar: solarMW,
        wind: windMW,
        fossil: fossilMW,
        supply: supplyMW,
        demand: demandMW,
        net: netBalanceMW,
        stability: stabilityPct,
        status: status,
        statusClass: statusClass
      });

      sumTotalSupplyMWh += supplyMW;
      sumDemandMWh += demandMW;
      sumSolarMWh += solarMW;
      sumWindMWh += windMW;
      sumFossilMWh += fossilMW;
      sumStability += stabilityPct;
    }

    state.hourlyData = hourly;

    // Daily KPIs calculation
    // CO2 Offset = (Solar MW * 0.85) + (Wind MW * 0.92) - (Fossil MW * 0.45)
    const avgSolarMW = sumSolarMWh / 24;
    const avgWindMW = sumWindMWh / 24;
    const avgFossilMW = sumFossilMWh / 24;
    let netCO2Tons = (avgSolarMW * 0.85) + (avgWindMW * 0.92) - (avgFossilMW * 0.45);
    netCO2Tons = safeVal(netCO2Tons * 24 * 0.05); // Scaling factor to 24h tonnage
    if (netCO2Tons < 0) netCO2Tons = 0;

    const avgStabilityPct = safeVal(sumStability / 24);

    // Blended Levelized Cost per kWh:
    // Solar ~$0.032/kWh, Wind ~$0.042/kWh, Fossil ~$0.155/kWh
    let blendedCost = 0.08;
    if (sumTotalSupplyMWh > 0) {
      blendedCost = ((sumSolarMWh * 0.032) + (sumWindMWh * 0.042) + (sumFossilMWh * 0.155)) / sumTotalSupplyMWh;
    }
    if (avgStabilityPct < 90) {
      blendedCost += (90 - avgStabilityPct) * 0.0015;
    }
    blendedCost = safeVal(blendedCost, 0.08);

    // Animate KPI metric updates
    animateValue(elements.valTotalEnergy, state.kpiValues.energy, Math.round(sumTotalSupplyMWh), 400, (v) => v.toLocaleString());
    animateValue(elements.valCO2Offset, state.kpiValues.co2, Math.round(netCO2Tons), 400, (v) => v.toLocaleString());
    animateValue(elements.valGridStability, state.kpiValues.stability, Math.round(avgStabilityPct), 400, (v) => v.toString());
    animateValue(elements.valCostPerKWh, state.kpiValues.cost, blendedCost, 400, (v) => v.toFixed(3));

    state.kpiValues.energy = Math.round(sumTotalSupplyMWh);
    state.kpiValues.co2 = Math.round(netCO2Tons);
    state.kpiValues.stability = Math.round(avgStabilityPct);
    state.kpiValues.cost = blendedCost;

    // Stability Badge state styling
    updateStabilityCard(avgStabilityPct);

    // Allocation Meter updates
    updateAllocationMeter(sumSolarMWh, sumWindMWh, sumFossilMWh);

    // Visual renders
    renderCanvasChart();
    renderTable();
  }

  function updateStabilityCard(stability) {
    if (stability >= 92) {
      elements.stabilityIcon.style.color = 'var(--accent-success)';
      elements.stabilityText.textContent = 'Nominal / Sync Locked';
      elements.stabilityPill.className = 'kpi-icon-pill icon-green';
    } else if (stability >= 80) {
      elements.stabilityIcon.style.color = 'var(--accent-warning)';
      elements.stabilityText.textContent = 'Moderate Fluctuation';
      elements.stabilityPill.className = 'kpi-icon-pill icon-amber';
    } else {
      elements.stabilityIcon.style.color = 'var(--accent-danger)';
      elements.stabilityText.textContent = 'Grid Frequency Alert';
      elements.stabilityPill.className = 'kpi-icon-pill icon-purple';
    }
  }

  function updateAllocationMeter(solarMWh, windMWh, fossilMWh) {
    const total = solarMWh + windMWh + fossilMWh;
    if (total <= 0) return;

    const sPct = safeVal((solarMWh / total) * 100);
    const wPct = safeVal((windMWh / total) * 100);
    const fPct = safeVal((fossilMWh / total) * 100);

    elements.segSolar.style.width = `${sPct.toFixed(1)}%`;
    elements.segWind.style.width = `${wPct.toFixed(1)}%`;
    elements.segFossil.style.width = `${fPct.toFixed(1)}%`;

    elements.meterSolarPct.textContent = `${Math.round(sPct)}%`;
    elements.meterWindPct.textContent = `${Math.round(wPct)}%`;
    elements.meterFossilPct.textContent = `${Math.round(fPct)}%`;
  }

  // =========================================================================
  // SMOOTH NUMBER COUNT-UP ANIMATION
  // =========================================================================
  function animateValue(elem, start, end, duration, formatter) {
    start = safeVal(start);
    end = safeVal(end);
    if (start === end) {
      elem.textContent = formatter(end);
      return;
    }
    const startTime = performance.now();

    function step(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = start + (end - start) * ease;
      elem.textContent = formatter(safeVal(current));

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        elem.textContent = formatter(end);
      }
    }
    requestAnimationFrame(step);
  }

  // =========================================================================
  // NATIVE HTML5 CANVAS ENGINE
  // =========================================================================
  function resizeCanvas() {
    const rect = elements.canvasViewport.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    elements.canvas.width = rect.width * dpr;
    elements.canvas.height = rect.height * dpr;
    ctx.resetTransform?.();
    ctx.scale(dpr, dpr);
    renderCanvasChart();
  }
  window.addEventListener('resize', resizeCanvas);

  function renderCanvasChart() {
    const rect = elements.canvasViewport.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    if (width === 0 || height === 0) return;

    ctx.clearRect(0, 0, width, height);

    const padding = { top: 30, right: 35, bottom: 42, left: 55 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const data = state.hourlyData;
    if (!data || data.length === 0) return;

    // Find dynamic maximum MW scale
    let maxMW = 0;
    data.forEach(d => {
      if (d.supply > maxMW) maxMW = d.supply;
      if (d.demand > maxMW) maxMW = d.demand;
    });
    maxMW = Math.max(maxMW * 1.15, 1200);

    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const gridLineColor = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.06)';
    const textAxisColor = isLight ? '#64748B' : '#64748B';

    // 1. Draw Horizontal Grid Lines & Y-Axis Labels
    const ySegments = 5;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.font = '10px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = textAxisColor;

    for (let i = 0; i <= ySegments; i++) {
      const yVal = (maxMW / ySegments) * i;
      const yPos = padding.top + chartH - (yVal / maxMW) * chartH;

      ctx.strokeStyle = gridLineColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padding.left, yPos);
      ctx.lineTo(padding.left + chartW, yPos);
      ctx.stroke();

      ctx.fillText(`${Math.round(yVal)} MW`, padding.left - 8, yPos);
    }

    // 2. Draw Vertical Grid Lines & X-Axis Labels (Every 3 hours)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const xStep = chartW / 23;

    for (let h = 0; h < 24; h++) {
      const xPos = padding.left + h * xStep;

      if (h % 3 === 0 || h === 23) {
        ctx.strokeStyle = gridLineColor;
        ctx.beginPath();
        ctx.moveTo(xPos, padding.top);
        ctx.lineTo(xPos, padding.top + chartH);
        ctx.stroke();

        ctx.fillText(`${String(h).padStart(2, '0')}:00`, xPos, padding.top + chartH + 10);
      }
    }

    // Coordinate mapping functions
    const getX = (hour) => padding.left + hour * xStep;
    const getY = (val) => padding.top + chartH - (clamp(val, 0, maxMW) / maxMW) * chartH;

    // 3. Draw Supply Area Gradient Fill
    const supplyGrad = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
    if (isLight) {
      supplyGrad.addColorStop(0, 'rgba(59, 130, 246, 0.28)');
      supplyGrad.addColorStop(1, 'rgba(59, 130, 246, 0.01)');
    } else {
      supplyGrad.addColorStop(0, 'rgba(59, 130, 246, 0.35)');
      supplyGrad.addColorStop(1, 'rgba(59, 130, 246, 0.02)');
    }

    ctx.beginPath();
    ctx.moveTo(getX(0), getY(data[0].supply));
    for (let i = 0; i < 23; i++) {
      const currX = getX(i);
      const currY = getY(data[i].supply);
      const nextX = getX(i + 1);
      const nextY = getY(data[i + 1].supply);
      const midX = (currX + nextX) / 2;
      ctx.bezierCurveTo(midX, currY, midX, nextY, nextX, nextY);
    }
    ctx.lineTo(getX(23), padding.top + chartH);
    ctx.lineTo(getX(0), padding.top + chartH);
    ctx.closePath();
    ctx.fillStyle = supplyGrad;
    ctx.fill();

    // 4. Draw Supply Curve Smooth Stroke
    ctx.beginPath();
    ctx.moveTo(getX(0), getY(data[0].supply));
    for (let i = 0; i < 23; i++) {
      const currX = getX(i);
      const currY = getY(data[i].supply);
      const nextX = getX(i + 1);
      const nextY = getY(data[i + 1].supply);
      const midX = (currX + nextX) / 2;
      ctx.bezierCurveTo(midX, currY, midX, nextY, nextX, nextY);
    }
    ctx.strokeStyle = '#3B82F6';
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(59, 130, 246, 0.5)';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 5. Draw Demand Curve Stroke (Dashed Warning Accent)
    ctx.beginPath();
    ctx.moveTo(getX(0), getY(data[0].demand));
    for (let i = 0; i < 23; i++) {
      const currX = getX(i);
      const currY = getY(data[i].demand);
      const nextX = getX(i + 1);
      const nextY = getY(data[i + 1].demand);
      const midX = (currX + nextX) / 2;
      ctx.bezierCurveTo(midX, currY, midX, nextY, nextX, nextY);
    }
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([5, 4]);
    ctx.shadowColor = 'rgba(239, 68, 68, 0.4)';
    ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;

    // 6. Draw Hover / Simulation Active Cursor
    if (state.hoveredHourIndex !== null && state.hoveredHourIndex >= 0 && state.hoveredHourIndex < 24) {
      const idx = state.hoveredHourIndex;
      const hData = data[idx];
      const hX = getX(idx);
      const supplyY = getY(hData.supply);
      const demandY = getY(hData.demand);

      // Vertical guide bar
      ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(hX, padding.top);
      ctx.lineTo(hX, padding.top + chartH);
      ctx.stroke();
      ctx.setLineDash([]);

      // Supply point circle
      ctx.fillStyle = '#3B82F6';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(hX, supplyY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Demand point circle
      ctx.fillStyle = '#EF4444';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(hX, demandY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Position Tooltip
      updateTooltip(idx, hX, Math.min(supplyY, demandY));
    } else {
      elements.tooltip.style.opacity = '0';
    }
  }

  // Canvas Hover Event Handlers
  elements.canvas.addEventListener('mousemove', (e) => {
    const rect = elements.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const padding = { top: 30, right: 35, bottom: 42, left: 55 };
    const chartW = rect.width - padding.left - padding.right;

    if (mouseX >= padding.left && mouseX <= padding.left + chartW) {
      const relativeX = mouseX - padding.left;
      const xStep = chartW / 23;
      const hourIndex = clamp(Math.round(relativeX / xStep), 0, 23);
      state.hoveredHourIndex = hourIndex;
      renderCanvasChart();
    } else {
      state.hoveredHourIndex = null;
      renderCanvasChart();
    }
  });

  elements.canvas.addEventListener('mouseleave', () => {
    if (!state.simulationActive) {
      state.hoveredHourIndex = null;
      renderCanvasChart();
    }
  });

  function updateTooltip(hourIdx, pointX, pointY) {
    const item = state.hourlyData[hourIdx];
    if (!item) return;

    const netSign = item.net >= 0 ? '+' : '';
    const netColor = item.net >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)';

    elements.tooltip.innerHTML = `
      <div class="tt-header">Hour ${item.hourLabel}</div>
      <div class="tt-row">
        <span>Supply:</span>
        <strong>${Math.round(item.supply)} MW</strong>
      </div>
      <div class="tt-row">
        <span>Demand:</span>
        <strong style="color: #EF4444;">${Math.round(item.demand)} MW</strong>
      </div>
      <div class="tt-row">
        <span>Net Margin:</span>
        <strong style="color: ${netColor};">${netSign}${Math.round(item.net)} MW</strong>
      </div>
      <div class="tt-row">
        <span>Stability:</span>
        <strong>${Math.round(item.stability)}%</strong>
      </div>
      <div class="tt-row" style="margin-top: 4px; padding-top: 4px; border-top: 1px solid rgba(255,255,255,0.1);">
        <span>Status:</span>
        <span class="status-badge ${item.statusClass}">${item.status}</span>
      </div>
    `;

    const rect = elements.canvasViewport.getBoundingClientRect();
    let left = pointX + 15;
    let top = pointY - 20;

    if (left + 160 > rect.width) {
      left = pointX - 165;
    }
    if (top < 10) {
      top = 10;
    }
    if (top + 140 > rect.height) {
      top = rect.height - 145;
    }

    elements.tooltip.style.left = `${left}px`;
    elements.tooltip.style.top = `${top}px`;
    elements.tooltip.style.opacity = '1';
  }

  // =========================================================================
  // DETAILED BREAKDOWN TABLE, SORTING & FILTERING
  // =========================================================================
  function renderTable() {
    let rows = [...state.hourlyData];

    // Filter query
    if (state.tableSearchQuery.trim() !== '') {
      const q = state.tableSearchQuery.trim().toLowerCase();
      rows = rows.filter(r => {
        return (
          r.status.toLowerCase().includes(q) ||
          r.hourLabel.toLowerCase().includes(q) ||
          String(r.hour).includes(q)
        );
      });
    }

    // Sort column
    const col = state.tableSortCol;
    const isAsc = state.tableSortAsc;

    rows.sort((a, b) => {
      let valA = a[col];
      let valB = b[col];

      if (typeof valA === 'string') {
        return isAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return isAsc ? valA - valB : valB - valA;
    });

    elements.tableRowCount.textContent = `Showing ${rows.length} of 24 hours`;

    if (rows.length === 0) {
      elements.tableBody.innerHTML = `
        <tr class="table-empty-row">
          <td colspan="9">No records match the filter criteria "${state.tableSearchQuery}"</td>
        </tr>
      `;
      return;
    }

    const html = rows.map(r => {
      const netSign = r.net >= 0 ? '+' : '';
      const netClass = r.net > 0 ? 'val-positive' : (r.net < 0 ? 'val-negative' : 'val-neutral');

      return `
        <tr data-hour-index="${r.hour}">
          <td><strong>${r.hourLabel}</strong></td>
          <td>${Math.round(r.solar)}</td>
          <td>${Math.round(r.wind)}</td>
          <td>${Math.round(r.fossil)}</td>
          <td><strong>${Math.round(r.supply)}</strong></td>
          <td>${Math.round(r.demand)}</td>
          <td class="${netClass}">${netSign}${Math.round(r.net)}</td>
          <td>${Math.round(r.stability)}%</td>
          <td><span class="status-badge ${r.statusClass}">${r.status}</span></td>
        </tr>
      `;
    }).join('');

    elements.tableBody.innerHTML = html;
  }

  // Column Header Sorting Click Handlers
  elements.tableHeaders.forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (state.tableSortCol === col) {
        state.tableSortAsc = !state.tableSortAsc;
      } else {
        state.tableSortCol = col;
        state.tableSortAsc = true;
      }

      elements.tableHeaders.forEach(h => {
        h.classList.remove('sorted-asc', 'sorted-desc');
        const arrow = h.querySelector('.sort-arrow');
        if (arrow) arrow.textContent = '↕';
      });

      th.classList.add(state.tableSortAsc ? 'sorted-asc' : 'sorted-desc');
      const activeArrow = th.querySelector('.sort-arrow');
      if (activeArrow) {
        activeArrow.textContent = state.tableSortAsc ? '↑' : '↓';
      }

      renderTable();
    });
  });

  // Table Search Filter
  elements.statusSearchInput.addEventListener('input', (e) => {
    state.tableSearchQuery = e.target.value;
    if (state.tableSearchQuery) {
      elements.clearSearchBtn.classList.add('visible');
    } else {
      elements.clearSearchBtn.classList.remove('visible');
    }
    renderTable();
  });

  elements.clearSearchBtn.addEventListener('click', () => {
    elements.statusSearchInput.value = '';
    state.tableSearchQuery = '';
    elements.clearSearchBtn.classList.remove('visible');
    renderTable();
  });

  // Export CSV Handler
  elements.exportCsvBtn.addEventListener('click', () => {
    const headers = ['Hour', 'Solar_MW', 'Wind_MW', 'Fossil_MW', 'TotalSupply_MW', 'Demand_MW', 'NetBalance_MW', 'Stability_Pct', 'Status'];
    const csvRows = [headers.join(',')];

    state.hourlyData.forEach(r => {
      const row = [
        r.hourLabel,
        Math.round(r.solar),
        Math.round(r.wind),
        Math.round(r.fossil),
        Math.round(r.supply),
        Math.round(r.demand),
        Math.round(r.net),
        Math.round(r.stability),
        r.status
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvRows.join('\n'));
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', `aethergrid_metrics_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  // Initial Boot & Scaling
  setTimeout(() => {
    resizeCanvas();
    recalculateAll();
  }, 50);
});