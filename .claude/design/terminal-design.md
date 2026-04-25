# 世界観設計 (ターミナル風 UI)

engineer-skill-map のメインビューを **黒背景 + monospace のターミナル風** に統一し、スキルシート情報を `cat` / `tree` / `ls` / `grep` / 自作コマンド の出力として表示する。Three.js は採用しない(自作3Dの作り込みコストと、外部3Dモデルのライセンス問題を回避)。

## 設計目的

- **エンジニアらしさ** を最大限に出す体験(ターミナル / IDE をいじる感覚)
- スキルシート機能を維持しつつ、表示形式を世界観に合わせる(L2: 情報を世界観に埋め込む)
- 営業/面談者の実用性は **モード切替** で担保する(World mode: ターミナル / Plain mode: 通常の HTML スキルシート)
- CSS / JS / Canvas 2D のみで実装、外部依存最小

## 採用テーマ

- **黒背景 (#040712 寄り) + シアン+白テキスト** のターミナル
- システム monospace フォント(`ui-monospace, "SF Mono", Menlo, Consolas, monospace`)
- プロンプト: `❯ ` ミニマル(ユーザー名やパスは表示しない、ノイズを減らす)
- 表示は画面いっぱいの単一スクロール領域

## 操作モデル: O3 ハイブリッド

| フェーズ | 内容 |
|---|---|
| **1. 自動再生** | ロード後、定義済みコマンドが順番に自動実行される(タイプライター効果でコマンド入力 → pause → 出力表示) |
| **2. ユーザー入力モード** | 自動再生が完了するとプロンプトが点滅、ユーザーがコマンドを叩ける |
| **3. スキップ** | 任意のキー押下で自動再生をスキップ(末尾までジャンプ → ユーザー入力モードへ) |

利用可能コマンド(段階的に増やす):

- `help` — 使えるコマンド一覧
- `whoami` — エンジニアのプロフィールサマリ
- `cat <file>` — 指定ファイルの内容(`profile.md` / `projects/<slug>.md` 等)
- `tree [<path>]` — ディレクトリツリー(`projects/` / `tech-tags/` 等)
- `ls [<path>]` — 一覧
- `grep <pattern> <path>` — 検索
- `stats [--period <range>]` — 集計(経験年数・案件数・フェーズ別)
- `clear` — 画面クリア
- `replay` — 自動再生をやり直す

未知のコマンドには `command not found: ...` を返す(ターミナルらしさ)。

## モード切替

| モード | 内容 |
|---|---|
| **World mode (default)** | ターミナル演出。自動再生 + ユーザー入力可 |
| **Plain mode** | 通常の HTML スキルシート(集計サマリ + プロジェクト一覧、シンプルな読み物) |

切替 UI:

- 画面右下のトグルボタン(既存の `ModeToggle.tsx` を流用)
- localStorage で記憶、`?plain=1` で強制 Plain、`prefers-reduced-motion` で強制 Plain

## ファイル構成

```text
src/components/Terminal/
├── Terminal.astro              # ターミナル DOM + 起動 script
├── runner.ts                    # タイプライター + コマンド逐次実行のロジック
├── commands.ts                  # コマンド定義 (input → output 文字列を返す)
├── data-source.ts               # @/domain と接続して engineer/projects 等を取得
└── styles.css                   # ターミナル用ローカル CSS (フォント・カーソル・スクロール)

src/components/ModeToggle/
└── ModeToggle.tsx               # 既存、流用

(削除)
src/components/World/            # → 削除
src/libs/three/                  # → 削除
src/types/glsl.d.ts              # → 削除
```

## コマンドの実装方針

- 各コマンドは **同期関数 or 非同期 generator**(出力を1行ずつ yield する形)で実装
- ロード時に Astro の `getCollection` などからデータを取得 → コマンドハンドラに渡す
- 動的なデータ集計は `@/domain` の関数を再利用(`calculateExperienceYears` / `calculateTagCumulativeYears` 等)
- **副作用ゼロ**(画面操作は runner.ts 側で集中管理)

## ランナーのアニメーション仕様

- タイプライター速度: 60〜90ms/文字(可変、出力時は 5〜10ms/行)
- コマンド入力後の pause: 400〜800ms(ランダム)
- コマンド実行後の pause: 600〜1200ms
- スクロール: 自動追従(画面下端を維持)
- カーソル点滅: 500ms 周期(矩形ブロック)
- ループ: 1回で停止(末尾まで行くとユーザー入力モード)

## アクセシビリティ

- `prefers-reduced-motion: reduce` 時は **Plain mode 強制**(自動再生のチカチカを避ける)
- キーボード操作対応:
  - `Esc` / 任意キー: 自動再生スキップ
  - `Enter`: コマンド実行
  - `↑` `↓`: コマンド履歴
  - `Tab`: 補完(将来)
- `aria-live="polite"` でスクリーンリーダーに進行を通知

## v1 実装順 (推奨)

1. ファイル骨格と CSS(`Terminal.astro` + `styles.css`、空のターミナル枠が表示される)
2. ランナー実装(`runner.ts`)— タイプライター + 出力レンダリング + 自動スクロール
3. コマンド定義(`commands.ts`)— `whoami` / `cat profile.md` / `tree projects/` / `clear` / `help`
4. データ接続(`data-source.ts`)— Astro Content Layer から取得して commands に渡す
5. `index.astro` を組み替え(World 削除、Terminal を主役に)
6. データ移行(D-2、Excel→YAML、`scripts/migrate-excel.ts`)
7. コマンド拡張: `ls`, `grep`, `stats`, etc
8. ユーザー入力モード(自動再生終了後のプロンプト + キー入力)
9. コマンド履歴(↑↓)・補完(Tab、将来)
10. 演出微調整(色、速度、pause)

## v2 以降で検討する拡張

- `Tab` 補完
- ファイル中身の lazy load(大きい case)
- ターミナル風だが画像 / 図表を ASCII アートで描画
- BGM / 効果音(タイプ音、エンター音)
