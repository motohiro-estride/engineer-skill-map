# v1 コードアーキテクチャ (責任分解)

各モジュールの **役割・入出力・副作用境界** を明示する。実装時はこの仕様に沿ってファイルを配置・編集する。

## 設計原則

1. **関心の分離**: 「定義」「ロジック」「設定」「データ取得」「描画」「外部依存」を別モジュールに分ける
2. **純粋関数優先**: 副作用 (I/O、env 読み取り等) は明確に境界化
3. **データの流れは一方向**: YAML (private/) → Content Layer → page → component
4. **ページ層がオーケストレーター**: データ取得・展開・派生計算の組み立ては page で。component は受け取って描画
5. **外部パッケージは libs 経由**: yarn で導入したパッケージは `src/libs/<package>/` のラッパーを経由してのみ使う。`src/domain/` `src/pages/` `scripts/` から直接 import しない
6. **Barrel Export 規約**: 各 `src/` 配下のフォルダ (`config/`, `schemas/`, `libs/<package>/`, `domain/`) に `index.ts` を置き、これを **公開 API** とする。`index.ts` は **re-export 専用** (実装を書かない)。実装は同フォルダ内の別ファイルに置く。フォルダ外からの import は必ず `index.ts` 経由 (例: `import { ProjectFile } from "@/schemas"`)
7. **スクリプトは独立**: migration / build-excel / verify はページとは独立、`src/schemas` `src/domain` `src/libs` `src/config` を共有して使う

## ディレクトリ構造 (実装時)

```text
src/
├── content.config.ts                 # Astro Content Layer のエントリ (設定のみ)
├── config/
│   ├── index.ts                       # barrel: export * from "./config"
│   └── config.ts                      # 実装: env 読み取り、設定値
├── schemas/
│   ├── index.ts                       # barrel: 全 schema を re-export
│   ├── common.ts                      # 実装
│   ├── engineer.ts                    # 実装
│   ├── project.ts                     # 実装
│   ├── tech-tag.ts                    # 実装
│   ├── industry-tag.ts                # 実装
│   └── role.ts                        # 実装
├── libs/                             # 外部パッケージのラッパー (パッケージ単位フォルダ)
│   ├── exceljs/
│   │   ├── index.ts                   # barrel
│   │   └── <impl>.ts                  # 実装: Workbook 操作・共通スタイル等
│   ├── js-yaml/
│   │   ├── index.ts                   # barrel
│   │   └── <impl>.ts                  # 実装: YAML 安全パース等
│   └── ...
├── domain/                           # アプリ固有ロジック (純粋関数中心)
│   ├── index.ts                       # barrel: 全 domain ロジックを re-export
│   ├── data-loader.ts                 # 実装
│   ├── visibility.ts                  # 実装
│   ├── derivations.ts                 # 実装
│   ├── references.ts                  # 実装
│   └── labels.ts                      # 実装
├── pages/                            # Astro routing 対象 (barrel 不要、Astro が直接ロード)
│   ├── index.astro
│   ├── projects/
│   │   └── [slug].astro
│   └── tags/
│       └── [name].astro
├── components/                       # 個別 import (barrel 不要、参照頻度低い)
│   ├── ProjectCard.astro
│   ├── TagChip.astro
│   ├── ProfileSection.astro
│   ├── FilterUI.tsx
│   └── ...
└── styles/
    └── globals.css

scripts/                              # 独立スクリプト (build-time / 手動実行)
├── migrate-excel.ts                   # Excel → YAML 一回きり移行
├── build-excel.ts                     # YAML → xlsx 出力
└── verify-no-leak.ts                  # public ビルド成果物の漏洩チェック
```

> **Note**: `pages/` `components/` には `index.ts` を置かない。Astro pages はファイルパス = ルートで `index.ts` の barrel と相性が悪く、components は通常個別 import で十分なため。

## モジュール別 責務一覧

### `src/config/`

#### 構成
- `config/index.ts` — **barrel** (`export * from "./config";` のみ)
- `config/config.ts` — **実装**: env 読み取り、設定値の定義

**役割**: 環境変数の読み取りと検証、設定値の定義。**env 副作用の境界はこのフォルダだけ**。
**入力**: `import.meta.env.*`
**出力**: 設定値 (BUILD_MODE 等) と判定関数 (`getBuildMode()` 等)
**副作用**: env 読み取り (`config.ts` のみ)
**依存**: なし
**外からの import**: `import { getBuildMode, BuildMode } from "@/config"`

