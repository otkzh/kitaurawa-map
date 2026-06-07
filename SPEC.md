# 北浦和西口 まちの居場所マップ Webアプリ仕様

## 目的

2026年6月7日開催の「北浦和西口 まちの居場所マップづくり」イベントで、参加者がOpenStreetMapに入力した成果を地図上で可視化し、成果発表でBeforeと当日変更をわかりやすく共有する。

本アプリは、Overpass APIから北浦和西口周辺のOSMデータを取得し、Leaflet上にカテゴリ別・成果別に表示する。ローカルPCでも動作し、イベント会場でのデモや発表に使えることを優先する。

Beforeはイベント前に取得した固定スナップショット `data/before-osm.json` を参照する。初期表示ではBefore JSONだけを読み込み、MapLibre版では本日変更を利用者が取得ボタンを押したときだけOverpass APIから取得する。

## 想定利用シーン

- イベント開始前に、既存のOSMデータをBeforeとして表示する。
- イベント開始前のOSMデータをJSONとして保存し、発表中はBeforeを固定する。
- 参加者が街歩き後にOSMへ入力・更新した地点を本日変更として表示する。
- 飲食、買い物、医療、公共、子育て福祉、公園、安心設備、交通など、生活に関わる施設をカテゴリ別に確認する。
- 成果発表時に、当日の追加・更新地点数、注目タグ該当地点数、表示中の地点数を示す。
- ローカル環境でブラウザから起動し、初期表示では保存済みBeforeデータを確認する。
- MapLibre版では、必要な場合だけ当日変更地物をOverpass APIから取得して強調表示する。

## 対象エリア

北浦和駅西口周辺を対象とする。

初期設定値:

- 中心座標: `35.872, 139.645`
- 初期ズーム: `15`
- Overpass取得範囲:
  - south: `35.857`
  - west: `139.625`
  - north: `35.888`
  - east: `139.665`

取得範囲は地図上に枠で表示し、利用者が「どの範囲のデータを見ているか」を把握できるようにする。

## 表示対象データ

Overpass APIから、以下に該当するOSMのnode / wayを取得する。

### 飲食・休憩

- `amenity=cafe`
- `amenity=restaurant`
- `amenity=fast_food`
- `amenity=bar`
- `amenity=pub`
- `amenity=bench`

### 買い物・サービス

- `shop=supermarket`
- `shop=convenience`
- `shop=mall`
- `shop=department_store`
- `shop=bakery`
- `shop=greengrocer`
- `shop=butcher`
- `shop=seafood`
- `shop=deli`
- `shop=clothes`
- `shop=shoes`
- `shop=chemist`
- `shop=hairdresser`
- `shop=laundry`
- `shop=books`
- `shop=stationery`
- `shop=electronics`
- `shop=hardware`
- `shop=florist`
- `shop=variety_store`
- `shop=mobile_phone`
- `shop=optician`

### 医療・薬局

- `amenity=clinic`
- `amenity=doctors`
- `amenity=dentist`
- `amenity=hospital`
- `amenity=pharmacy`

### 公共・金融・郵便

- `amenity=community_centre`
- `amenity=library`
- `amenity=bank`
- `amenity=post_office`
- `amenity=post_box`
- `amenity=police`
- `amenity=fire_station`
- `amenity=townhall`

### 子ども・福祉・学び

- `amenity=social_facility`
- `amenity=childcare`
- `amenity=kindergarten`
- `amenity=school`

### 公園・屋外滞在

- `leisure=park`
- `leisure=playground`

### 安心設備

- `amenity=toilets`
- `amenity=drinking_water`
- `emergency=defibrillator`

### 交通・バリアフリー

- `highway=bus_stop`
- `railway=station`
- `railway=halt`
- `railway=tram_stop`
- `public_transport=station`
- `public_transport=stop_position`
- `public_transport=platform`
- `amenity=bicycle_parking`
- `amenity=parking`
- 取得対象施設に付与された `wheelchair=*` や `toilets:wheelchair=*`

### イベント成果として扱うデータ

- `survey:date=2026-06-07`
- または `note` に `北浦和居場所マッピングパーティー` を含むもの

## Beforeスナップショット

`data/before-osm.json` は、イベント前にOverpass APIから取得したOSM JSONを保存したものとする。

現在の保存状態:

- 取得元: Overpass API
- OSMベース時刻: `2026-06-06T09:46:02Z`
- 日本時間換算: `2026-06-06 18:46:02`
- 要素数: `1996`

イベント開始後はBeforeの基準が変わるため、通常はこのJSONを更新しない。

