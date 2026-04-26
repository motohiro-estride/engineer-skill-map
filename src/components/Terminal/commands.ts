// ターミナルコマンド定義。input(コマンド名 + 引数)を受け取って出力行配列を返す。
// 純粋関数として実装。副作用は runner.ts 側で扱う。

import type { TerminalData } from "./data-source";

export interface CommandLine {
  /** 行のテキスト */
  text: string;
  /** スタイル種別(色分け用) */
  kind?: "default" | "muted" | "highlight" | "error" | "comment" | "header";
}

export interface CommandContext {
  /** 現在のカレントディレクトリ。例: "~", "~/projects" */
  cwd: string;
}

export interface CommandResult {
  lines: CommandLine[];
  /** 設定された場合、runner はこの値で cwd を更新する */
  newCwd?: string;
}

export type CommandHandler = (
  args: string[],
  data: TerminalData,
  ctx: CommandContext,
) => CommandResult;

export const KNOWN_DIRS = [
  "~",
  "~/projects",
  "~/tech-tags",
  "~/industry-tags",
  "~/roles",
] as const;

const padRight = (s: string, w: number): string =>
  s + " ".repeat(Math.max(0, w - displayWidth(s)));

// 全角文字を 2、半角を 1 として幅を計算
function displayWidth(s: string): number {
  let w = 0;
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    if (code >= 0x3000 && code <= 0x9fff) w += 2;
    else if (code >= 0xff00 && code <= 0xff60) w += 2;
    else w += 1;
  }
  return w;
}

/** 入力パスを cwd 起点で絶対パス (~/...) に解決 */
export function resolvePath(cwd: string, input: string): string {
  if (!input || input === "~" || input === "/") return "~";
  if (input === "..") {
    if (cwd === "~") return "~";
    const parts = cwd.split("/");
    parts.pop();
    return parts.join("/") || "~";
  }
  if (input.startsWith("~/")) return input.replace(/\/+$/, "");
  if (input === "/" || input === "~") return "~";
  // 相対パス
  const cleaned = input.replace(/\/+$/, "");
  if (cwd === "~") return `~/${cleaned}`;
  return `${cwd}/${cleaned}`;
}

const helpHandler: CommandHandler = () => ({
  lines: [
    { text: "available commands:", kind: "header" },
    { text: "  whoami           profile summary", kind: "muted" },
    { text: "  pwd              show current directory", kind: "muted" },
    { text: "  cd <path>        change directory (projects, tech-tags, ..)", kind: "muted" },
    { text: "  ls [<path>]      list entries (default: cwd)", kind: "muted" },
    { text: "  tree [<path>]    show directory tree (default: cwd)", kind: "muted" },
    { text: "  cat <file>       show file content (profile.md, 01, projects/01, ...)", kind: "muted" },
    { text: "  grep <pat> [<p>] search pattern in path", kind: "muted" },
    { text: "  stats            aggregated stats", kind: "muted" },
    { text: "  clear            clear screen", kind: "muted" },
    { text: "  replay           replay autoplay", kind: "muted" },
    { text: "  help             this help", kind: "muted" },
    { text: "" },
  ],
});

const whoamiHandler: CommandHandler = (_args, data) => {
  const eng = data.engineer;
  if (!eng) {
    return { lines: [{ text: "no engineer data", kind: "error" }] };
  }
  const lines: CommandLine[] = [];
  const namePart = eng.name;
  const meta: string[] = [];
  if (eng.age !== undefined) meta.push(`${eng.age}歳`);
  if (eng.gender) meta.push(eng.gender);
  if (eng.nationality) meta.push(eng.nationality);
  lines.push({ text: namePart + (meta.length ? ` (${meta.join(", ")})` : ""), kind: "highlight" });
  if (eng.workableArea) lines.push({ text: `  area:        ${eng.workableArea}`, kind: "muted" });
  if (eng.finalEducation) lines.push({ text: `  education:   ${eng.finalEducation}`, kind: "muted" });
  if (eng.domainKnowledge) lines.push({ text: `  domain:      ${eng.domainKnowledge}`, kind: "muted" });
  lines.push({ text: `  experience:  ${data.experienceYears} years (${data.totalProjectCount} projects)`, kind: "muted" });
  lines.push({ text: "" });
  return { lines };
};

const pwdHandler: CommandHandler = (_args, _data, ctx) => ({
  lines: [{ text: ctx.cwd }, { text: "" }],
});

