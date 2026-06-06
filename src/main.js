const CONFIG = {
  eventDate: '2026-06-07',
  eventNoteKeyword: '北浦和居場所マッピングパーティー',
  beforeDataUrl: 'data/before-osm.json',
  bounds: { south: 35.857, west: 139.625, north: 35.888, east: 139.665 },
  center: [35.872, 139.645],
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
  before: '#8e99aa',
  after: '#e85d3f',
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

const map = L.map('map').setView(CONFIG.center, CONFIG.zoom);
const baseLayers = {
  'OpenStreetMap': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }),
  '地理院地図（標準）': L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル</a>'
  }),
  '地理院航空写真': L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg', {
    maxZoom: 18,
    attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル</a>'
  })
};

baseLayers.OpenStreetMap.addTo(map);
L.control.layers(baseLayers, null, { position: 'topright' }).addTo(map);
L.control.scale({ imperial: false }).addTo(map);
L.rectangle(
  [[CONFIG.bounds.south, CONFIG.bounds.west], [CONFIG.bounds.north, CONFIG.bounds.east]],
  { color: '#e85d3f', weight: 2, fill: false, dashArray: '6 4', interactive: false }
).addTo(map);

const layers = {
  before: L.layerGroup().addTo(map),
  after: L.layerGroup().addTo(map),
  theme: L.layerGroup().addTo(map)
};

const state = {
  layers: { before: true, after: true, theme: true },
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
  dateFilter: { from: 2010, to: new Date().getFullYear(), showNoDate: true }
};

let beforeFeatures = [];
let afterFeatures = [];

function buildAfterQuery() {
  const b = CONFIG.bounds;
  const bbox = `${b.south},${b.west},${b.north},${b.east}`;
  return `
    [out:json][timeout:25];
    (
      node["survey:date"="${CONFIG.eventDate}"](${bbox});
      way["survey:date"="${CONFIG.eventDate}"](${bbox});
      node["note"~"${CONFIG.eventNoteKeyword}"](${bbox});
      way["note"~"${CONFIG.eventNoteKeyword}"](${bbox});
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
    category: getCategory(tags),
    themeTags: getThemeTags(tags),
    isAfter: source === 'after',
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

function clearLayers() {
  Object.values(layers).forEach(layer => layer.clearLayers());
}

function render() {
  clearLayers();
  let visible = 0;
  const placedLabels = [];
  const combined = [...beforeFeatures, ...afterFeatures];

  for (const feature of combined) {
    if (!visibleByFilter(feature)) continue;
    const targetLayer = feature.isAfter ? 'after' : 'before';
    if (state.layers[targetLayer]) {
      makeMarker(feature, targetLayer, canPlaceLabel(feature, placedLabels)).addTo(layers[targetLayer]);
      visible++;
    }
    if (state.layers.theme && feature.themeTags.length > 0) {
      makeMarker(feature, 'theme', false).addTo(layers.theme);
    }
  }

  updateStats(visible);
}

function makeMarker(feature, mode, showLabel) {
  const color = COLORS[feature.category] || COLORS.other;
  const isTheme = mode === 'theme';
  const marker = L.circleMarker([feature.lat, feature.lon], {
    radius: isTheme ? 12 : feature.isAfter ? 10 : feature.themeTags.length ? 8 : 7,
    color: isTheme ? '#111827' : feature.isAfter ? COLORS.after : color,
    fillColor: color,
    fillOpacity: isTheme ? 0 : mode === 'before' ? .68 : .9,
    opacity: isTheme ? .72 : .96,
    weight: isTheme ? 2 : feature.isAfter ? 4 : feature.themeTags.length ? 2 : 1
  }).bindPopup(buildPopup(feature));

  marker.on('mouseover', () => marker.openPopup());

  if (showLabel && feature.tags.name) {
    marker.bindTooltip(escapeHtml(feature.tags.name), {
      permanent: true,
      direction: 'right',
      offset: getLabelOffset(feature),
      className: 'poi-label'
    });
  }
  return marker;
}

function buildPopup(feature) {
  const tags = feature.tags;
  const name = tags.name || '名称なし';
  const type = tags.amenity || tags.shop || tags.leisure || tags.emergency || tags.highway || tags.railway || tags.public_transport || '地点';
  const osmUrl = `https://www.openstreetmap.org/${feature.id}`;
  const themeHtml = feature.themeTags.map(tag => `<span class="tag theme-tag">${escapeHtml(tag)}</span>`).join('');
  const stateHtml = feature.isAfter ? '<span class="tag theme-tag">今回の成果</span>' : '<span class="tag">Before</span>';
  const rows = buildInfoRows(feature);

  return `
    <div class="popup-title">${escapeHtml(name)}</div>
    <div>${escapeHtml(type)}</div>
    <div class="tag-list">${stateHtml}${themeHtml}</div>
    ${rows ? `<dl class="popup-meta">${rows}</dl>` : ''}
    <p style="margin:10px 0 0;font-size:12px;"><a href="${osmUrl}" target="_blank" rel="noopener">OSMで開く</a></p>
  `;
}