```ts
// config/config.ts
export type BuildMode = "public" | "excel" | "local";
export function getBuildMode(): BuildMode { /* ... */ }

// config/index.ts
export * from "./config";
```

### `src/schemas/`

#### 構成
- `schemas/index.ts` — **barrel** (全 schema/型を re-export)
- `schemas/common.ts` — 共通型 (visibility, period, dateSchema 等)
- `schemas/{engineer,project,tech-tag,industry-tag,role}.ts` — 各エンティティの schema 定義

**役割**: Zod スキーマ定義と TypeScript 型エクスポート。
**入力**: なし (定義のみ)
**出力**: `*Schema` (Zod) と `*File` / `*` (型)
**副作用**: なし
**依存**: `zod` のみ (例外として直接 import 可)
**外からの import**: `import { ProjectFile, projectFileSchema } from "@/schemas"`

```ts
// schemas/project.ts
export const projectFileSchema = z.object({ /* ... */ });
export type ProjectFile = z.infer<typeof projectFileSchema>;

// schemas/index.ts
export * from "./common";
export * from "./engineer";
export * from "./project";
export * from "./tech-tag";
export * from "./industry-tag";
export * from "./role";
```

> **Note**: `zod` は schemas 内で直接 import する数少ない例外。型システムそのもので、libs ラッパーで包む意味が薄い。

### `src/libs/<package>/`

#### 構成
- `<package>/index.ts` — **barrel**
- `<package>/<impl>.ts` — 実装 (パッケージ固有の設定・共通操作の集約)

**役割**: 外部パッケージ (yarn 導入物) のラッパー。**パッケージ固有の設定・お作法・共通操作**を実装ファイルに集約し、`index.ts` で公開する。
**入力**: 外部パッケージの API
**出力**: アプリ用に整えた関数・定数
**副作用**: パッケージ依存 (ファイル I/O 等)
**依存**: 該当パッケージのみ
**外からの import**: `import { writeWorkbook } from "@/libs/exceljs"` (常に index.ts 経由、内部 `<impl>.ts` は import しない)

**ルール**:
- 1 パッケージ = 1 フォルダ (`src/libs/exceljs/`, `src/libs/js-yaml/` 等)
- `index.ts` は re-export 専用、実装を書かない
- 実装ファイルの数・名前はパッケージごとに自由 (`workbook.ts` `parser.ts` `internals/...` など)
- アプリ固有のドメインロジックは入れない (それは `domain/` で組み立てる)

```ts
// libs/exceljs/workbook.ts
import ExcelJS from "exceljs";
export const HEADER_STYLE = { /* ... */ };
export async function readWorkbook(path: string) { /* ... */ }

// libs/exceljs/index.ts
export * from "./workbook";
```

### `src/content.config.ts`

**役割**: Astro Content Layer に各 collection を登録。loader と schema をひも付け。
**入力**: schema (`@/schemas`)
**出力**: `collections` (Astro Content API のエントリ)
**副作用**: ビルド時に `private/` 配下の YAML を読む (Content Layer 経由)
**依存**: `astro:content` `astro/loaders` `@/schemas`

> **Note**: `astro:content` `astro/loaders` は Astro の組み込み API のため、libs ラッパーを介さず直接 import してよい (例外)。

### `src/domain/`

#### 構成
- `domain/index.ts` — **barrel** (全 domain ロジックを re-export)
- `domain/data-loader.ts` — 実装: section 展開
- `domain/visibility.ts` — 実装: 表示判定
- `domain/derivations.ts` — 実装: 派生フィールド算出
- `domain/references.ts` — 実装: id 参照解決
- `domain/labels.ts` — 実装: 表示ラベル変換

**役割**: アプリ固有のロジック層。すべて純粋関数中心、副作用なし。
**入力**: schemas の型に従ったデータ + 必要に応じて `BuildMode`
**出力**: 加工後の業務オブジェクト・派生値・boolean・文字列等
**副作用**: なし (現在日付等は引数で注入)
**依存**: `@/schemas` `@/config` (一部)
**外からの import**: `import { expandProject, isProjectVisible, calculateAge } from "@/domain"`