const cdHandler: CommandHandler = (args, _data, ctx) => {
  const target = resolvePath(ctx.cwd, args[0] ?? "");
  if (!(KNOWN_DIRS as readonly string[]).includes(target)) {
    return {
      lines: [
        { text: `cd: ${args[0] ?? ""}: No such directory`, kind: "error" },
        { text: `(available: ${KNOWN_DIRS.slice(1).map((d) => d.replace("~/", "")).join(", ")})`, kind: "muted" },
        { text: "" },
      ],
    };
  }
  return { lines: [], newCwd: target };
};

const catHandler: CommandHandler = (args, data, ctx) => {
  const file = args[0];
  if (!file) {
    return { lines: [{ text: "usage: cat <file>", kind: "error" }] };
  }
  if (file === "profile.md" || file === "~/profile.md" || file === "./profile.md") {
    if (!data.engineer) {
      return { lines: [{ text: "no engineer data", kind: "error" }] };
    }
    const out: CommandLine[] = [
      { text: "# profile.md", kind: "comment" },
      { text: "" },
    ];
    for (const line of data.engineer.selfPr.split("\n")) {
      out.push({ text: line });
    }
    out.push({ text: "" });
    if (data.engineer.qualifications.length > 0) {
      out.push({ text: "## 資格", kind: "header" });
      for (const q of data.engineer.qualifications) {
        out.push({ text: `  - ${q.name} (${q.acquiredYearMonth})`, kind: "muted" });
      }
      out.push({ text: "" });
    }
    return { lines: out };
  }
  // projects/<slug> or just <slug> (cwd 連動)
  // 拡張子 .md / .yaml は無視。数値だけの入力は zero-pad も試行 (`cat 1` → `01`)
  const stripped = file.replace(/\.(md|yaml)$/, "");
  const candidates: string[] = [];
  const addCandidate = (s: string) => {
    candidates.push(s);
    if (/^\d+$/.test(s)) candidates.push(s.padStart(2, "0"));
  };
  // 1. cwd === "~/projects" の場合は素の slug をそのまま
  if (ctx.cwd === "~/projects") addCandidate(stripped);
  // 2. "projects/" prefix を許容
  const m = stripped.match(/^(?:projects\/)?(.+)$/);
  if (m) addCandidate(m[1]!);
  for (const slug of candidates) {
    const project = data.projects.find((p) => p.slug === slug || p.name === slug);
    if (project) {
      const out: CommandLine[] = [
        { text: `# ${project.name}`, kind: "highlight" },
        { text: `  no:          ${project.no}`, kind: "muted" },
        { text: `  period:      ${project.periodStart} 〜 ${project.periodEnd ?? "現在"} (${project.periodLabel})`, kind: "muted" },
      ];
      if (project.companyName) out.push({ text: `  company:     @${project.companyName}`, kind: "muted" });
      if (project.roleName) out.push({ text: `  role:        ${project.roleName}`, kind: "muted" });
      if (project.scale) out.push({ text: `  scale:       全体 ${project.scale.total}人 / チーム ${project.scale.team}人`, kind: "muted" });
      if (project.industryTags.length > 0) out.push({ text: `  industry:    ${project.industryTags.join(", ")}`, kind: "muted" });
      if (project.techTags.length > 0) out.push({ text: `  tech:        ${project.techTags.join(", ")}`, kind: "muted" });
      if (project.phases.length > 0) out.push({ text: `  phases:      ${project.phases.join(" / ")}`, kind: "muted" });
      out.push({ text: "" });
      out.push({ text: "## summary", kind: "header" });
      for (const line of project.summary.split("\n")) {
        out.push({ text: line });
      }
      if (project.memo) {
        out.push({ text: "" });
        out.push({ text: "## memo (selfOnly)", kind: "header" });
        for (const line of project.memo.split("\n")) {
          out.push({ text: line, kind: "comment" });
        }
      }
      out.push({ text: "" });
      return { lines: out };
    }
  }
  return { lines: [{ text: `cat: ${file}: No such file or directory`, kind: "error" }] };
};

