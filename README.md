# 北浦和西口 まちの居場所マップ

2026年6月7日の「北浦和西口 まちの居場所マップづくり」成果発表用Webアプリです。

MapLibre版とLeaflet版で、保存済みBeforeを起点に本日変更された地物を強調表示します。

## 方針

- Beforeは、現時点でOverpass APIから取得して保存した `data/before-osm.json` を参照します。
- 初期表示では保存済みJSONだけを読み込み、Overpass APIにはアクセスしません。
- 両方の版でAfter表示を使わず、初回は `data/changed-osm.json` の本日変更を表示します。
- 日本時間 `2026-06-07 00:00` 以降に変更された範囲内の地物を黄色い外枠で強調します。
- JSON更新ボタンは一時停止中のため、画面からOverpass APIへの再取得はできません。
- ビルド不要の静的Webアプリとして、ローカルHTTPサーバーで動かします。

## 保存済みBeforeデータ

- ファイル: `data/before-osm.json`
- OSMベース時刻: `2026-06-06T09:46:02Z`
- 日本時間換算: `2026-06-06 18:46:02`
- 要素数: `1996`

## 保存済み本日変更データ

- ファイル: `data/changed-osm.json`
- 条件: 日本時間 `2026-06-07 00:00` 以降の変更、UTC `2026-06-06T15:00:00Z` 以降
- OSMベース時刻: `2026-06-07T06:53:09Z`
- 要素数: `232`
- タグ付き要素数: `193`

## 起動方法

```bash
python3 -m http.server 8000
```

ブラウザで以下を開きます。

```text
http://localhost:8000/
```

`index.html` はMapLibre版です。Before JSONなどのデータはLeaflet版と共通です。

Leaflet版は補助版として以下から開けます。

```text
http://localhost:8000/leaflet.html
```

OSMを知らない人向けの簡易版は以下から開けます。

```text
http://localhost:8000/simple.html
```

メインのMapLibre版では、OpenFreeMapのベクタータイル、OpenStreetMap、地理院地図標準、地理院航空写真を切り替えられます。両方の版で本日変更地物を強調でき、本日変更ラベルには必要に応じてOSMユーザ名も表示できます。

## Beforeデータの更新

Beforeスナップショットを取り直す場合は、以下のクエリをOverpass APIにPOSTし、結果を `data/before-osm.json` に保存します。

```bash
curl -L --max-time 120 -o data/before-osm.json --data-urlencode data@scripts/before-overpass.query https://overpass.openstreetmap.fr/api/interpreter
```

イベント開始後はBeforeの意味が変わってしまうため、通常は更新しないでください。

環境によってはOverpassミラーごとにOSMベース時刻が異なります。取得後は `data/before-osm.json` の `osm3s.timestamp_osm_base` と `elements` 件数を確認してください。

## 本日変更データの更新

保存済み本日変更を取り直す場合は、以下のクエリをOverpass APIにPOSTし、結果を `data/changed-osm.json` に保存します。

```bash
curl -L --max-time 120 -o data/changed-osm.json --data-urlencode data@scripts/changed-overpass.query https://overpass.openstreetmap.fr/api/interpreter
```

## ファイル構成

- `index.html`: MapLibre版アプリ本体のHTML
- `leaflet.html`: Leaflet版アプリのHTML
- `simple.html`: OSMを知らない人向けの簡易版HTML
- `src/styles.css`: 画面スタイル
- `src/simple.css`: 簡易版の画面スタイル
- `src/main.js`: Leaflet描画、フィルター、Overpass取得処理
- `src/maplibre-main.js`: MapLibre描画、フィルター、Overpass取得処理
- `src/simple.js`: 簡易版の描画処理
- `data/before-osm.json`: Beforeとして使う保存済みOSM JSON
- `data/changed-osm.json`: 本日変更として使う保存済みOSM JSON
- `scripts/before-overpass.query`: Before取得用Overpass QL
- `scripts/changed-overpass.query`: 本日変更取得用Overpass QL
- `SPEC.md`: 仕様書

## 表示対象

- 飲食・休憩
- 買い物・サービス
- 医療・薬局
- 公共・金融・郵便
- 子ども・福祉・学び
- 公園・屋外滞在
- トイレ・AED・安心設備
- 交通・バリアフリー

## 操作と軽量化

- 地点をクリックすると、右カラムに詳細を表示します。
- 地図上のポップアップは使わず、詳細表示を右カラムに固定しています。
- LeafletはCanvas描画を優先し、注目タグ強調も重複マーカーを使わず単一マーカーの線で表現します。

## 注意

地図タイルとCDNにはインターネット接続が必要です。初期表示では保存済みJSONだけを読み込み、Overpass APIにはアクセスしません。JSON更新ボタンは一時停止中です。