```ts
// domain/index.ts
export * from "./data-loader";
export * from "./visibility";
export * from "./derivations";
export * from "./references";
export * from "./labels";
```

#### 各実装ファイルの API 概要

| ファイル | 主要 export |
|---|---|
| `data-loader.ts` | `expandProject(file, mode)`, `expandEngineer(file, mode)` |
| `visibility.ts` | `isProjectVisible(visibility, mode)`, `isProjectInStats(visibility)` |
| `derivations.ts` | `calculateAge(birthDate, asOf?)`, `calculateExperienceYears(projects)`, `calculatePeriodLabel(period)`, `calculateTagCumulativeYears(baseName, projects)`, `calculateTagProjectCount(baseName, projects)` |
| `references.ts` | `resolveRole(id, roles)`, `resolveTechTags(ids, tags)` 等 |
| `labels.ts` | `phaseLabel(key)`, `visibilityLabel(value)`, `categoryLabel(value)` 等 |

### `src/pages/*.astro`

**役割**: ページ単位のオーケストレーション。
- `getCollection` で Content Layer からデータ取得
- `@/domain` の関数で BUILD_MODE 別展開・派生計算・参照解決
- props を構成して components に渡す
- レイアウト全体を組む

**副作用**: あり (Astro のビルド時 I/O)
**依存**: `astro:content`, `@/config`, `@/domain`, `@/components/*`

### `src/components/*.astro` `*.tsx`

**役割**: 表示専用。**props で受け取ったデータを描画するだけ**。
- データ取得・加工・派生計算は **しない**
- React component (`*.tsx`) は island として client-side 動作 (フィルタ UI 等)
- barrel 不要、page から個別に import

**副作用**: 描画のみ
**依存**: 親 (page) から props

### `scripts/migrate-excel.ts`

**役割**: 一回きりの Excel → YAML 移行。
**入力**: `private/スキルシート（MM）.xlsx` `private/スキルシート.xlsx`
**出力**: `private/engineer.yaml` `private/projects/*.yaml` `private/tech-tags.yaml` 等
**副作用**: ファイル I/O
**依存**: `@/libs/exceljs`, `@/libs/js-yaml`, `@/schemas` (validation 用)
**重要**: `exceljs` `js-yaml` を **直接 import しない**。`@/libs/exceljs` `@/libs/js-yaml` のラッパー越しに使う。

### `scripts/build-excel.ts`

**役割**: YAML データから Excel ファイルを生成。
**入力**: `private/*.yaml`
**出力**: `output/*.xlsx`
**副作用**: ファイル I/O
**依存**: `@/libs/exceljs`, `@/libs/js-yaml`, `@/schemas`, `@/domain`
**重要**: 同上、libs 経由でのみ外部パッケージを使う。

### `scripts/verify-no-leak.ts`

**役割**: public ビルド成果物 (`dist/`) に excelOnly/selfOnly のフィールド値が漏れていないか検査。
**入力**: `private/*.yaml` (漏洩したらまずい値の blacklist 生成元) と `dist/` 内の全ファイル
**出力**: 検出ゼロなら exit 0、1件でも検出なら exit 1 (deploy ブロック)
**副作用**: ファイル I/O
**依存**: `@/libs/js-yaml`, `@/schemas`

## データフロー図

```text
private/*.yaml  ──[Astro Content Layer]──→  collection エントリ (Zod 検証済)
                                                  │
                                                  ▼
                                        src/pages/*.astro
                                                  │
                           [getCollection] [@/config: getBuildMode]
                                                  │
                            ┌─────[@/domain: expandProject / expandEngineer]
                            │
                            ├─────[@/domain: isProjectVisible / isProjectInStats]
                            │
                            ├─────[@/domain: calculateAge / calculateTagCumulativeYears 等]
                            │
                            ├─────[@/domain: resolveRole / resolveTechTags]
                            │
                            ▼
                        props 構成
                            │
                            ▼
                    src/components/* (描画のみ)
                            │
                            ▼
                       静的 HTML 出力 (dist/)
                            │
                  [scripts/verify-no-leak (uses @/libs/js-yaml) で検査]
                            │
                            ▼
                  yarn deploy → gh-pages branch


移行時 (一回きり):
private/*.xlsx  ──[scripts/migrate-excel via @/libs/exceljs, @/libs/js-yaml]──→  private/*.yaml

Excel 出力 (build-time):
private/*.yaml ──[scripts/build-excel via @/libs/js-yaml, @/libs/exceljs, @/domain]──→ output/*.xlsx
```

