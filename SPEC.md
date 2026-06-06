# 北浦和西口 まちの居場所マップ Webアプリ仕様

## 目的

2026年6月7日開催の「北浦和西口 まちの居場所マップづくり」イベントで、参加者がOpenStreetMapに入力した成果を地図上で可視化し、成果発表でBefore / Afterをわかりやすく共有する。

本アプリは、Overpass APIから北浦和西口周辺のOSMデータを取得し、Leaflet上にカテゴリ別・成果別に表示する。ローカルPCでも動作し、イベント会場でのデモや発表に使えることを優先する。

Beforeはイベント前に取得した固定スナップショット `data/before-osm.json` を参照する。Afterはイベント当日のタグをもとにOverpass APIから取得する。

## 想定利用シーン

- イベント開始前に、既存のOSMデータをBeforeとして表示する。
- イベント開始前のOSMデータをJSONとして保存し、発表中はBeforeを固定する。
- 参加者が街歩き後にOSMへ入力した地点をAfterとして表示する。
- 飲食、買い物、医療、公共、子育て福祉、公園、安心設備、交通など、生活に関わる施設をカテゴリ別に確認する。
- 成果発表時に、当日の追加・更新地点数、注目タグ該当地点数、表示中の地点数を示す。
- インターネット接続があるローカル環境で、ブラウザから起動して確認する。

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

## Before / After判定

### After

以下のいずれかに該当する地点を、今回の成果として扱う。

- `survey:date` がイベント日 `2026-06-07` と一致する。
- `note` にイベント識別キーワード `北浦和居場所マッピングパーティー` を含む。

### Before

After条件に該当しないが、表示対象タグに一致する既存OSMデータをBeforeとして扱う。

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

- 「データを読み込む」ボタンでBefore JSONとAfterのOverpass APIデータを読み込む。
- 初回表示時にも自動取得する。
- Beforeは `data/before-osm.json` を参照する。
- Afterは `survey:date=2026-06-07` またはイベントnoteキーワードに一致するOSMデータをOverpass APIから取得する。
- Overpass APIは複数エンドポイントを候補に持ち、正常応答のうちOSMベース時刻が新しいものを採用する。
- 取得失敗時はエラー内容を表示する。
- Overpass APIが利用できない場合の最低限のフォールバックとして、OSM Map APIから小さめの範囲を取得できる設計とする。

### レイヤー切り替え

以下の表示ON/OFFを切り替えられる。

- Before: 既存データ
- After: 今回の成果
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
- After件数
- 注目タグ該当件数
- 現在表示中の件数

### ポップアップ

地点にマウスオーバーすると、以下の情報をポップアップ表示する。クリックでも同じ詳細を確認できる。

- 名称
- 種別
- Before / After
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

### ラベル表示

- ズームレベルが一定以上の場合、名称がある地点にラベルを表示する。
- ラベルが重なりすぎないよう、簡易的な衝突判定を行う。

## UI要件

- 発表時に見やすいよう、左側に操作パネル、右側に地図を配置する。
- モバイル幅では、上に地図、下に操作パネルを配置する。
- Afterは目立つ色で表示する。
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
- Overpass APIへの問い合わせ
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

- Overpass取得中はボタンを無効化し、読み込み中であることを表示する。
- 取得成功後は「OSMデータを再読み込み」に文言を変える。
- 取得失敗時は、利用者にエラーを表示し、再試行できる状態に戻す。
- 緯度経度を持たない要素、または中心座標を計算できないwayは表示対象から除外する。
- 同一OSM要素が重複取得された場合は1件にまとめる。

## 品質確認項目

- ローカルHTTPサーバーで起動できる。
- 初回表示で地図が表示される。
- OSMデータ読み込みボタンで地点が表示される。
- Overpass API取得失敗時に画面が壊れない。
- レイヤー切り替えが反映される。
- カテゴリフィルターが反映される。
- 年フィルターが反映される。
- ポップアップでOSMタグ情報が確認できる。
- スマートフォン幅でも地図と操作パネルが破綻しない。
- 発表用プロジェクター表示で文字・凡例・集計が読める。

## 今後の実装方針

1. 参考HTMLをワークスペース内へ移し、`index.html`として動く状態にする。
2. CSSとJavaScriptを分離し、設定値・取得処理・描画処理を整理する。
3. ローカルHTTPサーバーで起動確認する。
4. Overpass APIから実データを取得して表示確認する。
5. 発表向けにUI文言、凡例、集計の見やすさを調整する。
6. 必要に応じて取得済みデータのJSON保存・読み込み機能を追加する。
