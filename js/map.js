/**
 * WebGIS Tutupan Pesisir Barru-Pangkep
 * map.js – MapLibre GL JS map logic
 */

'use strict';

// ============================================================
// CONSTANTS
// ============================================================
const BOUNDS = [[119.52, -4.67], [119.64, -4.48]]; // [SW, NE]
const DATA_URLS = {
  batas: 'data/batas_studi.geojson',
  k2020: 'data/klasifikasi_2020.geojson',
  k2025: 'data/klasifikasi_2025.geojson',
};
const FALLBACK_IMG = 'media/peta_2020_2025.png';

const KELAS = {
  1: { label: 'Kandidat mangrove',           color: '#176443' },
  2: { label: 'Vegetasi lain',               color: '#9dc477' },
  3: { label: 'Tambak / perairan terbuka',   color: '#83bbd2' },
  4: { label: 'Terbangun / tanah terbuka',   color: '#d4a477' },
};

// Color expression for MapLibre
const COLOR_EXPR = [
  'match', ['get', 'kelas'],
  1, '#176443',
  2, '#9dc477',
  3, '#83bbd2',
  4, '#d4a477',
  'transparent'
];

const INITIAL_YEAR = '2020';

// ============================================================
// STATE
// ============================================================
let currentYear = INITIAL_YEAR;
let currentMode = 'single'; // 'single' | 'sbs' | 'swipe'
let loaded = { batas: false, '2020': false, '2025': false };
let mapSingle = null, mapLeft = null, mapRight = null;
let swipeDragging = false;
let swipePos = 50; // percent
let popup = null;

// ============================================================
// UTILS
// ============================================================
function showToast(msg, duration = 3000) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

function setLoading(show, text = 'Memuat data peta…', progress = '') {
  const overlay = document.getElementById('map-loading');
  if (!overlay) return;
  overlay.classList.toggle('hidden', !show);
  const lt = overlay.querySelector('.loading-text');
  const lp = overlay.querySelector('.loading-progress');
  if (lt) lt.textContent = text;
  if (lp) lp.textContent = progress;
}

function showError(msg) {
  const el = document.getElementById('map-error');
  if (!el) return;
  el.classList.add('visible');
  const em = el.querySelector('.error-msg');
  if (em) em.textContent = msg;
}

function hideError() {
  const el = document.getElementById('map-error');
  if (el) el.classList.remove('visible');
}

