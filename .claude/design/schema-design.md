# v1 スキーマ設計 (YAML / Zod 実装仕様)

[data-model.md](data-model.md) の論理データモデルを **YAML 形式・Zod スキーマでどう表現するか** を確定させた仕様。フィールド命名・enum 値・参照方式・ファイル形式の決定事項を集約。

## 設計方針 (確定事項)

| 項目 | 採用 | 理由 |
|---|---|---|
| **フィールド名** | 英語キー | TS/Zod の取り回しが楽。日本語ラベルは表示層 (`src/lib/labels.ts`) で1箇所に集約 |
| **スキーマ構造** | YAML 構造を反映 (案A) | `public` / `excelOnly` / `selfOnly` セクションをそのままスキーマに保持。展開はページ側で `data-loader` ヘルパで |
| **マスタ系の構造** | 全部セクション化 | TechTag/IndustryTag/Role すべて `public:` でラップ。`selfOnly` は **optional** に持たせる (将来 memo 追加可) |
| **マスタ系のトップレベル** | object 形式 | `{react: {...}, typescript: {...}}` で key が id。array 形式は不採用 |
| **エンティティ間参照** | id 参照 | `techTags: [react, typescript]` のような id 配列。リネーム耐性 + ID 安定性 |
| **id 命名規約** | kebab-case | `react-18`, `public-sector` 等 |
| **Period (期間) の表現** | 文字列 (`"YYYY-MM"`) | YAML で読みやすい。Zod で regex 検証 |
| **Date (日付) の表現** | 文字列 (`"YYYY-MM-DD"`) | 同上 |

## 表示レベル (3階層)

すべて [data-model.md](data-model.md) の通り。3 セクション (`public` / `excelOnly` / `selfOnly`) を YAML で明示し、ビルドモードで展開を切り替える。

| セクション | 公開Web | Excel | ローカル |
| --- | --- | --- | --- |
| `public` | ○ | ○ | ○ |
| `excelOnly` | ✕ | ○ | ○ |
| `selfOnly` | ✕ | ✕ | ○ |

## エンティティ別 YAML 仕様

### Engineer (`private/engineer.yaml`)

```yaml
me:                       # singleton。id key は `me` 固定
  public:
    name: MM              # ぼかし表記 (イニシャル等) で記載。実名は yaml に書かない (data-model.md 参照)
    gender: 男性          # "男性" | "女性"
    nationality: 日本
    finalEducation: 関東私文大学卒    # ぼかし表記で記載。実名校名は yaml に書かない (data-model.md 参照)
    workableArea: 都内
    overtime:
      available: true
      maxHoursPerMonth: 180   # available=false の場合は省略可
    weekendWork: 不可     # "可" | "不可" | "応相談"
    businessTrip: 応相談   # "可" | "不可" | "応相談"
    domainKnowledge: BtoB Web システム開発
    selfPr: |
      自己PR本文 (複数行可)
    qualifications:
      - name: 基本情報技術者
        acquiredYearMonth: "2015-04"     # YYYY-MM 文字列
  excelOnly:
    birthDate: "1990-01-01"               # optional / YYYY-MM-DD 文字列。年齢の算出元
    station:                               # optional / 全体オブジェクト
      line: ○○線
      station: ○○駅
      walkMinutes: 5                      # optional
      busMinutes: 10                       # optional (どちらか or 両方)
    workableFrom: "2026-05-01"             # optional / YYYY-MM-DD 文字列
```

> **`excelOnly` の optional 化について** (2026-04-26 追記): 元 Excel に生年月日が無く、移行直後は空のまま運用するため、`birthDate` / `station` / `workableFrom` を **optional** に変更。Excel 出力 / 表示層は undefined を許容する実装にする。
>
> **`name` を public に格上げ** (2026-04-26 追記): 当初は `excelOnly` に置いていたが、ぼかし表記 (例: `MM`) で yaml に書く方針 (実名は書かない) に変更したため、Web/Excel/local 全配布形態で同一表示にするよう `public` セクションへ移動。

派生フィールド (Engineer):

- `age` ← `excelOnly.birthDate` から計算 (公開 Web では年齢のみ表示、生年月日は出さない)
- `experienceYears` ← 全 Project の `period` から算出

### Project (`private/projects/<slug>.yaml`、1案件 = 1ファイル)

```yaml
visibility: default       # "default" | "stats_only" | "archived" (デフォルト: default)
public:
  no: 1                   # 通し番号
  name: サンプル案件      # 顧客名 or "某〇〇" (実名は契約上承諾済の場合のみ)
  period:
    start: "2024-01"      # YYYY-MM 文字列
    end: null             # YYYY-MM 文字列 or null (進行中)
  summary: |
    案件概要 (複数行可)
  role: se                # Role の id を参照
  scale:
    total: 10             # プロジェクト全体人数 (整数)
    team: 3               # 自分のチーム人数 (整数)
  phases:                  # 6種フラグ。担当した工程のみ true
    requirements: true     # 要件定義
    basicDesign: true       # 基本設計
    detailDesign: true      # 詳細設計
    implementation: true    # 製造
    test: true              # テスト
    maintenance: false      # 保守
  techTags: [react, typescript]    # TechTag の id 配列
  industryTags: [web]               # IndustryTag の id 配列
  parallel: false                   # 並行参画フラグ
  details:                          # 全フィールド optional (任意で記載)
    businessPurpose: |
      ビジネス上の目的
    systemOverview: |
      システム概要
    contribution: |
      役割・貢献点
selfOnly:
  memo: |
    面談で聞かれたら話すメモ
```