const treeHandler: CommandHandler = (args, data, ctx) => {
  const pathArg = args[0];
  const resolved = pathArg ? resolvePath(ctx.cwd, pathArg) : ctx.cwd;

  if (resolved === "~") {
    const out: CommandLine[] = [{ text: "~", kind: "highlight" }];
    const dirs = ["projects", "tech-tags", "industry-tags", "roles"];
    dirs.forEach((d, i) => {
      const isLast = i === dirs.length - 1;
      const branch = isLast ? "└── " : "├── ";
      out.push({ text: `${branch}${d}/` });
    });
    out.push({ text: "" });
    return { lines: out };
  }
  if (resolved === "~/projects") {
    const out: CommandLine[] = [{ text: "projects/", kind: "highlight" }];
    data.projects.forEach((p, i) => {
      const isLast = i === data.projects.length - 1;
      const branch = isLast ? "└── " : "├── ";
      out.push({ text: `${branch}${p.slug}` });
    });
    out.push({ text: "" });
    out.push({ text: `${data.projects.length} entries`, kind: "muted" });
    out.push({ text: "" });
    return { lines: out };
  }
  if (resolved === "~/tech-tags") {
    const out: CommandLine[] = [{ text: "tech-tags/", kind: "highlight" }];
    data.techTags.forEach((t, i) => {
      const isLast = i === data.techTags.length - 1;
      const branch = isLast ? "└── " : "├── ";
      out.push({ text: `${branch}${t.baseName} (${t.category})` });
    });
    out.push({ text: "" });
    out.push({ text: `${data.techTags.length} tags`, kind: "muted" });
    out.push({ text: "" });
    return { lines: out };
  }
  return { lines: [{ text: `tree: ${pathArg ?? resolved}: No such directory`, kind: "error" }] };
};

const lsHandler: CommandHandler = (args, data, ctx) => {
  const pathArg = args.find((a) => !a.startsWith("-"));
  const resolved = pathArg ? resolvePath(ctx.cwd, pathArg) : ctx.cwd;

  if (resolved === "~") {
    const out: CommandLine[] = [];
    for (const d of ["projects/", "tech-tags/", "industry-tags/", "roles/"]) {
      out.push({ text: d, kind: "default" });
    }
    out.push({ text: "" });
    return { lines: out };
  }
  if (resolved === "~/tech-tags") {
    const out: CommandLine[] = [];
    data.techTags.slice(0, 20).forEach((t) => {
      out.push({
        text: `${padRight(t.category, 12)} ${padRight(t.baseName, 24)} ${t.cumulativeYears.toFixed(1)} yrs  ${t.projectCount} prj`,
        kind: "default",
      });
    });
    out.push({ text: "" });
    return { lines: out };
  }
  if (resolved === "~/projects") {
    const out: CommandLine[] = [];
    data.projects.forEach((p) => {
      out.push({
        text: `${padRight(`#${p.no}`, 5)} ${padRight(p.periodStart, 9)} ${padRight(p.roleName ?? "-", 8)} ${p.name}`,
      });
    });
    out.push({ text: "" });
    return { lines: out };
  }
  if (resolved === "~/industry-tags") {
    const out: CommandLine[] = [];
    data.industryCounts.forEach((i) => {
      out.push({ text: `${padRight(i.name, 16)} ${i.count} prj` });
    });
    out.push({ text: "" });
    return { lines: out };
  }
  if (resolved === "~/roles") {
    const out: CommandLine[] = [];
    data.roleCounts.forEach((r) => {
      out.push({ text: `${padRight(r.name, 12)} ${r.count} prj` });
    });
    out.push({ text: "" });
    return { lines: out };
  }
  return { lines: [{ text: `ls: ${pathArg ?? resolved}: No such file or directory`, kind: "error" }] };
};

const grepHandler: CommandHandler = (args, data, ctx) => {
  const pattern = args[0];
  const pathArg = args[1];
  const resolved = pathArg ? resolvePath(ctx.cwd, pathArg) : ctx.cwd === "~" ? "~/projects" : ctx.cwd;

  if (!pattern) {
    return { lines: [{ text: "usage: grep <pattern> [<path>]", kind: "error" }] };
  }
  if (resolved === "~/projects") {
    const lower = pattern.toLowerCase();
    const matches = data.projects.filter(
      (p) =>
        p.name.toLowerCase().includes(lower) ||
        p.summary.toLowerCase().includes(lower) ||
        p.techTags.some((t) => t.toLowerCase().includes(lower)) ||
        p.industryTags.some((t) => t.toLowerCase().includes(lower)) ||
        (p.roleName && p.roleName.toLowerCase().includes(lower)),
    );
    if (matches.length === 0) {
      return { lines: [{ text: `(no matches for "${pattern}")`, kind: "muted" }, { text: "" }] };
    }
    const out: CommandLine[] = [];
    for (const p of matches) {
      out.push({ text: `projects/${p.slug}: ${p.name}`, kind: "highlight" });
    }
    out.push({ text: "" });
    out.push({ text: `# ${matches.length} matches`, kind: "comment" });
    out.push({ text: "" });
    return { lines: out };
  }
  return { lines: [{ text: `grep: ${pathArg ?? resolved}: No such file or directory`, kind: "error" }] };
};