function buildInfoRows(feature) {
  const t = feature.tags;
  const rows = [];
  const push = (label, value, formatter) => {
    if (!value) return;
    const formatted = formatter ? formatter(value) : escapeHtml(value);
    rows.push(`<div class="popup-row"><dt>${label}</dt><dd>${formatted}</dd></div>`);
  };
  push('カテゴリ', getCategoryLabel(feature.category));
  push('分類タグ', t.amenity || t.shop || t.leisure || t.emergency || t.highway || t.railway || t.public_transport);
  push('業種', t.cuisine || t.healthcare || t.social_facility || t.shop);
  push('営業時間', t.opening_hours, formatOpeningHours);
  push('電話番号', t.phone || t['contact:phone']);
  push('Web', t.website || t['contact:website']);
  push('住所', t['addr:full'] || [t['addr:city'], t['addr:suburb'], t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' '));
  push('車いす', t.wheelchair, formatYesNo);
  push('トイレ', t.amenity === 'toilets' ? 'あり' : t.toilets, formatYesNo);
  push('最終調査', t['survey:date']);
  push('更新年', feature.year ? String(feature.year) : '不明');
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

function canPlaceLabel(feature, placedLabels) {
  if (map.getZoom() < 16 || !feature.tags.name) return false;
  const [dx, dy] = getLabelOffset(feature);
  const point = map.latLngToContainerPoint([feature.lat, feature.lon]);
  const candidate = { x: point.x + dx, y: point.y + dy };
  for (const placed of placedLabels) {
    if (Math.abs(placed.x - candidate.x) < 88 && Math.abs(placed.y - candidate.y) < 16) return false;
  }
  placedLabels.push(candidate);
  return true;
}

function getLabelOffset(feature) {
  let hash = 0;
  for (const char of feature.id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return [12 + (hash % 14), ((hash >> 4) % 15) - 7];
}

function updateStats(visible) {
  document.getElementById('beforeCount').textContent = beforeFeatures.length;
  document.getElementById('afterCount').textContent = afterFeatures.length;
  document.getElementById('themeCount').textContent = [...beforeFeatures, ...afterFeatures].filter(f => f.themeTags.length).length;
  document.getElementById('visibleCount').textContent = visible;
}

function setStatus(text) {
  document.getElementById('statusText').textContent = text;
}

async function loadData() {
  const button = document.getElementById('reloadButton');
  button.disabled = true;
  button.textContent = '読み込み中...';
  setStatus('Before JSONとAfterデータを読み込んでいます。');
  try {
    const beforeJson = await loadBeforeSnapshot();
    const afterJson = await postOverpass(buildAfterQuery()).catch(error => {
      console.warn(error);
      setStatus('Beforeは表示中。AfterのOverpass取得に失敗しました。');
      return { elements: [] };
    });
    const afterIds = new Set((afterJson.elements || []).map(el => `${el.type}/${el.id}`));
    beforeFeatures = dedupeFeatures((beforeJson.elements || [])
      .filter(el => !afterIds.has(`${el.type}/${el.id}`))
      .map(el => elementToFeature(el, 'before')));
    afterFeatures = dedupeFeatures((afterJson.elements || []).map(el => elementToFeature(el, 'after')));
    render();
    setStatus(`Before ${beforeFeatures.length}件、After ${afterFeatures.length}件を表示できます。`);
    button.textContent = 'データを再読み込み';
  } catch (error) {
    console.error(error);
    setStatus(error.message);
    alert(`データの読み込みに失敗しました。\n${error.message}`);
    button.textContent = 'データを読み込む';
  } finally {
    button.disabled = false;
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

  const currentYear = new Date().getFullYear();
  const fromEl = document.getElementById('dateFrom');
  const toEl = document.getElementById('dateTo');
  const fromLabel = document.getElementById('dateFromLabel');
  const toLabel = document.getElementById('dateToLabel');
  const showNoDate = document.getElementById('showNoDate');
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
  document.getElementById('reloadButton').addEventListener('click', loadData);
  map.on('zoomend moveend', render);
}

bindControls();
loadData();
