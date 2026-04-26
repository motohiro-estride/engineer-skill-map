# v1 技術スタック仕様

engineer-skill-map v1 で採用する技術スタックと運用方針。データモデルは [data-model.md](data-model.md) 参照。

## v1 の優先方針(リリース期限なし)

- **リリース期限**: **撤回**。納得行くまで作り込む(2026-04-25 に方針転換)
- **優先方針**: web 表現優先(楽しい優先)+ **スキルシート機能維持**(両立する)
- **演出方針**: **ターミナル風 UI**(黒背景 + monospace + `cat`/`tree`/`ls`/`grep` 等のコマンド出力)を主役にし、スキルシート情報をターミナルの中に埋め込む(L2 路線)。Three.js は不採用(自作 3D の作り込みコストと、外部 3D モデルのライセンス問題を回避)。詳細は [terminal-design.md](terminal-design.md)
- **モード切替**: 右下の「アニメーション停止」ボタン + URL `?plain=1` で強制 Plain モード(普通のスキルシート表示)。営業/面談者向けの配布は `?plain=1` 付きの URL で行う
- **v1 スコープ(復元済)**: 期限撤回により、当初 v1.1 へ送ったもの(Excel 出力 / ローカルメモ / 詳細ページ / 漏洩チェック等)は v1 に戻す

## サマリ

| カテゴリ | 採用 |
|---|---|
| パッケージマネージャ | **yarn** |
| フロントFW | **Astro** (Content Layer + Zod 検証) |
| UI コンポーネント | **shadcn/ui** (React island として Astro 内で利用) |
| スタイリング | **Tailwind CSS** (`@astrojs/tailwind`) |
| データ形式 | **YAML** (1ファイル / 1案件、visibility セクション分け) |
| データ配置 | **`private/`** 配下 (gitignore 済) |
| Excel 出力 | **exceljs** (v1.1 へ送る) |
| 演出 | **ターミナル風 UI**(黒背景 + monospace、CSS / JS / Canvas 2D のみ、外部依存最小)。詳細は [terminal-design.md](terminal-design.md) |
| デプロイ | **gh-pages** パッケージで手動 push (CI 不使用) |

## ディレクトリ構成 (想定)

```
.
├── .claude/
│   ├── CLAUDE.md
│   └── design/
│       ├── data-model.md
│       └── tech-stack.md
├── private/                          # gitignore 済、Source of Truth
│   ├── engineer.yaml
│   ├── projects/
│   │   ├── 01-public-sector-dx.yaml
│   │   └── ...
│   ├── tech-tags.yaml
│   ├── industry-tags.yaml
│   └── roles.yaml
├── scripts/
│   ├── build-excel.ts                # YAML → xlsx 生成
│   └── verify-no-leak.ts             # 公開ビルドの漏洩チェック
├── src/
│   ├── content.config.ts             # Content Layer + Zod スキーマ
│   ├── lib/
│   │   ├── data-loader.ts            # ビルドモード別データ読み込み
│   │   └── derivations.ts            # 派生フィールド (年齢、累積年数 等)
│   ├── pages/
│   │   ├── index.astro               # / (統合ビュー)
│   │   ├── projects/
│   │   │   └── [slug].astro          # /projects/<slug>/
│   │   └── tags/
│   │       └── [name].astro          # /tags/<name>/
│   ├── components/
│   │   ├── ProjectCard.astro
│   │   ├── TagChip.astro
│   │   ├── FilterUI.tsx              # React island
│   │   └── ...
│   └── styles/
│       └── globals.css
├── astro.config.mjs
├── tailwind.config.mjs
├── tsconfig.json
└── package.json
```

## ビルドモードと yarn scripts

3つのモード(v1 では `public` のみ実装、`excel` / `local` は v1.1 で追加):

| モード | v1 | データ範囲 | 出力 | 用途 |
|---|---|---|---|---|
| **public** | ✓ | `public:` のみ | `dist/` | GitHub Pages 配信 |
| **excel** | (v1.1) | `public:` + `excelOnly:` | xlsx ファイル | 営業/面談者向け配布 |
| **local** | (v1.1) | 全フィールド (`selfOnly:` 含む) | `dev` サーバー or `dist-local/` | 自分用、面談時参照 |

v1 の yarn scripts:

```json
{
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "deploy": "yarn build && gh-pages -d dist"
  }
}
```

> **Note**: v1 では BUILD_MODE 環境変数を使わない(`public` モード相当の挙動を `data-loader` が常に行う)。v1.1 で BUILD_MODE 切替・`build:local` / `build:excel` / `verify` を追加。

## URL ルーティング

v1 は `/` 1ページ構成のみ。詳細・タグページとフィルタ UI は v1.1 で追加。

| URL | v1 | public | excel | local |
|---|---|---|---|---|
| `/` | ✓ | ✓ (統合ビュー、トップに集計サマリ + プロジェクト一覧 + 背景シェーダー) | (v1.1 で Excel 化) | (v1.1) |
| `/projects/[slug]/` | (v1.1) | (v1.1: visibility=default のみ) | (v1.1) | (v1.1) |
| `/tags/[name]/` | (v1.1) | (v1.1) | - | (v1.1) |
| `/admin/` | ✕ | ✕ | ✕ | ✕ (v2 で追加予定) |

