const CONFIG = {
  changedSinceJstLabel: '2026-06-07 00:00',
  changedSinceUtc: '2026-06-06T15:00:00Z',
  beforeDataUrl: 'data/before-osm.json',
  changedDataUrl: 'data/changed-osm.json',
  bounds: { south: 35.857, west: 139.625, north: 35.888, east: 139.665 },
  center: [139.645, 35.872],
  zoom: 15,
  overpassEndpoints: [
    'https://overpass.openstreetmap.fr/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass-api.de/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter'
  ]
};

const COLORS = {
  changed: '#facc15',
  food: '#d97706',
  shop: '#0d9488',
  medical: '#dc2626',
  park: '#16a34a',
  public: '#2563eb',
  care: '#9333ea',
  safe: '#f97316',
  mobility: '#0891b2',
  other: '#475569'
};

const THEME_TAGS = [
  'amenity=cafe', 'amenity=restaurant', 'amenity=clinic',
  'amenity=doctors', 'amenity=dentist', 'amenity=hospital',
  'amenity=pharmacy', 'amenity=community_centre', 'amenity=library',
  'amenity=social_facility', 'amenity=childcare', 'amenity=school',
  'shop=supermarket', 'shop=convenience', 'shop=bakery',
  'leisure=park', 'leisure=playground', 'amenity=bench',
  'amenity=toilets', 'amenity=drinking_water', 'emergency=defibrillator',
  'highway=bus_stop', 'railway=station', 'seating=yes',
  'internet_access=wlan', 'power_supply=yes', 'wheelchair=yes',
  'wheelchair=limited', 'toilets:wheelchair=yes'
];

const BASEMAPS = {
  openfreemap: {
    label: 'OpenFreeMap ベクター',
    style: 'https://tiles.openfreemap.org/styles/liberty'
  },
  osm: {
    label: 'OpenStreetMap',
    style: rasterStyle('osm', ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], '&copy; OpenStreetMap contributors')
  },
  'gsi-std': {
    label: '地理院地図 標準',
    style: rasterStyle('gsi-std', ['https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png'], '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル</a>')
  },
  'gsi-photo': {
    label: '地理院 航空写真',
    style: rasterStyle('gsi-photo', ['https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg'], '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル</a>')
  }
};

const map = new maplibregl.Map({
  container: 'map',
  center: CONFIG.center,
  zoom: CONFIG.zoom,
  style: BASEMAPS.openfreemap.style,
  crossSourceCollisions: false,
  localIdeographFontFamily: 'sans-serif'
});

map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');
map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

const state = {
  layers: { before: true, changed: true, theme: true },
  basemap: 'openfreemap',
  categories: {
    food: true,
    shop: true,
    medical: true,
    public: true,
    care: true,
    park: true,
    safe: true,
    mobility: true,
    other: true
  },
  labels: { showChangedUser: false },
  dateFilter: { from: 2010, to: new Date().getFullYear(), showNoDate: true }
};

let beforeFeatures = [];
let beforeSnapshotFeatures = [];
let changedFeatures = [];
let selectedFeatureId = null;
let visibleFeatureMap = new Map();
let mapHandlersBound = false;
let styleSwitchToken = 0;
let renderRetryTimer = null;

map.on('style.load', () => {
  addMapSourcesAndLayers();
  render();
});

map.on('load', () => {
  addMapSourcesAndLayers();
  bindMapHandlers();
  bindControls();
  loadBeforeData();
});

function rasterStyle(id, tiles, attribution) {
  return {
    version: 8,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      [id]: {
        type: 'raster',
        tiles,
        tileSize: 256,
        attribution
      }
    },
    layers: [{ id: `${id}-raster`, type: 'raster', source: id }]
  };
}