## 副作用境界 (一覧)

| モジュール | 副作用 | 説明 |
|---|---|---|
| `src/config/config.ts` | env 読み取り | env 読み取りの**唯一の場所** |
| `src/libs/<package>/<impl>.ts` | パッケージ依存 (I/O 等) | 外部パッケージの副作用はラッパー内部に閉じる |
| `src/content.config.ts` | ファイル読み取り | Astro Content Layer 経由で `private/` を読む |
| `src/pages/*.astro` | Astro ビルド時 I/O | データ取得は `astro:content` の `getCollection` のみ |
| `scripts/migrate-excel.ts` | ファイル I/O (libs 経由) | Excel 読 + YAML 書 |
| `scripts/build-excel.ts` | ファイル I/O (libs 経由) | YAML 読 + xlsx 書 |
| `scripts/verify-no-leak.ts` | ファイル I/O (libs 経由) + exit code | YAML 読 + dist/ 読 |

それ以外 (`src/schemas/*`, `src/domain/*`, `src/components/*`, 各 `index.ts` barrel) は **すべて純粋**。

## 外部パッケージ → libs ラッパーの対応

| パッケージ | ラッパー | 用途 |
|---|---|---|
| `exceljs` | `src/libs/exceljs/` | migrate / build-excel スクリプトでの xlsx 読み書き |
| `js-yaml` | `src/libs/js-yaml/` | migrate / build-excel / verify スクリプトでの YAML 読み書き |
| `zod` | (例外、`schemas/` 内のみ直接 import 可) | schemas で型システムの一部として |
| `astro:content` `astro/loaders` | (例外、直接 import 可) | Astro 組み込み API |

## tsconfig パスエイリアス

`tsconfig.json` に既設の `@/*` → `src/*` を活用し、import を統一:

```ts
import { ProjectFile } from "@/schemas";
import { expandProject } from "@/domain";
import { getBuildMode } from "@/config";
import { writeWorkbook } from "@/libs/exceljs";
```

`@/libs/exceljs/workbook` のように **内部実装ファイルを直接 import する書き方は禁止** (Barrel Export 規約)。

## テスト戦略 (将来)

- `src/schemas/*` — Zod スキーマの validation テスト (正常系 / 異常系 YAML)
- `src/domain/*` — 純粋関数なのでユニットテスト容易 (vitest 想定)
- `src/libs/*` — モック可能なら統合テスト
- `src/pages/*` — E2E (Playwright) で URL アクセス → 期待表示
- `scripts/*` — fixture xlsx → 期待 YAML の対比

> **Note**: v1 ではテストを書かない。実装が安定して必要になったら追加。

## 実装順序の推奨 (ファイル単位)

各フォルダで **`index.ts` (barrel) と実装ファイルをセット** で作る。

1. `src/config/config.ts` + `src/config/index.ts` (BUILD_MODE 取得)
2. `src/schemas/common.ts` (共通型)
3. `src/schemas/{engineer,project,tech-tag,industry-tag,role}.ts` + `src/schemas/index.ts`
4. `src/content.config.ts`
5. `src/libs/js-yaml/<impl>.ts` + `src/libs/js-yaml/index.ts` (最小ラッパー、必要に応じて拡張)
6. `src/domain/visibility.ts`
7. `src/domain/data-loader.ts`
8. `src/domain/index.ts` (この時点でのバレル化)
9. サンプル YAML 配置 (`private/engineer.yaml` 等の最小プレースホルダー)
10. ここまでで `yarn build` を通して Content Layer + Zod が動くか検証
11. `src/domain/derivations.ts` `src/domain/references.ts` `src/domain/labels.ts` を追加 → `domain/index.ts` を更新
12. `src/pages/index.astro` (まずデータ取得 → 表示するだけ)
13. components → 詳細ページ → フィルタ UI、と段階的に
14. (後で) `src/libs/exceljs/<impl>.ts` + `src/libs/exceljs/index.ts` + `scripts/migrate-excel.ts` + `scripts/build-excel.ts`
15. (後で) `scripts/verify-no-leak.ts`