> v1.1 で `/` トップに技術タグフィルタ + 業界タグフィルタ + 検索ワードの3軸 UI を React island として追加予定。フィルタ状態は **URL パラメータ** に反映 (`?tag=react&industry=web3&q=リプレイス`)。

## データロード層

v1 は `BuildMode='public'` 経路のみ実装。`excel` / `local` のマージ経路と visibility 別フィルタは v1.1 で追加。

```ts
// src/lib/data-loader.ts (概念、v1 では public 経路のみ実装)
type BuildMode = 'public' | 'excel' | 'local';

function loadProjects(mode: BuildMode): Project[] {
  const allYaml = readYamlFiles('private/projects/');
  return allYaml
    .map(p => mergeByMode(p, mode))
    .filter(p => filterByVisibility(p, mode));
}

function mergeByMode(p: ProjectYaml, mode: BuildMode) {
  return {
    ...p.public,
    ...(mode !== 'public' ? p.excelOnly : {}),
    ...(mode === 'local' ? p.selfOnly : {}),
    visibility: p.visibility,
  };
}

function filterByVisibility(p: Project, mode: BuildMode) {
  if (mode === 'local') return true;             // 全 visibility 表示
  return p.visibility !== 'archived'              // public/excel は archived 除外
      && p.visibility !== 'stats_only';           // 表示も除外
}

// 集計 (TechTag 累積年数) は別関数: stats_only 含み archived 除外
function loadProjectsForStats() {
  return readYamlFiles('private/projects/')
    .map(p => mergeByMode(p, 'local'))
    .filter(p => p.visibility !== 'archived');
}
```

## 検索・フィルタ実装 (v1.1 へ送る)

> v1 では未実装。v1 のトップは集計サマリ + プロジェクト一覧 (時系列) のみ。

- 32件規模のためクライアントサイド処理で十分 (Pagefind 不要)
- React island (Astro 上の `<FilterUI client:load />`) で実装
- フィルタロジック: タグ含有判定 + 概要/プロジェクト名の文字列マッチ
- 状態は URL パラメータと双方向同期 (`history.pushState` + popstate listener)
- Pagefind 等の全文検索ライブラリは v2 で「必要になったら」追加

## 安全装置: 漏洩チェックスクリプト (v1.1 へ送る)

> v1 では未実装。v1 では `private/` 配下の `excelOnly:` / `selfOnly:` セクションを **そもそも load しない** 設計でリスクを担保する(`data-loader` が `public` セクションのみ展開)。
> v1.1 で多重防御として下記スクリプトを追加。

`scripts/verify-no-leak.ts` の役割:
- public モードビルド (`dist/`) を再帰的に走査
- `excelOnly:` / `selfOnly:` セクションに含まれるフィールド値 (氏名、最寄駅、生年月日、private_memo 等) が含まれていないか文字列マッチで検査
- 1件でも検出したらエラー終了 (deploy をブロック)

実装は単純: `private/*.yaml` をパース → 漏洩したらまずい値を集めた blacklist を生成 → `dist/` 全ファイルに対して string contains チェック。

## デプロイ運用

```bash
yarn build        # → BUILD_MODE=public で astro build → verify (安全装置)
yarn deploy       # → gh-pages -d dist で gh-pages ブランチへ push
```

GitHub Pages 設定:
- Source: `gh-pages` ブランチ、`/ (root)`
- カスタムドメインは未定 (v1 では考慮不要)

CI は使わない。月1〜2回の更新前提なら手動運用で十分。

## 公開リポへのファイル配置ポリシー

| 種別 | 公開リポ | 備考 |
|---|---|---|
| ソースコード (`src/`, `scripts/`) | コミット | yarn 前提 |
| 設計仕様 (`.claude/design/`) | コミット | docs/ には書かない |
| CLAUDE.md (`.claude/CLAUDE.md`) | コミット | |
| 実データ (`private/`) | gitignore | 絶対に push しない |
| Excel 元ファイル | gitignore (`private/`) | 同上 |
| sample-data | **なし** (Y を選択) | 第三者クローンを想定しないため不要 |
| `dist/` ビルド成果物 | gitignore (`gh-pages` ブランチへ別 push) | |
| `node_modules/` | gitignore | 標準 |

## v1 で実装しない / 未決定 (Future)

### v1.1 (リリース直後に追加予定)

- Excel 出力 (`scripts/build-excel.ts`) — 営業/面談者向け配布の正式書類生成
- ローカル(自分用)ビルド + memo 表示 (`BUILD_MODE=local`、`selfOnly:` セクション展開)
- プロジェクト詳細ページ (`/projects/[slug]/`)
- タグページ (`/tags/[name]/`)
- フィルタ UI (React island、URL パラメータ同期)
- 漏洩チェックスクリプト (`scripts/verify-no-leak.ts`)
- Excel レイアウト確定

### v2

- 印刷スタイル (`@media print`)
- `/admin/` 自分用ダッシュボード
- Profile 機能 (ターゲット別シート分割)
- 案件管理機能

### Future (必要になったら)

- Pagefind 等の全文検索
- カスタムドメイン
- CI/CD (GitHub Actions)