function addMapSourcesAndLayers() {
  if (!map.getSource('bounds')) {
    map.addSource('bounds', {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [CONFIG.bounds.west, CONFIG.bounds.south],
            [CONFIG.bounds.east, CONFIG.bounds.south],
            [CONFIG.bounds.east, CONFIG.bounds.north],
            [CONFIG.bounds.west, CONFIG.bounds.north],
            [CONFIG.bounds.west, CONFIG.bounds.south]
          ]
        }
      }
    });
  }
  if (!map.getLayer('bounds-line')) {
    map.addLayer({
      id: 'bounds-line',
      type: 'line',
      source: 'bounds',
      paint: {
        'line-color': '#e85d3f',
        'line-width': 2,
        'line-dasharray': [2, 2]
      }
    });
  }

  if (!map.getSource('pois')) {
    map.addSource('pois', { type: 'geojson', data: emptyFeatureCollection() });
  }
  if (!map.getLayer('poi-casing')) {
    map.addLayer({
      id: 'poi-casing',
      type: 'circle',
      source: 'pois',
      paint: {
        'circle-radius': [
          'case',
          ['get', 'selected'], 10,
          ['get', 'changed'], 10,
          ['get', 'themeVisible'], 8,
          7
        ],
        'circle-color': [
          'case',
          ['get', 'selected'], '#111827',
          ['get', 'changed'], COLORS.changed,
          ['get', 'themeVisible'], '#111827',
          ['get', 'color']
        ],
        'circle-opacity': 0.95
      }
    });
  }
  if (!map.getLayer('poi-points')) {
    map.addLayer({
      id: 'poi-points',
      type: 'circle',
      source: 'pois',
      paint: {
        'circle-radius': [
          'case',
          ['get', 'selected'], 7,
          ['get', 'changed'], 6,
          ['get', 'themeVisible'], 6,
          5
        ],
        'circle-color': ['get', 'color'],
        'circle-opacity': [
          'case',
          ['get', 'changed'], 0.96,
          0.72
        ],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1
      }
    });
  }
  ensurePoiLabelLayer();
  movePoiLayersToTop();
}

function ensurePoiLabelLayer() {
  if (map.getLayer('poi-labels')) return;
  map.addLayer({
    id: 'poi-labels',
    type: 'symbol',
    source: 'pois',
    minzoom: 14.5,
    filter: ['has', 'labelText'],
    layout: {
      'text-field': ['get', 'labelText'],
      'text-font': ['Noto Sans Regular'],
      'text-size': [
        'interpolate',
        ['linear'],
        ['zoom'],
        14.5, 10,
        16, 11,
        18, 13
      ],
      'text-variable-anchor': ['top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right'],
      'text-radial-offset': 1.05,
      'text-justify': 'auto',
      'text-max-width': 9,
      'text-padding': 2,
      'text-optional': false,
      'text-allow-overlap': false,
      'text-ignore-placement': false,
      'symbol-sort-key': ['get', 'labelPriority']
    },
    paint: {
      'text-color': '#172033',
      'text-halo-color': '#ffffff',
      'text-halo-width': 1.75,
      'text-halo-blur': 0.25
    }
  });
}

function movePoiLayersToTop() {
  ['bounds-line', 'poi-casing', 'poi-points', 'poi-labels'].forEach(layerId => {
    if (map.getLayer(layerId)) {
      map.moveLayer(layerId);
    }
  });
}

function bindMapHandlers() {
  if (mapHandlersBound) return;
  mapHandlersBound = true;

  map.on('click', event => {
    if (!map.getLayer('poi-points')) return;
    const clicked = map.queryRenderedFeatures(event.point, { layers: ['poi-points'] })[0];
    if (!clicked) return;
    const feature = visibleFeatureMap.get(clicked.properties.id);
    if (!feature) return;
    selectedFeatureId = feature.id;
    showDetails(feature);
    render();
  });

  map.on('mousemove', event => {
    if (!map.getLayer('poi-points')) return;
    const features = map.queryRenderedFeatures(event.point, { layers: ['poi-points'] });
    map.getCanvas().style.cursor = features.length ? 'pointer' : '';
  });
}

function switchBasemap(nextBasemap) {
  if (!BASEMAPS[nextBasemap] || nextBasemap === state.basemap) return;
  state.basemap = nextBasemap;
  styleSwitchToken++;
  const token = styleSwitchToken;
  setStatus(`${BASEMAPS[nextBasemap].label}へ切り替えています。`);
  map.once('style.load', () => {
    window.setTimeout(() => restoreOverlayLayersWhenReady(token), 0);
  });
  map.setStyle(BASEMAPS[nextBasemap].style, { diff: false });
  restoreOverlayLayersWhenReady(token);
}

