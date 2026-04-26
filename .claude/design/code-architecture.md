# v1 コードアーキテクチャ (責任分解)

各モジュールの **役割・入出力・副作用境界** を明示する。実装時はこの仕様に沿ってファイルを配置・編集する。

## 設計原則

1. **関心の分離**: 「定義」「ロジック」「設定」「データ取得」「描画」「外部依存」を別モジュールに分ける
2. **純粋関数優先**: 副作用 (I/O、env 読み取り等) は明確に境界化
3. **データの流れは一方向**: YAML (private/) → Content Layer → page → component
4. **ページ層がオーケストレーター**: データ取得・展開・派生計算の組み立ては page で。component は受け取って描画
5. **外部パッケージは libs 経由**: yarn で導入したパッケージは `src/libs/<package>/` のラッパーを経由してのみ使う。`src/domain/` `src/pages/` `scripts/` から直接 import しない
6. **Barrel Export 規約**: 各 `src/` 配下のフォルダ (`config/`, `schemas/`, `libs/<package>/`, `domain/`) に `index.ts` を置き、これを **公開 API** とする。`index.ts` は **re-export 専用** (実装を書かない)。実装は同フォルダ内の別ファイルに置く。フォルダ外からの import は必ず `index.ts` 経由 (例: `import { ProjectFile } from "@/schemas"`)
7. **スクリプトは独立**: build-excel / verify はページとは独立、`src/schemas` `src/domain` `src/libs` `src/config` を共有して使う

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
│   ├── shadcn/                        # shadcn 関連ユーティリティ (cn 等)
│   │   ├── index.ts                   # barrel
│   │   └── utils.ts                   # cn(...classes) ヘルパ
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
│   ├── ui/                            # shadcn 由来コンポーネント (CLI で取り込み)
│   │   ├── card.tsx
│   │   ├── badge.tsx
│   │   └── separator.tsx
│   ├── icons/                         # 自前 SVG アイコン (lucide-react は不採用)
│   │   └── <Icon>.astro / .tsx
│   ├── Terminal/                      # ターミナル風 UI (v1 主役)
│   │   ├── Terminal.astro              # ターミナル DOM + 起動 script
│   │   ├── runner.ts                   # タイプライター + コマンド逐次実行ロジック
│   │   ├── commands.ts                 # コマンド定義 (input → output 文字列)
│   │   ├── data-source.ts              # @/domain と接続してデータを供給
│   │   └── styles.css                  # ターミナル用ローカル CSS
│   ├── ModeToggle/                    # モード切替トグル (右下、localStorage 連動)
│   │   └── ModeToggle.tsx
│   ├── ProjectCard.astro              # 自前コンポーネント (ui/ と並列)
│   ├── TagChip.astro
│   ├── ProfileSection.astro
│   ├── FilterUI.tsx                   # React island (フィルタ + URL 同期、v1.1)
│   └── ...
└── styles/
    └── globals.css

scripts/                              # 独立スクリプト (build-time / 手動実行)
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
**入力**: `process.env.*`
**出力**: 設定値 (BUILD_MODE 等) と判定関数 (`getBuildMode()` 等)
**副作用**: env 読み取り (`config.ts` のみ)
**依存**: なし
**外からの import**: `import { getBuildMode, BuildMode } from "@/config"`

> **Note**: `import.meta.env.*` ではなく `process.env.*` を使う理由は、Astro/Vite の server-side コードと **tsx スクリプト** (`scripts/build-excel.ts` 等) の両方で同じ config を共有できるため。`import.meta.env` は Vite/Astro 専用で、`tsx` 直接実行では存在しない。

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

### `src/libs/three/` (3D 世界観ラッパー)

#### 構成
- `three/index.ts` — **barrel**
- `three/world-renderer.ts` — 実装: Three.js による renderer / scene / camera の起動・raf ループ・resize / visibilitychange / `prefers-reduced-motion` 対応・dispose を1関数 (`createWorldRenderer`) に集約

**役割**: 3D 世界観を「scene と canvas を渡せば動く」一発関数として提供する。Three.js API はこのラッパー内に閉じる。
**入力**: `{ canvas, scene, camera, onFrame? }`
**出力**: `{ start, stop, dispose }` を返す。`World.astro` 側は scene を組んで `start()` を呼ぶ
**副作用**: WebGL コンテキスト生成、raf ループ、DOM リスナ登録(全て dispose で解除)
**依存**: `three`(直接 import 可、本フォルダ内のみ)
**外からの import**: `import { createWorldRenderer } from "@/libs/three"`

詳細仕様は [world-design.md](world-design.md) 参照。

### `src/libs/<package>/` (一般ルール)

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

### `src/components/World/`

#### 構成
- `World.astro` — canvas + HTML overlay コンテナ + 起動 script タグ
- `scene-builder.ts` — シーン構築 (Floor / Walls / ServerRacks / MainMonitor 等の Mesh 生成)
- `camera-controller.ts` — 初期位置 / ターゲット位置定義 / lerp ロジック
- `interactor.ts` — Raycaster + hover / click ハンドラ
- `info-overlay.tsx` — クリック対象の詳細情報を表示する React island
- `shaders/*.glsl` — LED / モニター / 壁・床の自作 GLSL