## Before / 成果判定

### After

以下のいずれかに該当する地点を、今回の成果として扱う。

- `survey:date` がイベント日 `2026-06-07` と一致する。
- `note` にイベント識別キーワード `北浦和居場所マッピングパーティー` を含む。

### Before

After条件に該当しないが、表示対象タグに一致する既存OSMデータをBeforeとして扱う。

### 本日変更

MapLibre版では、日本時間 `2026-06-07 00:00` 以降に変更された範囲内のタグ付きOSM要素を、Overpass APIの `newer` 条件で取得できる。UTC条件は `2026-06-06T15:00:00Z` とする。取得した要素は黄色い外枠で強調し、Beforeと同じOSM要素IDの場合は既存表示に強調状態を付与する。

## カテゴリ分類

取得した地点は、タグに応じて以下のカテゴリに分類する。

| カテゴリ | 主な判定タグ | 表示意図 |
| --- | --- | --- |
| 飲食・休憩 | `amenity=cafe`, `amenity=restaurant`, `amenity=fast_food`, `amenity=bar`, `amenity=pub` | 食事や休憩に使える場所 |
| 買い物・サービス | `shop=*` の主要生活店舗 | 日用品・買い物・サービス |
| 医療・薬局 | `amenity=clinic`, `amenity=doctors`, `amenity=dentist`, `amenity=hospital`, `amenity=pharmacy` | 医療や薬に関わる場所 |
| 公共・金融・郵便 | `amenity=community_centre`, `amenity=library`, `amenity=bank`, `amenity=post_office`, `amenity=police` など | 公共サービスや手続き |
| 子ども・福祉・学び | `amenity=social_facility`, `amenity=childcare`, `amenity=kindergarten`, `amenity=school` | 支援・ケア・学びの場所 |
| 公園・屋外滞在 | `leisure=park`, `leisure=playground`, `amenity=bench` | 屋外で過ごせる場所 |
| トイレ・AED・安心設備 | `amenity=toilets`, `amenity=drinking_water`, `emergency=defibrillator` | 安心して歩くための設備 |
| 交通・バリアフリー | `highway=bus_stop`, `railway=*`, `public_transport=*`, `amenity=parking`, `amenity=bicycle_parking`, `wheelchair=*` | 移動や利用しやすさの情報 |
| その他 | 上記に該当しないが取得対象に含まれるもの | 補助表示 |

## 主要機能

### 地図表示

- Leafletで地図を表示する。
- 初期背景地図はOpenStreetMapとする。
- 背景地図として以下を切り替えられるようにする。
  - OpenStreetMap
  - 地理院地図 標準
  - 地理院航空写真
- スケールバーを表示する。

### OSMデータ取得

- 初期表示では `data/before-osm.json` だけを自動で読み込む。
- 初期表示時にはOverpass APIへアクセスしない。
- Leaflet版では、画面下部の「Afterを取得」ボタンを押したときだけ、`survey:date=2026-06-07` またはイベントnoteキーワードに一致するOSMデータをOverpass APIから取得する。
- MapLibre版では「本日変更を取得」ボタンを押したときだけ、日本時間 `2026-06-07 00:00` 以降に変更された範囲内のタグ付きOSM要素をOverpass APIから取得する。
- MapLibre版ではAfter表示を行わず、本日変更を成果確認モードとして扱う。
- Overpass APIは複数エンドポイントを候補に持ち、正常応答のうちOSMベース時刻が新しいものを採用する。
- 取得失敗時はエラー内容を表示する。
- Overpass APIが利用できない場合の最低限のフォールバックとして、OSM Map APIから小さめの範囲を取得できる設計とする。

### レイヤー切り替え

以下の表示ON/OFFを切り替えられる。

- Before: 既存データ
- 本日変更: 当日変更地物の強調表示
- 注目タグ強調

### カテゴリフィルター

以下のカテゴリを個別にON/OFFできる。

- 飲食・休憩
- 買い物・サービス
- 医療・薬局
- 公共・金融・郵便
- 子ども・福祉・学び
- 公園・屋外滞在
- トイレ・AED・安心設備
- 交通・バリアフリー

### 年フィルター

- OSM要素の作成・更新タイムスタンプから年を取得する。
- 「以降」「以前」の2つのスライダーで表示年範囲を調整する。
- 日付なしデータを含めるかどうかを切り替えられる。

### 集計表示

サイドパネルに以下を表示する。

- Before件数
- 本日変更件数
- 現在表示中の件数

### 詳細表示