function restoreOverlayLayersWhenReady(token, attempt = 0) {
  if (token !== styleSwitchToken) return;
  if (!map.isStyleLoaded()) {
    if (attempt < 40) {
      window.setTimeout(() => restoreOverlayLayersWhenReady(token, attempt + 1), 150);
    }
    return;
  }
  addMapSourcesAndLayers();
  render();
  const changedText = changedFeatures.length ? `${changedFeatures.length}件` : '未取得';
  setStatus(`Before ${beforeFeatures.length}件を表示しています。本日変更は${changedText}です。`);
}

function buildChangedQuery() {
  const b = CONFIG.bounds;
  const bbox = `${b.south},${b.west},${b.north},${b.east}`;
  return `
    [out:json][timeout:60];
    (
      node(newer:"${CONFIG.changedSinceUtc}")(${bbox});
      way(newer:"${CONFIG.changedSinceUtc}")(${bbox});
      relation(newer:"${CONFIG.changedSinceUtc}")(${bbox});
    );
    out center tags meta;
  `;
}

async function postOverpass(query) {
  const attempts = CONFIG.overpassEndpoints.map(async endpoint => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: new URLSearchParams({ data: query }),
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`${endpoint}: ${response.status}`);
      return await response.json();
    } finally {
      window.clearTimeout(timer);
    }
  });

  const results = await Promise.allSettled(attempts);
  const fulfilled = results
    .filter(result => result.status === 'fulfilled' && Array.isArray(result.value?.elements))
    .map(result => result.value);
  if (fulfilled.length === 0) {
    const messages = results
      .filter(result => result.status === 'rejected')
      .map(result => result.reason?.message || String(result.reason));
    throw new Error(messages.join(' / ') || 'Overpass APIから取得できませんでした');
  }
  return fulfilled.sort((a, b) => {
    const at = Date.parse(a.osm3s?.timestamp_osm_base || '') || 0;
    const bt = Date.parse(b.osm3s?.timestamp_osm_base || '') || 0;
    return bt - at;
  })[0];
}

