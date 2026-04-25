# v1 技術スタック仕様

engineer-skill-map v1 で採用する技術スタックと運用方針。データモデルは [data-model.md](data-model.md) 参照。

## サマリ

| カテゴリ | 採用 |
|---|---|
| パッケージマネージャ | **yarn** |
| フロントFW | **Astro** (Content Layer + Zod 検証) |
| UI コンポーネント | **shadcn/ui** (React island として Astro 内で利用) |
| スタイリング | **Tailwind CSS** (`@astrojs/tailwind`) |
| データ形式 | **YAML** (1ファイル / 1案件、visibility セクション分け) |
| データ配置 | **`private/`** 配下 (gitignore 済) |
| 移行スクリプト | **Node/TS + exceljs** (一回きり、半自動) |
| Excel 出力 | **exceljs** (build-time only、レイアウトは別途検討) |
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
│   ├── migrate-excel.ts              # Excel → YAML 一回きり移行
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

3つのモード:

| モード | データ範囲 | 出力 | 用途 |
|---|---|---|---|
| **public** | `public:` のみ | `dist/` | GitHub Pages 配信 |
| **excel** | `public:` + `excelOnly:` | xlsx ファイル | 営業/面談者向け配布 |
| **local** | 全フィールド (`selfOnly:` 含む) | `dev` サーバー or `dist-local/` | 自分用、面談時参照 |

```json
{
  "scripts": {
    "dev": "BUILD_MODE=local astro dev",
    "build": "BUILD_MODE=public astro build && yarn verify",
    "build:local": "BUILD_MODE=local astro build --outDir dist-local",
    "build:excel": "BUILD_MODE=excel tsx scripts/build-excel.ts",
    "verify": "tsx scripts/verify-no-leak.ts",
    "deploy": "yarn build && gh-pages -d dist",
    "migrate": "tsx scripts/migrate-excel.ts"
  }
}
```

`yarn dev` は常に local モード (memo 表示込み)。`yarn build` は自動的に verify を実行し、漏洩がなければ `yarn deploy` で公開。

## URL ルーティング (ハイブリッド・フル実装)

| URL | public | excel | local |
|---|---|---|---|
| `/` | ✓ (統合ビュー) | (Excel化対象) | ✓ |
| `/projects/[slug]/` | ✓ (visibility=default のみ) | (Excel化対象) | ✓ (全 visibility) |
| `/tags/[name]/` | ✓ | - | ✓ |
| `/admin/` | ✕ | ✕ | ✕ (v2 で追加予定) |

`/` トップに技術タグフィルタ + 業界タグフィルタ + 検索ワードの3軸 UI を React island として配置。フィルタ状態は **URL パラメータ** に反映 (`?tag=react&industry=web3&q=リプレイス`)。

## データロード層

```ts
// src/lib/data-loader.ts (概念)
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

## 検索・フィルタ実装

- 32件規模のためクライアントサイド処理で十分 (Pagefind 不要)
- React island (Astro 上の `<FilterUI client:load />`) で実装
- フィルタロジック: タグ含有判定 + 概要/プロジェクト名の文字列マッチ
- 状態は URL パラメータと双方向同期 (`history.pushState` + popstate listener)
- Pagefind 等の全文検索ライブラリは v2 で「必要になったら」追加

## 安全装置: 漏洩チェックスクリプト

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

## 移行スクリプト (`scripts/migrate-excel.ts`)

一回きりの実行を前提とした半自動スクリプト。詳細は [data-model.md](data-model.md) の「移行」セクション (要追記) 参照。

責務:
- `private/スキルシート（MM）.xlsx` と `private/スキルシート.xlsx` を exceljs でパース
- プロジェクト名+期間でマッチング、重複排除
- TechTag の baseName 自動推定 (バージョン文字列を切り出し)
- TechTag のカテゴリ自動推定 (簡易ルール、要修正)
- IndustryTag 自動推定 (キーワードマッチで候補出力)
- Project の visibility はデフォルト `default` で出力、移行後にユーザが手動仕分け
- `private/` 配下に YAML 出力、`# TODO: ...` コメントで要修正箇所を明示

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

- 印刷スタイル (`@media print`) → v2
- Excel レイアウト確定 → 実装フェーズで再議論
- `/admin/` 自分用ダッシュボード → v2
- Profile 機能 (ターゲット別シート分割) → v2
- 案件管理機能 → v2
- Pagefind 等の全文検索 → v2 で必要になったら
- カスタムドメイン → v2
- CI/CD (GitHub Actions) → 手動運用で困るようになったら
