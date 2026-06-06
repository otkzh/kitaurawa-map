# 北浦和西口 まちの居場所マップ

2026年6月7日の「北浦和西口 まちの居場所マップづくり」成果発表用Webアプリです。

Leafletで地図を表示し、OpenStreetMap / Overpass APIから取得した生活に関わる施設をBefore / Afterで比較します。

## 方針

- Beforeは、現時点でOverpass APIから取得して保存した `data/before-osm.json` を参照します。
- 初期表示ではBefore JSONだけを読み込み、Overpass APIにはアクセスしません。
- Afterは、画面下部の「Afterを取得」ボタンを押したときだけOverpass APIから取得します。
- After判定は `survey:date=2026-06-07` または `note=北浦和居場所マッピングパーティー` を含む地点です。
- ビルド不要の静的Webアプリとして、ローカルHTTPサーバーで動かします。

## 保存済みBeforeデータ

- ファイル: `data/before-osm.json`
- OSMベース時刻: `2026-06-06T09:46:02Z`
- 日本時間換算: `2026-06-06 18:46:02`
- 要素数: `1996`

## 起動方法

```bash
python3 -m http.server 8000
```

ブラウザで以下を開きます。

```text
http://localhost:8000/
```

## Beforeデータの更新

Beforeスナップショットを取り直す場合は、以下のクエリをOverpass APIにPOSTし、結果を `data/before-osm.json` に保存します。

```bash
curl -L --max-time 120 -o data/before-osm.json --data-urlencode data@scripts/before-overpass.query https://overpass.openstreetmap.fr/api/interpreter
```

イベント開始後はBeforeの意味が変わってしまうため、通常は更新しないでください。

環境によってはOverpassミラーごとにOSMベース時刻が異なります。取得後は `data/before-osm.json` の `osm3s.timestamp_osm_base` と `elements` 件数を確認してください。

## ファイル構成

- `index.html`: アプリ本体のHTML
- `src/styles.css`: 画面スタイル
- `src/main.js`: Leaflet描画、フィルター、Overpass取得処理
- `data/before-osm.json`: Beforeとして使う保存済みOSM JSON
- `scripts/before-overpass.query`: Before取得用Overpass QL
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

地図タイルとLeaflet CDNにはインターネット接続が必要です。After取得用Overpass APIへのアクセスは、画面下部の「Afterを取得」ボタンを押した後だけ発生します。