async function loadBeforeSnapshot() {
  const response = await fetch(CONFIG.beforeDataUrl, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Before JSONを読み込めません: ${response.status}`);
  return response.json();
}

async function loadChangedSnapshot() {
  const response = await fetch(CONFIG.changedDataUrl, { cache: 'no-store' });
  if (!response.ok) throw new Error(`本日変更JSONを読み込めません: ${response.status}`);
  return response.json();
}

function elementToFeature(element, source) {
  const tags = element.tags || {};
  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return {
    id: `${element.type}/${element.id}`,
    lat,
    lon,
    tags,
    source,
    osmType: element.type,
    osmId: element.id,
    category: getCategory(tags),
    themeTags: getThemeTags(tags),
    isChanged: source === 'changed',
    timestamp: element.timestamp || null,
    version: element.version || null,
    changeset: element.changeset || null,
    user: element.user || null,
    uid: element.uid || null,
    year: getElementYear(element)
  };
}

function dedupeFeatures(features) {
  const seen = new Set();
  return features.filter(feature => {
    if (!feature || seen.has(feature.id)) return false;
    seen.add(feature.id);
    return true;
  });
}

function elementHasTags(element) {
  return Object.keys(element.tags || {}).length > 0;
}

function getElementYear(element) {
  const match = String(element.timestamp || '').match(/^(\d{4})/);
  return match ? Number(match[1]) : null;
}

function getThemeTags(tags) {
  return THEME_TAGS.filter(rule => {
    const [key, value] = rule.split('=');
    return tags[key] === value;
  });
}

function getCategory(tags) {
  if (['cafe', 'restaurant', 'fast_food', 'bar', 'pub'].includes(tags.amenity)) return 'food';
  if (tags.shop) return 'shop';
  if (['clinic', 'doctors', 'dentist', 'hospital', 'pharmacy'].includes(tags.amenity)) return 'medical';
  if (['bank', 'post_office', 'post_box', 'police', 'fire_station', 'townhall', 'community_centre', 'library', 'public_building'].includes(tags.amenity)) return 'public';
  if (['social_facility', 'childcare', 'kindergarten', 'school'].includes(tags.amenity) || tags.kids_area === 'yes' || tags.family_friendly === 'yes') return 'care';
  if (['park', 'playground'].includes(tags.leisure) || tags.amenity === 'bench') return 'park';
  if (['toilets', 'drinking_water'].includes(tags.amenity) || tags.emergency === 'defibrillator') return 'safe';
  if (tags.highway === 'bus_stop' || ['station', 'halt', 'tram_stop'].includes(tags.railway) || tags.public_transport || tags.amenity === 'bicycle_parking' || tags.amenity === 'parking' || tags.wheelchair || tags['toilets:wheelchair'] || tags.ramp) return 'mobility';
  return 'other';
}

function visibleByFilter(feature) {
  if (!state.categories[feature.category]) return false;
  if (feature.year === null) return state.dateFilter.showNoDate;
  return feature.year >= state.dateFilter.from && feature.year <= state.dateFilter.to;
}

function render() {
  if (!map.isStyleLoaded()) {
    if (!renderRetryTimer) {
      renderRetryTimer = window.setTimeout(() => {
        renderRetryTimer = null;
        render();
      }, 150);
    }
    return;
  }
  addMapSourcesAndLayers();

  const beforeIds = new Set(beforeFeatures.map(feature => feature.id));
  const changedFeatureById = new Map(changedFeatures.map(feature => [feature.id, feature]));
  const changedIds = new Set(changedFeatureById.keys());
  const changedOnlyFeatures = changedFeatures.filter(feature => !beforeIds.has(feature.id));
  const combined = [...beforeFeatures, ...changedOnlyFeatures];
  const visible = [];
  visibleFeatureMap = new Map();

  for (const feature of combined) {
    if (!visibleByFilter(feature)) continue;
    const changedFeature = changedFeatureById.get(feature.id);
    const renderedFeature = changedFeature
      ? { ...feature, ...changedFeature, isChanged: true }
      : feature;
    if (renderedFeature.isChanged && !state.layers.changed) continue;
    if (!renderedFeature.isChanged && !state.layers.before) continue;
    visible.push(renderedFeature);
    visibleFeatureMap.set(renderedFeature.id, renderedFeature);
  }

  const source = map.getSource('pois');
  if (source) {
    source.setData({
      type: 'FeatureCollection',
      features: visible.map(featureToGeoJson)
    });
  }
  updateStats(visible.length);
}

function featureToGeoJson(feature) {
  const labelText = getLabelText(feature);
  const properties = {
    id: feature.id,
    name: feature.tags.name || '',
    category: feature.category,
    color: COLORS[feature.category] || COLORS.other,
    changed: feature.isChanged,
    selected: selectedFeatureId === feature.id,
    themeVisible: state.layers.theme && feature.themeTags.length > 0,
    labelPriority: getLabelPriority(feature)
  };
  if (labelText) properties.labelText = labelText;

  return {
    type: 'Feature',
    id: feature.id,
    properties,
    geometry: {
      type: 'Point',
      coordinates: [feature.lon, feature.lat]
    }
  };
}

function getLabelText(feature) {
  const name = feature.tags.name || '';
  if (feature.isChanged && state.labels.showChangedUser && feature.user) {
    return [name, `@${feature.user}`].filter(Boolean).join('\n');
  }
  return name;
}

function getLabelPriority(feature) {
  if (selectedFeatureId === feature.id) return 0;
  if (feature.isChanged) return 0.5;
  if (feature.themeTags.length > 0) return 2;
  return 3;
}

function emptyFeatureCollection() {
  return { type: 'FeatureCollection', features: [] };
}

function showDetails(feature) {
  const title = document.getElementById('detailTitle');
  const summary = document.getElementById('detailSummary');
  const content = document.getElementById('detailContent');
  if (!title || !summary || !content) return;

  const tags = feature.tags;
  const name = tags.name || '名称なし';
  const type = tags.amenity || tags.shop || tags.leisure || tags.emergency || tags.highway || tags.railway || tags.public_transport || '地点';
  title.textContent = name;
  summary.textContent = `${getCategoryLabel(feature.category)} / ${type}`;
  content.className = '';
  content.innerHTML = buildDetailHtml(feature);
}

function buildDetailHtml(feature) {
  const tags = feature.tags;
  const name = tags.name || '名称なし';
  const type = tags.amenity || tags.shop || tags.leisure || tags.emergency || tags.highway || tags.railway || tags.public_transport || '地点';
  const osmUrl = `https://www.openstreetmap.org/${feature.id}`;
  const themeHtml = feature.themeTags.map(tag => `<span class="tag theme-tag">${escapeHtml(tag)}</span>`).join('');
  const stateHtml = feature.source === 'before' ? '<span class="tag">Before</span>' : '';
  const changedHtml = feature.isChanged ? '<span class="tag changed-tag">本日変更</span>' : '';
  const rows = buildInfoRows(feature);

  return `
    <div class="detail-title">${escapeHtml(name)}</div>
    <div>${escapeHtml(type)}</div>
    <div class="tag-list">${stateHtml}${changedHtml}${themeHtml}</div>
    ${rows ? `<dl class="detail-meta">${rows}</dl>` : ''}
    <p style="margin:10px 0 0;font-size:12px;"><a href="${osmUrl}" target="_blank" rel="noopener">OSMで開く</a></p>
  `;
}

function buildInfoRows(feature) {
  const t = feature.tags;
  const rows = [];
  const push = (label, value, formatter) => {
    if (!value) return;
    const formatted = formatter ? formatter(value) : escapeHtml(value);
    rows.push(`<div class="detail-row"><dt>${label}</dt><dd>${formatted}</dd></div>`);
  };
  push('カテゴリ', getCategoryLabel(feature.category));
  push('分類タグ', t.amenity || t.shop || t.leisure || t.emergency || t.highway || t.railway || t.public_transport);
  push('業種', t.cuisine || t.healthcare || t.social_facility || t.shop);
  push('OSM種別', feature.osmType);
  push('OSM ID', feature.osmId ? String(feature.osmId) : '');
  push('OSMユーザ名', feature.user, formatOsmUser);
  push('OSM UID', feature.uid ? String(feature.uid) : '');
  push('バージョン', feature.version ? String(feature.version) : '');
  push('変更セット', feature.changeset ? String(feature.changeset) : '', formatChangeset);
  push('最終更新', feature.timestamp);
  push('更新年', feature.year ? String(feature.year) : '不明');
  push('営業時間', t.opening_hours, formatOpeningHours);
  push('電話番号', t.phone || t['contact:phone']);
  push('Web', t.website || t['contact:website']);
  push('ブランド', t.brand || t.operator);
  push('公式名', t.official_name || t.alt_name);
  push('住所', t['addr:full'] || [t['addr:city'], t['addr:suburb'], t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' '));
  push('車いす', t.wheelchair, formatYesNo);
  push('トイレ', t.amenity === 'toilets' ? 'あり' : t.toilets, formatYesNo);
  push('インターネット', t.internet_access);
  push('電源', t.power_supply, formatYesNo);
  push('座席', t.seating, formatYesNo);
  push('最終調査', t['survey:date']);
  push('座標', `${feature.lat.toFixed(6)}, ${feature.lon.toFixed(6)}`);
  push('メモ', t.note);
  return rows.join('');
}

function formatOpeningHours(raw) {
  if (raw === '24/7') return '毎日 24時間';
  return escapeHtml(String(raw).replaceAll(',', '、'));
}

function formatYesNo(value) {
  const mapValue = { yes: 'あり', no: 'なし', limited: '一部対応' };
  return escapeHtml(mapValue[value] || value);
}

function formatOsmUser(user) {
  const encoded = encodeURIComponent(user);
  return `<a href="https://www.openstreetmap.org/user/${encoded}" target="_blank" rel="noopener">${escapeHtml(user)}</a>`;
}

function formatChangeset(changeset) {
  const id = escapeHtml(changeset);
  return `<a href="https://www.openstreetmap.org/changeset/${id}" target="_blank" rel="noopener">${id}</a>`;
}

function getCategoryLabel(category) {
  return {
    food: '飲食・休憩',
    shop: '買い物・サービス',
    medical: '医療・薬局',
    public: '公共・金融・郵便',
    care: '子ども・福祉・学び',
    park: '公園・屋外滞在',
    safe: 'トイレ・AED・安心設備',
    mobility: '交通・バリアフリー',
    other: 'その他'
  }[category] || 'その他';
}

function updateStats(visible) {
  document.getElementById('beforeCount').textContent = beforeFeatures.length;
  document.getElementById('changedCount').textContent = changedFeatures.length;
  document.getElementById('visibleCount').textContent = visible;
}

function setStatus(text) {
  document.getElementById('statusText').textContent = text;
}

async function loadChangedData() {
  const button = document.getElementById('changedButton');
  button.disabled = true;
  button.textContent = '本日変更を取得中...';
  setStatus(`日本時間 ${CONFIG.changedSinceJstLabel} 以降の変更をOpenStreetMapから取得しています。`);
  try {
    const changedJson = await postOverpass(buildChangedQuery()).catch(error => {
      console.warn(error);
      throw new Error('本日変更のOverpass取得に失敗しました。表示中のデータはそのままです。');
    });
    changedFeatures = dedupeFeatures((changedJson.elements || []).filter(elementHasTags).map(el => elementToFeature(el, 'changed')));
    render();
    setStatus(`Before ${beforeFeatures.length}件、本日変更 ${changedFeatures.length}件を表示できます。`);
    button.textContent = '本日変更を再取得';
  } catch (error) {
    console.error(error);
    setStatus(error.message);
    alert(error.message);
    button.textContent = changedFeatures.length ? '本日変更を再取得' : '本日変更を取得';
  } finally {
    button.disabled = false;
  }
}

async function loadBeforeData() {
  setStatus('保存済みBeforeデータと本日変更データを読み込んでいます。');
  try {
    const [beforeJson, changedJson] = await Promise.all([
      loadBeforeSnapshot(),
      loadChangedSnapshot()
    ]);
    beforeSnapshotFeatures = dedupeFeatures((beforeJson.elements || []).map(el => elementToFeature(el, 'before')));
    beforeFeatures = beforeSnapshotFeatures;
    changedFeatures = dedupeFeatures((changedJson.elements || []).filter(elementHasTags).map(el => elementToFeature(el, 'changed')));
    render();
    setStatus(`Before ${beforeFeatures.length}件、保存済み本日変更 ${changedFeatures.length}件を表示しています。`);
    const button = document.getElementById('changedButton');
    button.disabled = true;
    button.textContent = '本日変更の再取得は一時停止中';
  } catch (error) {
    console.error(error);
    setStatus(error.message);
    alert(`保存済みデータの読み込みに失敗しました。\n${error.message}`);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function bindControls() {
  document.querySelectorAll('input[data-layer]').forEach(input => {
    input.addEventListener('change', event => {
      state.layers[event.target.dataset.layer] = event.target.checked;
      render();
    });
  });
  document.querySelectorAll('input[data-category]').forEach(input => {
    input.addEventListener('change', event => {
      state.categories[event.target.dataset.category] = event.target.checked;
      render();
    });
  });

  document.querySelectorAll('input[data-basemap]').forEach(input => {
    input.checked = input.dataset.basemap === state.basemap;
    input.addEventListener('change', event => {
      if (event.target.checked) {
        switchBasemap(event.target.dataset.basemap);
      }
    });
  });

  const currentYear = new Date().getFullYear();
  const fromEl = document.getElementById('dateFrom');
  const toEl = document.getElementById('dateTo');
  const fromLabel = document.getElementById('dateFromLabel');
  const toLabel = document.getElementById('dateToLabel');
  const showNoDate = document.getElementById('showNoDate');
  const showChangedUserLabels = document.getElementById('showChangedUserLabels');
  state.labels.showChangedUser = showChangedUserLabels.checked;
  fromEl.max = currentYear;
  toEl.max = currentYear;
  toEl.value = currentYear;
  toLabel.textContent = currentYear;

  function syncDateFilter() {
    let from = Number(fromEl.value);
    let to = Number(toEl.value);
    if (from > to) {
      if (document.activeElement === fromEl) {
        to = from;
        toEl.value = from;
      } else {
        from = to;
        fromEl.value = to;
      }
    }
    fromLabel.textContent = from;
    toLabel.textContent = to;
    state.dateFilter.from = from;
    state.dateFilter.to = to;
    render();
  }

  fromEl.addEventListener('input', syncDateFilter);
  toEl.addEventListener('input', syncDateFilter);
  showNoDate.addEventListener('change', () => {
    state.dateFilter.showNoDate = showNoDate.checked;
    render();
  });
  showChangedUserLabels.addEventListener('change', () => {
    state.labels.showChangedUser = showChangedUserLabels.checked;
    render();
  });
  const changedButton = document.getElementById('changedButton');
  changedButton.disabled = true;
  changedButton.textContent = '本日変更の再取得は一時停止中';
}