const statsHandler: CommandHandler = (_args, data) => {
  const out: CommandLine[] = [
    { text: "─── stats ───", kind: "header" },
    { text: `  experience:    ${data.experienceYears} years`, kind: "default" },
    { text: `  projects:      ${data.totalProjectCount} cases`, kind: "default" },
    {
      text: `  top tech:      ${data.techTags.slice(0, 3).map((t) => t.baseName).join(", ")}`,
      kind: "default",
    },
    { text: "" },
    { text: "  phases:", kind: "muted" },
  ];
  for (const p of data.phaseCounts) {
    out.push({ text: `    ${padRight(p.label, 8)} ${p.count}`, kind: "muted" });
  }
  out.push({ text: "" });
  out.push({ text: "  roles:", kind: "muted" });
  for (const r of data.roleCounts) {
    out.push({ text: `    ${padRight(r.name, 8)} ${r.count}`, kind: "muted" });
  }
  out.push({ text: "" });
  if (data.industryCounts.length > 0) {
    out.push({ text: "  industries:", kind: "muted" });
    for (const i of data.industryCounts.slice(0, 8)) {
      out.push({ text: `    ${padRight(i.name, 12)} ${i.count}`, kind: "muted" });
    }
    out.push({ text: "" });
  }
  return { lines: out };
};

export const commands: Record<string, CommandHandler> = {
  help: helpHandler,
  whoami: whoamiHandler,
  pwd: pwdHandler,
  cd: cdHandler,
  cat: catHandler,
  tree: treeHandler,
  ls: lsHandler,
  grep: grepHandler,
  stats: statsHandler,
};

/** runner.ts の submitInput で特殊処理されるコマンド (commands には含まれない) */
const RUNNER_LEVEL_COMMANDS = ["clear", "replay"] as const;

/** 全コマンド名 (補完候補用) */
export function allCommandNames(): string[] {
  return [...Object.keys(commands), ...RUNNER_LEVEL_COMMANDS].sort();
}

/**
 * 入力バッファに対する補完候補を返す。
 * - 第1トークン位置: コマンド名候補
 * - cd/ls/tree の引数: ディレクトリ候補 (cwd 連動)
 * - cat の引数: profile.md + プロジェクト slug
 * - grep の第2引数 (path): ディレクトリ候補
 */
export function getCompletions(
  input: string,
  data: TerminalData,
  ctx: CommandContext,
): string[] {
  const trailingSpace = /\s$/.test(input);
  const trimmed = input.trim();
  const tokens = trimmed === "" ? [] : trimmed.split(/\s+/);

  // コマンド名位置
  if (trimmed === "" || (tokens.length <= 1 && !trailingSpace)) {
    const prefix = tokens[0] ?? "";
    return allCommandNames().filter((c) => c.startsWith(prefix));
  }

  const cmd = tokens[0]!;
  const lastToken = trailingSpace ? "" : tokens[tokens.length - 1] ?? "";

  if (cmd === "cd" || cmd === "ls" || cmd === "tree") {
    return completeDirArg(lastToken, ctx);
  }
  if (cmd === "cat") {
    return completeCatArg(lastToken, data, ctx);
  }
  if (cmd === "grep" && tokens.length + (trailingSpace ? 1 : 0) >= 3) {
    // grep の path 引数 (第2引数) のみ補完
    return completeDirArg(lastToken, ctx);
  }
  return [];
}

function completeDirArg(prefix: string, ctx: CommandContext): string[] {
  const dirs: string[] = [];
  if (ctx.cwd === "~") {
    dirs.push("projects", "tech-tags", "industry-tags", "roles");
  } else {
    dirs.push("..", "~");
  }
  return dirs.filter((d) => d.startsWith(prefix)).sort();
}

function completeCatArg(
  prefix: string,
  data: TerminalData,
  ctx: CommandContext,
): string[] {
  const files: string[] = [];
  if (ctx.cwd === "~/projects") {
    files.push(...data.projects.map((p) => p.slug));
  } else {
    files.push("profile.md");
    files.push(...data.projects.map((p) => `projects/${p.slug}`));
  }
  return files.filter((f) => f.startsWith(prefix)).sort();
}

export function runCommand(
  input: string,
  data: TerminalData,
  ctx: CommandContext,
): CommandResult {
  const trimmed = input.trim();
  if (!trimmed) return { lines: [] };
  const tokens = trimmed.split(/\s+/);
  const name = tokens[0];
  const args = tokens.slice(1);
  const handler = commands[name];
  if (!handler) {
    return {
      lines: [
        { text: `command not found: ${name}`, kind: "error" },
        { text: "(type 'help' to list commands)", kind: "muted" },
        { text: "" },
      ],
    };
  }
  return handler(args, data, ctx);
}