派生フィールド (Project):

- `periodLabel` ← `period.start` / `period.end` から "X年Yヶ月" を計算

### TechTag (`private/tech-tags.yaml`、object 形式)

```yaml
react:                    # key = id (kebab-case)
  public:
    name: React           # 表示名
    baseName: React        # フィルタ集約用 (バージョン違いをまとめる base)
    category: Framework    # 7分類のいずれか
react-18:
  public:
    name: React 18
    baseName: React        # ← React と同じ baseName で集約
    category: Framework
  selfOnly:                 # optional、memo がある場合のみ
    memo: |
      React 18 と聞かれたら〜
typescript:
  public:
    name: TypeScript
    baseName: TypeScript
    category: Language
```

カテゴリ enum (7分類):

- `Language` / `Framework` / `OS` / `Middleware` / `Database` / `Tool` / `Cloud`

派生フィールド (TechTag):

- `cumulativeYears` ← `baseName` で集約した Project 群の期間合計 (`archived` 除外、`stats_only` 含む)
- `projectCount` ← 同集計ルールで件数

### IndustryTag (`private/industry-tags.yaml`、object 形式)

```yaml
web:                       # key = id
  public:
    name: Web
    description: 一般的なWebサービス  # optional
public-sector:
  public:
    name: 公共
# selfOnly セクションはスキーマに optional として存在するが、v1 では使用しない
```

### Role (`private/roles.yaml`、object 形式)

```yaml
pm:                        # key = id
  public:
    name: PM
    rank: 1                # 表示順 (小さいほど上位)
pl:
  public:
    name: PL
    rank: 2
se:
  public:
    name: SE
    rank: 3
# selfOnly セクションはスキーマに optional として存在するが、v1 では使用しない
```

## enum 値の確定一覧

| エンティティ | フィールド | 値 |
| --- | --- | --- |
| Engineer | gender | `男性` / `女性` |
| Engineer | weekendWork / businessTrip | `可` / `不可` / `応相談` |
| Project | visibility | `default` / `stats_only` / `archived` |
| TechTag | category | `Language` / `Framework` / `OS` / `Middleware` / `Database` / `Tool` / `Cloud` |
| Project | phases.* (6種フィールド名) | `requirements` / `basicDesign` / `detailDesign` / `implementation` / `test` / `maintenance` |

## ファイル配置

```text
private/                              # gitignore 済
  engineer.yaml                       # Engineer (singleton, id="me")
  projects/                           # 1案件 = 1ファイル (glob loader)
    01-public-sector-dx.yaml
    02-...
  tech-tags.yaml                      # TechTag マスタ (object 形式)
  industry-tags.yaml                  # IndustryTag マスタ (object 形式)
  roles.yaml                          # Role マスタ (object 形式)
```

## 拡張性の余地 (将来追加可能性のメモ)

### v1 で廃止したが復活余地あり

- **LanguageSkill (TOEIC/英検/4軸スキル)** — Engineer の sub-entity として `public.languageSkill` に追加可
- **TechTag.evaluationLevel (A〜E)** — TechTag の `public.evaluationLevel` として追加可。MM の評価指標を再導入する形

### v2 で予定 (data-model.md「将来拡張枠」より)

- **OutputProfile** — `Project.public.profiles: string[]` (デフォルト空配列 = 全 Profile に表示) として非破壊で追加可
- **`/admin/` ダッシュボード** — 既存スキーマに変更なし、ローカルビルドのみのページ追加
- **案件管理機能** — 別エンティティ群 (`Lead`, `Interview` 等)。スキーマ独立、共通参照は TechTag/IndustryTag のみ

### スキーマ自体の拡張余地

- **`details` フィールドへの追加** — Project の任意セクションなので、新規任意フィールドは非破壊で追加可
- **マスタ系の `selfOnly`** — IndustryTag/Role に `selfOnly.memo` を追加する余地は残してある (schema にも optional で定義する方針)
- **新カテゴリ** — TechTag の 7分類に追加が必要になれば enum を拡張 (既存値は変更不可)
- **新 visibility** — `default` / `stats_only` / `archived` の3値以外の状態が必要になれば enum 拡張

## 移行時に決まる範囲 (migration script で生成、後で手動レビュー)

- `Project.visibility` の初期値: 全件 `default`、ユーザが手動で `archived` / `stats_only` に振り分け
- `Project.industryTags` の初期値: 自動推定 (キーワードマッチ) で候補出力、ユーザが採否決定
- `Project.private_memo` の初期値: 空、ユーザが面談前に追記
- `TechTag.baseName` の初期値: 自動推定 (バージョン文字列剥がし) で出力、ユーザが確認・修正
- `TechTag.category` の初期値: 自動推定 (簡易ルール) で出力、ユーザが確認・修正
- `Role` マスタの初期値: Excel から正規化して出力、ユーザが `rank` を設定

## サンプル YAML データの方針

**完全プレースホルダー**: スキーマ動作確認のためだけの最小データ。`name: "サンプル案件"` 程度の中身。後で migration script により全件上書きされる前提。