// ============================================================
// FETCH WITH PROGRESS (approximate)
// ============================================================
async function fetchGeoJSON(url, onProgress) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} – ${url}`);

  const contentLength = response.headers.get('content-length');
  const total = contentLength ? parseInt(contentLength, 10) : 0;

  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (total && onProgress) {
      onProgress(Math.round((received / total) * 100));
    }
  }

  const blob = new Blob(chunks);
  const text = await blob.text();
  return JSON.parse(text);
}

// ============================================================
// MAP STYLE (blank dark)
// ============================================================
function makeStyle() {
  return {
    version: 8,
    sources: {},
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#0d1f18' }
      }
    ]
  };
}

// ============================================================
// ADD LAYERS TO A MAP INSTANCE
// ============================================================
function addKlasifikasiLayer(map, year, geojsonData) {
  const src = `klasifikasi-${year}`;
  if (!map.getSource(src)) {
    map.addSource(src, { type: 'geojson', data: geojsonData });
  }
  if (!map.getLayer(`fill-${year}`)) {
    map.addLayer({
      id: `fill-${year}`,
      type: 'fill',
      source: src,
      paint: {
        'fill-color': COLOR_EXPR,
        'fill-opacity': 0.85,
        'fill-outline-color': 'rgba(0,0,0,0.0)'
      }
    });
  }
}

function addBatasLayer(map, geojsonData) {
  if (!map.getSource('batas')) {
    map.addSource('batas', { type: 'geojson', data: geojsonData });
  }
  if (!map.getLayer('batas-outline')) {
    map.addLayer({
      id: 'batas-outline',
      type: 'line',
      source: 'batas',
      paint: {
        'line-color': '#ffffff',
        'line-width': 2,
        'line-dasharray': [4, 3],
        'line-opacity': 0.8
      }
    });
  }
}

function showOnlyYear(map, year) {
  ['2020', '2025'].forEach(y => {
    const id = `fill-${y}`;
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', y === year ? 'visible' : 'none');
    }
  });
}

// ============================================================
// POPUP HANDLER
// ============================================================
function attachClickHandler(map, year) {
  map.on('click', (e) => {
    const features = map.queryRenderedFeatures(e.point, {
      layers: ['fill-2020', 'fill-2025'].filter(id => map.getLayer(id))
    });

    const popup = document.getElementById('map-popup');
    if (!popup) return;

    // Find the visible layer's feature
    const visYear = currentMode === 'single' ? currentYear : year;
    const layerId = `fill-${visYear}`;
    const feat = features.find(f => f.layer.id === layerId);

    if (!feat) {
      popup.innerHTML = `
        <button class="popup-close" onclick="document.getElementById('map-popup').classList.remove('visible')" aria-label="Tutup popup">✕</button>
        <div class="popup-nodata">Tidak ada data klasifikasi di titik ini.</div>
      `;
      positionPopup(popup, e.point, map.getContainer());
      popup.classList.add('visible');
      return;
    }

    const kode = feat.properties.kelas;
    const info = KELAS[kode] || { label: 'Tanpa data', color: '#666' };
    popup.innerHTML = `
      <button class="popup-close" onclick="document.getElementById('map-popup').classList.remove('visible')" aria-label="Tutup popup">✕</button>
      <div class="popup-title">Informasi Piksel</div>
      <div class="popup-row">
        <span class="popup-swatch" style="background:${info.color}"></span>
        <span><strong>${info.label}</strong></span>
      </div>
      <div class="popup-row text-muted" style="font-size:0.8rem;">Kode kelas: ${kode} &nbsp;|&nbsp; Tahun: ${visYear}</div>
      <div class="popup-status">⚠ Klasifikasi sementara – belum tervalidasi independen</div>
    `;
    positionPopup(popup, e.point, map.getContainer());
    popup.classList.add('visible');
  });

  map.on('mousemove', (e) => {
    const features = map.queryRenderedFeatures(e.point, {
      layers: ['fill-2020', 'fill-2025'].filter(id => map.getLayer(id))
    });
    map.getCanvas().style.cursor = features.length ? 'pointer' : '';
  });
}

function positionPopup(popup, point, container) {
  const rect = container.getBoundingClientRect();
  const x = point.x + 12;
  const y = point.y - 10;
  const pw = 290;
  const ph = 160;
  popup.style.left = (x + pw > rect.width ? x - pw - 20 : x) + 'px';
  popup.style.top  = (y + ph > rect.height ? y - ph : y) + 'px';
}

// ============================================================
// SCALE BAR (simple)
// ============================================================
function addScaleBar(map, containerId) {
  const ctrl = new maplibregl.ScaleControl({ unit: 'metric', maxWidth: 100 });
  map.addControl(ctrl, 'bottom-left');
}

// ============================================================
// INIT SINGLE MAP
// ============================================================
async function initSingleMap(batasData, k2020Data) {
  mapSingle = new maplibregl.Map({
    container: 'map-single',
    style: makeStyle(),
    bounds: BOUNDS,
    fitBoundsOptions: { padding: 40 },
    attributionControl: false
  });

  mapSingle.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  mapSingle.addControl(new maplibregl.ScaleControl({ unit: 'metric', maxWidth: 100 }), 'bottom-left');

  await new Promise(resolve => mapSingle.on('load', resolve));

  addBatasLayer(mapSingle, batasData);
  addKlasifikasiLayer(mapSingle, '2020', k2020Data);

  attachClickHandler(mapSingle, '2020');
}

// ============================================================
// INIT SBS MAPS
// ============================================================
async function initSBSMaps(batasData, k2020Data) {
  const makeMapAt = async (containerId) => {
    const m = new maplibregl.Map({
      container: containerId,
      style: makeStyle(),
      bounds: BOUNDS,
      fitBoundsOptions: { padding: 20 },
      attributionControl: false
    });
    m.addControl(new maplibregl.ScaleControl({ unit: 'metric', maxWidth: 80 }), 'bottom-left');
    await new Promise(r => m.on('load', r));
    return m;
  };

  mapLeft  = await makeMapAt('map-left');
  mapRight = await makeMapAt('map-right');

  // Sync pan/zoom
  let syncing = false;
  const sync = (src, dst) => {
    if (syncing) return;
    syncing = true;
    dst.jumpTo({ center: src.getCenter(), zoom: src.getZoom(), bearing: src.getBearing(), pitch: src.getPitch() });
    syncing = false;
  };
  mapLeft.on('move',  () => sync(mapLeft,  mapRight));
  mapRight.on('move', () => sync(mapRight, mapLeft));

  // Add data to both
  addBatasLayer(mapLeft,  batasData);
  addBatasLayer(mapRight, batasData);
  addKlasifikasiLayer(mapLeft,  '2020', k2020Data);
  addKlasifikasiLayer(mapRight, '2020', k2020Data);

  attachClickHandler(mapLeft,  '2020');
  attachClickHandler(mapRight, '2025');
}

// ============================================================
// LOAD DATA
// ============================================================
let cache = {};

async function loadYear(year) {
  if (cache[year]) return cache[year];
  const url = year === '2020' ? DATA_URLS.k2020 : DATA_URLS.k2025;
  const sizeMB = year === '2020' ? '19.9' : '22.4';
  setLoading(true, `Memuat data klasifikasi ${year} (${sizeMB} MB)…`);
  try {
    const data = await fetchGeoJSON(url, pct => {
      setLoading(true, `Memuat data klasifikasi ${year} (${sizeMB} MB)…`, `${pct}%`);
    });
    cache[year] = data;
    loaded[year] = true;
    return data;
  } finally {
    // loading state cleared by caller
  }
}

async function loadBatas() {
  if (cache.batas) return cache.batas;
  const data = await fetchGeoJSON(DATA_URLS.batas);
  cache.batas = data;
  loaded.batas = true;
  return data;
}

// ============================================================
// SWITCH YEAR (single map)
// ============================================================
async function switchYear(year) {
  if (currentYear === year && currentMode === 'single') return;
  currentYear = year;

  document.querySelectorAll('.year-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.year === year);
    b.setAttribute('aria-pressed', b.dataset.year === year ? 'true' : 'false');
  });

  if (currentMode !== 'single') return;

  if (!loaded[year]) {
    setLoading(true, `Memuat data klasifikasi ${year}…`);
    try {
      const data = await loadYear(year);
      if (mapSingle) addKlasifikasiLayer(mapSingle, year, data);
    } catch (err) {
      console.error(err);
      showError(`Gagal memuat data ${year}: ${err.message}`);
      return;
    }
  }

  setLoading(false);
  if (mapSingle) showOnlyYear(mapSingle, year);
  hideError();
}

// ============================================================
// MODE SWITCHING
// ============================================================
async function switchMode(mode) {
  currentMode = mode;

  document.querySelectorAll('.mode-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === mode);
    b.setAttribute('aria-pressed', b.dataset.mode === mode ? 'true' : 'false');
  });

  document.getElementById('map-single').style.display      = mode === 'single'  ? 'block' : 'none';
  document.getElementById('map-sbs').classList.toggle('active',   mode === 'sbs');
  document.getElementById('map-swipe-container').classList.toggle('active', mode === 'swipe');

  if (mode === 'sbs' || mode === 'swipe') {
    // Ensure 2025 data is loaded
    if (!loaded['2025']) {
      setLoading(true, 'Memuat data 2025 untuk perbandingan…');
      try {
        const data = await loadYear('2025');
        // Add to SBS maps
        if (mapLeft  && !mapLeft.getSource('klasifikasi-2025'))  addKlasifikasiLayer(mapLeft,  '2025', data);
        if (mapRight && !mapRight.getSource('klasifikasi-2025')) addKlasifikasiLayer(mapRight, '2025', data);
        // Swipe maps
        const swipeBefore = window._swipeMaps?.before;
        const swipeAfter  = window._swipeMaps?.after;
        if (swipeBefore && !swipeBefore.getSource('klasifikasi-2025')) addKlasifikasiLayer(swipeBefore, '2025', data);
        if (swipeAfter  && !swipeAfter.getSource('klasifikasi-2025'))  addKlasifikasiLayer(swipeAfter,  '2025', data);
        setLoading(false);
      } catch (err) {
        setLoading(false);
        showError(`Gagal memuat data 2025: ${err.message}`);
        return;
      }
    }

    if (mode === 'sbs') {
      // Show correct year on each side
      if (mapLeft)  { showOnlyYear(mapLeft,  '2020'); }
      if (mapRight) { showOnlyYear(mapRight, '2025'); }
      // Resize maps
      setTimeout(() => { mapLeft?.resize(); mapRight?.resize(); }, 50);
    }

    if (mode === 'swipe') {
      initSwipeMaps();
    }
  }

  if (mode === 'single') {
    hideError();
    setLoading(false);
    setTimeout(() => mapSingle?.resize(), 50);
  }
}

// ============================================================
// SWIPE MODE
// ============================================================
async function initSwipeMaps() {
  if (window._swipeMaps) {
    setSwipePos(50);
    return;
  }
  const batasData = cache.batas;
  const k2020Data = cache['2020'];
  const k2025Data = cache['2025'];

  const makeSwipeMap = async (containerId) => {
    const m = new maplibregl.Map({
      container: containerId,
      style: makeStyle(),
      bounds: BOUNDS,
      fitBoundsOptions: { padding: 20 },
      attributionControl: false,
      interactive: true,
    });
    await new Promise(r => m.on('load', r));
    return m;
  };

  const before = await makeSwipeMap('swipe-before');
  const after  = await makeSwipeMap('swipe-after');
  window._swipeMaps = { before, after };

  addBatasLayer(before, batasData);
  addKlasifikasiLayer(before, '2020', k2020Data);
  showOnlyYear(before, '2020');

  addBatasLayer(after, batasData);
  if (k2025Data) {
    addKlasifikasiLayer(after, '2025', k2025Data);
    showOnlyYear(after, '2025');
  }

  // Sync
  let syncing = false;
  const sync = (src, dst) => {
    if (syncing) return;
    syncing = true;
    dst.jumpTo({ center: src.getCenter(), zoom: src.getZoom() });
    syncing = false;
  };
  before.on('move', () => sync(before, after));
  after.on('move',  () => sync(after, before));

  setSwipePos(50);
  attachSwipeEvents();
}

function setSwipePos(pct) {
  swipePos = pct;
  const slider = document.querySelector('.swipe-slider');
  const beforeEl = document.getElementById('swipe-before');
  if (slider) slider.style.left = pct + '%';
  if (beforeEl) beforeEl.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
}

function attachSwipeEvents() {
  const slider = document.querySelector('.swipe-slider');
  const container = document.getElementById('map-swipe-container');
  if (!slider || !container) return;

  const getPos = (e) => {
    const rect = container.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    return Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
  };

  slider.addEventListener('mousedown', (e) => { swipeDragging = true; e.preventDefault(); });
  slider.addEventListener('touchstart', (e) => { swipeDragging = true; }, { passive: true });

  document.addEventListener('mousemove', (e) => {
    if (swipeDragging) setSwipePos(getPos(e));
  });
  document.addEventListener('touchmove', (e) => {
    if (swipeDragging) setSwipePos(getPos(e));
  }, { passive: true });

  document.addEventListener('mouseup',   () => { swipeDragging = false; });
  document.addEventListener('touchend',  () => { swipeDragging = false; });
}

// ============================================================
// RESET VIEW
// ============================================================
function resetView() {
  if (mapSingle) mapSingle.fitBounds(BOUNDS, { padding: 40, duration: 800 });
  if (mapLeft)   mapLeft.fitBounds(BOUNDS,  { padding: 20, duration: 800 });
  if (mapRight)  mapRight.fitBounds(BOUNDS, { padding: 20, duration: 800 });
}

// ============================================================
// MAIN INIT
// ============================================================
async function initWebGIS() {
  setLoading(true, 'Menginisialisasi peta…');

  try {
    // Load batas studi first (tiny file)
    const batasData = await loadBatas();

    // Load 2020 data (default year)
    setLoading(true, 'Memuat data klasifikasi 2020 (19.9 MB)…');
    const k2020Data = await loadYear('2020');

    // Init single map
    await initSingleMap(batasData, k2020Data);

    // Init SBS maps (preload for fast switching)
    await initSBSMaps(batasData, k2020Data);

    // Set initial year display
    showOnlyYear(mapSingle, '2020');

    setLoading(false);
    hideError();

    // Attach popup container to mapSingle's container
    const popup = document.getElementById('map-popup');
    if (popup) {
      document.getElementById('map-single').appendChild(popup);
    }

    showToast('Peta 2020 berhasil dimuat');

  } catch (err) {
    console.error('WebGIS init failed:', err);
    setLoading(false);
    showError(`Gagal memuat peta: ${err.message}. Menampilkan gambar fallback.`);
  }
}

// ============================================================
// DOM READY
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  // Nav toggle
  const navToggle = document.getElementById('nav-toggle');
  const navLinks  = document.getElementById('nav-links');
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      const open = navLinks.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', open);
    });
  }

  // Year buttons
  document.querySelectorAll('.year-btn').forEach(btn => {
    btn.addEventListener('click', () => switchYear(btn.dataset.year));
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); switchYear(btn.dataset.year); }
    });
  });

  // Mode buttons
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => switchMode(btn.dataset.mode));
  });

  // Reset button
  document.getElementById('btn-reset')?.addEventListener('click', resetView);

  // Accordion
  document.querySelectorAll('.accordion-header').forEach(header => {
    header.addEventListener('click', () => {
      const expanded = header.getAttribute('aria-expanded') === 'true';
      header.setAttribute('aria-expanded', !expanded);
      header.nextElementSibling.classList.toggle('open', !expanded);
    });
    header.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); header.click(); }
    });
  });

  // Error retry button
  document.getElementById('btn-retry')?.addEventListener('click', () => {
    cache = {};
    loaded = { batas: false, '2020': false, '2025': false };
    hideError();
    initWebGIS();
  });

  // Start map
  initWebGIS();
});