地点をクリックすると、右カラムに以下の情報を表示する。地図上のポップアップは使わず、地図操作の軽さと読みやすさを優先する。

- 名称
- 種別
- Before / 本日変更
- 該当注目タグ
- カテゴリ
- 営業時間
- 電話番号
- Webサイト
- 住所
- アクセス
- 料金
- 車いす対応
- トイレ情報
- 最終調査日
- 座標
- メモ
- OSM詳細ページへのリンク

### 軽量化

- LeafletはCanvas描画を優先する。
- 注目タグ強調は重複マーカーを重ねず、単一マーカーの線色・線幅で表現する。
- 初期表示ではBefore JSONのみを読み込み、本日変更取得ボタンを押すまでMapLibre版はOverpass APIへアクセスしない。

### ラベル表示

- ズームレベルが一定以上の場合、名称がある地点にラベルを表示する。
- ラベルが重なりすぎないよう、簡易的な衝突判定を行う。

## UI要件

- 発表時に見やすいよう、左側に操作パネル、右側に地図を配置する。
- モバイル幅では、上に地図、下に操作パネルを配置する。
- 本日変更は黄色い外枠で目立つように表示する。
- Beforeは控えめな色で表示する。
- カテゴリごとに色を分ける。
- 凡例を表示し、色の意味がすぐわかるようにする。
- 参考チラシのトーンに合わせ、親しみやすく明るい見た目にする。ただし操作画面として情報が読み取りやすいことを優先する。

## ローカル動作要件

### 最小構成

静的ファイルとして動作する構成を基本とする。

想定ファイル:

- `index.html`
- `src/main.js`
- `src/styles.css`
- `README.md`
- `SPEC.md`

### 起動方法

ローカル確認では、以下のような簡易HTTPサーバーで起動できること。

```bash
python3 -m http.server 8000
```

ブラウザでは以下を開く。

```text
http://localhost:8000/
```

### ネットワーク要件

以下の外部通信が必要。

- Leaflet CSS / JSの取得
- 背景地図タイルの取得
- Leaflet版のAfter取得ボタン押下後のOverpass APIへの問い合わせ
- MapLibre版の本日変更取得ボタン押下後のOverpass APIへの問い合わせ
- OSM詳細ページへのリンク表示

発表時の安定性を上げるため、将来的にはLeafletのローカル同梱や、取得済みOSMデータのキャッシュJSON読み込みも検討する。

## 設定値

イベントごとに変更する値は、コード上部または設定ファイルにまとめる。

| 設定名 | 初期値 | 用途 |
| --- | --- | --- |
| `EVENT_DATE` | `2026-06-07` | After判定に使う調査日 |
| `EVENT_NOTE_KEYWORD` | `北浦和居場所マッピングパーティー` | After判定に使うnoteキーワード |
| `BOUNDS` | 北浦和西口周辺 | Overpass取得範囲 |
| `CENTER` | `35.872, 139.645` | 地図初期中心 |
| `ZOOM` | `15` | 地図初期ズーム |

## エラー・例外時の挙動

- Before JSON取得中は状態表示で読み込み中であることを示す。
- 取得中はボタンを無効化し、読み込み中であることを表示する。
- 取得成功後は再取得できる文言に変える。
- 取得失敗時は、Before表示を維持したまま利用者にエラーを表示し、再試行できる状態に戻す。
- 緯度経度を持たない要素、または中心座標を計算できないwayは表示対象から除外する。
- 同一OSM要素が重複取得された場合は1件にまとめる。

## 品質確認項目

- ローカルHTTPサーバーで起動できる。
- 初回表示で地図とBefore地点が表示される。
- 初回表示時にOverpass APIへアクセスしない。
- MapLibre版の本日変更取得ボタンで当日変更地物が強調表示される。
- Overpass API取得失敗時にBefore表示が壊れない。
- レイヤー切り替えが反映される。
- カテゴリフィルターが反映される。
- 年フィルターが反映される。
- クリックした地点のOSMタグ情報が右カラムで確認できる。
- スマートフォン幅でも地図と操作パネルが破綻しない。
- 発表用プロジェクター表示で文字・凡例・集計が読める。

## 今後の実装方針

1. 参考HTMLをワークスペース内へ移し、`index.html`として動く状態にする。
2. CSSとJavaScriptを分離し、設定値・取得処理・描画処理を整理する。
3. ローカルHTTPサーバーで起動確認する。
4. Overpass APIから実データを取得して表示確認する。
5. 発表向けにUI文言、凡例、集計の見やすさを調整する。
6. 必要に応じて取得済みデータのJSON保存・読み込み機能を追加する。
