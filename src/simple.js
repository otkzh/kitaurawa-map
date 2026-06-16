const CONFIG = {
  beforeDataUrl: 'data/before-osm.json',
  changedDataUrl: 'data/changed-osm.json',
  center: [35.872, 139.645],
  zoom: 15,
  bounds: [[35.857, 139.625], [35.888, 139.665]]
};

const CATEGORIES = {
  food: { label: '飲食・休憩', icon: '🍽', color: '#d97706', hint: 'カフェ、飲食店、ベンチなど' },
  shop: { label: '買い物・サービス', icon: '🛒', color: '#0d9488', hint: 'スーパー、コンビニ、お店など' },
  medical: { label: '医療・薬局', icon: '✚', color: '#dc2626', hint: '病院、診療所、薬局など' },
  public: { label: '公共・金融・郵便', icon: '🏛', color: '#2563eb', hint: '公共施設、銀行、郵便など' },
  care: { label: '子ども・福祉・学び', icon: '👪', color: '#9333ea', hint: '学校、福祉、子育て関連など' },
  park: { label: '公園・屋外滞在', icon: '木', color: '#16a34a', hint: '公園、遊び場、屋外の居場所' },
  safe: { label: 'トイレ・AED・安心設備', icon: '!', color: '#f97316', hint: 'トイレ、AED、水飲み場など' },
  mobility: { label: '交通・バリアフリー', icon: '↔', color: '#0891b2', hint: '駅、バス停、車いす情報など' },
  other: { label: 'その他', icon: '•', color: '#475569', hint: 'そのほかの地物' }
};

const MODE_TEXT = {
  story: '黄色い点が、当日に書き足されたり直されたりした地物です。薄い点はイベント前から地図にあったPOIです。',
  changed: '当日に書かれたものだけを表示しています。どんな場所が新しく見えるようになったかを追いやすい表示です。',
  before: 'イベント前から地図に入っていたPOIだけを表示しています。まちにはすでに多くの情報がありました。'
};

const map = L.map('simpleMap', { preferCanvas: true, zoomControl: true }).setView(CONFIG.center, CONFIG.zoom);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);
L.control.scale({ imperial: false }).addTo(map);
L.rectangle(CONFIG.bounds, {
  color: '#f97316',
  weight: 3,
  fill: false,
  dashArray: '8 5',
  interactive: false
}).addTo(map);

const markerLayer = L.layerGroup().addTo(map);
let beforeFeatures = [];
let changedFeatures = [];
let selectedId = null;
let mode = 'story';

init();