**役割**: 3D 世界観 (T3 サーバールーム) を構築・描画・操作する複合コンポーネント。詳細は [world-design.md](world-design.md)。
**入力**: ページ層から渡される `engineer` / `projects` / `techTags` / `industryTags` / `roles` 等のデータ
**出力**: DOM に `<canvas>` + HTML overlay、ブラウザで Three.js シーンが起動
**副作用**: WebGL コンテキスト生成・raf ループ・resize / visibilitychange / mousemove / click のリスナ登録(`@/libs/three/world-renderer` 内に dispose とともに閉じる)
**依存**: `@/libs/three`、同フォルダの `.glsl`(Vite の `?raw` インポート)、`@/components/ModeToggle`(World ↔ Plain 切替に同期)
**外からの import**: `import World from "@/components/World/World.astro"`(barrel 不要)

### `src/components/ModeToggle/`

#### 構成
- `ModeToggle.tsx` — React island。右下のトグル UI、localStorage に状態を保存

**役割**: World mode ↔ Plain mode の切替 UI と状態管理。
**入力**: なし(初期値は localStorage と URL パラメータから判定)
**出力**: `<html data-mode="world | plain">` を更新、World コンポーネントが mode 変化を監視して動作を切替
**副作用**: localStorage 読み書き、URL パラメータ参照、`document.documentElement.dataset.mode` 更新
**依存**: なし(純粋な React component)
**外からの import**: `import { ModeToggle } from "@/components/ModeToggle/ModeToggle"`(個別 import)

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


Excel 出力 (build-time):
private/*.yaml ──[scripts/build-excel via @/libs/js-yaml, @/libs/exceljs, @/domain]──→ output/*.xlsx
```

## 副作用境界 (一覧)

| モジュール | 副作用 | 説明 |
|---|---|---|
| `src/config/config.ts` | env 読み取り | env 読み取りの**唯一の場所** |
| `src/libs/<package>/<impl>.ts` | パッケージ依存 (I/O 等) | 外部パッケージの副作用はラッパー内部に閉じる |
| `src/content.config.ts` | ファイル読み取り | Astro Content Layer 経由で `private/` を読む |
| `src/libs/three/world-renderer.ts` | WebGL / DOM / raf | World シーン用 renderer 起動・ループ・dispose をラッパーに閉じる |
| `src/components/World/World.astro` | ブラウザでの World 起動 | `<script>` でブラウザ実行時に scene を組み、renderer を起動。SSR 時は canvas + overlay container のみ出力 |
| `src/components/World/interactor.ts` | mousemove / click | DOM リスナを登録。dispose で解除 |
| `src/components/ModeToggle/ModeToggle.tsx` | localStorage / URL / DOM dataset | mode 状態の永続化・読込み・切替 |
| `src/pages/*.astro` | Astro ビルド時 I/O | データ取得は `astro:content` の `getCollection` のみ |
| `scripts/build-excel.ts` | ファイル I/O (libs 経由) | YAML 読 + xlsx 書 |
| `scripts/verify-no-leak.ts` | ファイル I/O (libs 経由) + exit code | YAML 読 + dist/ 読 |

それ以外 (`src/schemas/*`, `src/domain/*`, `src/components/*`, 各 `index.ts` barrel) は **すべて純粋**。

## 外部パッケージ → libs ラッパーの対応

| パッケージ | ラッパー | 用途 |
|---|---|---|
| `exceljs` | `src/libs/exceljs/` | build-excel スクリプトでの xlsx 読み書き |
| `js-yaml` | `src/libs/js-yaml/` | build-excel / verify スクリプトでの YAML 読み書き |
| `three` | `src/libs/three/` | 背景シェーダーの起動・ループ・dispose(`HeroShader.astro` から呼ぶ) |
| `clsx` `tailwind-merge` | `src/libs/shadcn/` | `cn(...classes)` ヘルパ。shadcn コンポーネントで使用 |
| `class-variance-authority` | (`components/ui/` 内のみ直接 import 可) | shadcn コンポーネントの variants 定義 |
| `@radix-ui/react-*` | (`components/ui/` 内のみ直接 import 可) | shadcn コンポーネントの Primitive |
| `tw-animate-css` | (CSS にて `@import`) | Tailwind v4 用アニメーション (`tailwindcss-animate` 後継) |
| `zod` | (例外、`schemas/` 内のみ直接 import 可) | schemas で型システムの一部として |
| `astro:content` `astro/loaders` | (例外、直接 import 可) | Astro 組み込み API |

## shadcn/ui の扱い

shadcn は yarn でインストールするのではなく、`yarn dlx shadcn@latest add <component>` で **コードをコピペ取り込み** する方式 (取り込まれたコードがリポジトリの所有物になる)。

- 配置先: `src/components/ui/` (components.json で指定)
- `cn` ユーティリティ: `src/libs/shadcn/utils.ts` (shadcn デフォルトの `src/lib/utils.ts` から場所変更、libs 規約と整合)
- shadcn コンポーネント内では `@radix-ui/react-*` `class-variance-authority` を **直接 import 可** (libs ラッパー経由は要求しない、shadcn の慣例尊重)
- `components.json` をリポジトリルートに置き、CLI に各種パスを伝える

設定ファイル: `components.json` (リポジトリルート)。

## アイコン方針

`lucide-react` は **採用しない**。代わりに `src/components/icons/` に自前 SVG コンポーネント (`.astro` または `.tsx`) を配置し、必要なものだけを作る。

理由:
- 依存削減 (lucide-react は数 MB)
- 必要なアイコンだけ持つ (バンドル最小化)
- カスタマイズ自由度

shadcn の icons 系コンポーネントを CLI で取り込む際 (例: `Alert` 等) は、lucide import を自前 SVG コンポーネントへの置換が必要。

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
14. (後で) `src/libs/exceljs/<impl>.ts` + `src/libs/exceljs/index.ts` + `scripts/build-excel.ts`
15. (後で) `scripts/verify-no-leak.ts`