async function init() {
  bindModeButtons();
  const [beforeJson, changedJson] = await Promise.all([
    fetchJson(CONFIG.beforeDataUrl),
    fetchJson(CONFIG.changedDataUrl)
  ]);

  beforeFeatures = dedupe((beforeJson.elements || []).map(element => elementToFeature(element, 'before')));
  changedFeatures = dedupe((changedJson.elements || []).filter(hasTags).map(element => elementToFeature(element, 'changed')));
  updateStats();
  renderCategoryCards();
  renderChangedList();
  renderMap();
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${url} を読み込めません: ${response.status}`);
  return response.json();
}

function bindModeButtons() {
  document.querySelectorAll('[data-mode]').forEach(button => {
    button.addEventListener('click', () => {
      mode = button.dataset.mode;
      document.querySelectorAll('[data-mode]').forEach(item => item.classList.toggle('active', item === button));
      document.getElementById('modeSummary').textContent = MODE_TEXT[mode];
      renderMap();
    });
  });
}

function elementToFeature(element, source) {
  const tags = element.tags || {};
  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return {
    id: `${element.type}/${element.id}`,
    osmType: element.type,
    osmId: element.id,
    lat,
    lon,
    tags,
    source,
    category: getCategory(tags),
    timestamp: element.timestamp || null,
    user: element.user || null,
    uid: element.uid || null,
    changeset: element.changeset || null,
    version: element.version || null
  };
}

function dedupe(features) {
  const seen = new Set();
  return features.filter(feature => {
    if (!feature || seen.has(feature.id)) return false;
    seen.add(feature.id);
    return true;
  });
}

function hasTags(element) {
  return Object.keys(element.tags || {}).length > 0;
}

function renderMap() {
  markerLayer.clearLayers();
  const beforeIds = new Set(beforeFeatures.map(feature => feature.id));
  const changedById = new Map(changedFeatures.map(feature => [feature.id, feature]));
  const changedOnly = changedFeatures.filter(feature => !beforeIds.has(feature.id));
  const beforeToShow = beforeFeatures.map(feature => changedById.get(feature.id) || feature);

  if (mode !== 'changed') {
    beforeToShow.forEach(feature => addMarker(feature, changedById.has(feature.id)));
  }
  if (mode !== 'before') {
    changedOnly.forEach(feature => addMarker(feature, true));
  }
}

function addMarker(feature, isChanged) {
  const category = CATEGORIES[feature.category] || CATEGORIES.other;
  const selected = selectedId === feature.id;
  const marker = L.circleMarker([feature.lat, feature.lon], {
    radius: selected ? 12 : isChanged ? 10 : 6,
    color: selected ? '#172033' : isChanged ? '#facc15' : category.color,
    weight: selected ? 5 : isChanged ? 5 : 1,
    fillColor: category.color,
    fillOpacity: isChanged ? .92 : .36,
    opacity: isChanged ? 1 : .55
  });
  marker.on('click', () => {
    selectedId = feature.id;
    showDetail(feature, isChanged);
    renderMap();
  });
  const label = getLabel(feature, isChanged);
  if (label && isChanged && map.getZoom() >= 16) {
    marker.bindTooltip(escapeHtml(label).replaceAll('\n', '<br>'), {
      permanent: true,
      direction: 'right',
      offset: [12, 0],
      className: 'simple-label'
    });
  }
  marker.addTo(markerLayer);
}

function getLabel(feature, isChanged) {
  const name = feature.tags.name || '';
  if (!isChanged) return name;
  return [name, feature.user ? `@${feature.user}` : ''].filter(Boolean).join('\n');
}

function updateStats() {
  document.getElementById('beforeCount').textContent = beforeFeatures.length.toLocaleString('ja-JP');
  document.getElementById('changedCount').textContent = changedFeatures.length.toLocaleString('ja-JP');
  document.getElementById('userCount').textContent = new Set(changedFeatures.map(feature => feature.user).filter(Boolean)).size.toLocaleString('ja-JP');
}

function renderCategoryCards() {
  const counts = new Map();
  changedFeatures.forEach(feature => counts.set(feature.category, (counts.get(feature.category) || 0) + 1));
  const html = Object.entries(CATEGORIES)
    .map(([key, category]) => ({ key, category, count: counts.get(key) || 0 }))
    .filter(item => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map(({ category, count }) => `
      <div class="category-card">
        <span class="category-icon" style="background:${category.color}">${category.icon}</span>
        <div><strong>${category.label}</strong><span>${category.hint}</span></div>
        <b>${count}</b>
      </div>
    `).join('');
  document.getElementById('categoryCards').innerHTML = html;
}

function renderChangedList() {
  const items = changedFeatures
    .filter(feature => feature.tags.name)
    .slice(0, 9)
    .map(feature => {
      const category = CATEGORIES[feature.category] || CATEGORIES.other;
      return `
        <button class="changed-item" type="button" data-feature-id="${feature.id}">
          <strong>${escapeHtml(feature.tags.name)}</strong>
          <span>${category.label}${feature.user ? ` / @${escapeHtml(feature.user)}` : ''}</span>
        </button>
      `;
    }).join('');
  const list = document.getElementById('changedList');
  list.innerHTML = items || '<div class="detail-empty">名前付きの当日変更地物がありません。</div>';
  list.querySelectorAll('[data-feature-id]').forEach(button => {
    button.addEventListener('click', () => {
      const feature = changedFeatures.find(item => item.id === button.dataset.featureId);
      if (!feature) return;
      selectedId = feature.id;
      map.setView([feature.lat, feature.lon], Math.max(map.getZoom(), 17));
      showDetail(feature, true);
      renderMap();
    });
  });
}

function showDetail(feature, isChanged) {
  const category = CATEGORIES[feature.category] || CATEGORIES.other;
  document.getElementById('detailTitle').textContent = feature.tags.name || '名称なし';
  document.getElementById('detailBody').className = 'detail-body';
  document.getElementById('detailBody').innerHTML = `
    <dl>
      <dt>見え方</dt><dd>${isChanged ? '当日書かれた・直されたもの' : 'イベント前からあるもの'}</dd>
      <dt>分類</dt><dd>${category.label}</dd>
      <dt>タグ</dt><dd>${escapeHtml(getMainTag(feature.tags))}</dd>
      <dt>ユーザ</dt><dd>${feature.user ? `@${escapeHtml(feature.user)}` : '不明'}</dd>
      <dt>更新</dt><dd>${escapeHtml(feature.timestamp || '不明')}</dd>
    </dl>
  `;
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

function getMainTag(tags) {
  const keys = ['amenity', 'shop', 'leisure', 'emergency', 'highway', 'railway', 'public_transport'];
  const key = keys.find(item => tags[item]);
  return key ? `${key}=${tags[key]}` : 'その他';
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
