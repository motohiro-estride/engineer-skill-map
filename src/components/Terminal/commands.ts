// ターミナルコマンド定義。input(コマンド名 + 引数)を受け取って出力行配列を返す。
// 純粋関数として実装。副作用は runner.ts 側で扱う。

import type { TerminalData } from "./data-source";

export interface CommandLine {
  /** 行のテキスト */
  text: string;
  /** スタイル種別(色分け用) */
  kind?: "default" | "muted" | "highlight" | "error" | "comment" | "header";
}

export interface CommandResult {
  lines: CommandLine[];
}

export type CommandHandler = (
  args: string[],
  data: TerminalData,
) => CommandResult;

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

const helpHandler: CommandHandler = () => ({
  lines: [
    { text: "available commands:", kind: "header" },
    { text: "  whoami           profile summary", kind: "muted" },
    { text: "  cat <file>       show file content (profile.md, projects/<slug>.md)", kind: "muted" },
    { text: "  tree [<path>]    show directory tree (projects/, tech-tags/, ...)", kind: "muted" },
    { text: "  ls [<path>]      list entries", kind: "muted" },
    { text: "  grep <pat> <p>   search pattern in path", kind: "muted" },
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
  const namePart = eng.name ? eng.name : "(name hidden in public mode)";
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

const catHandler: CommandHandler = (args, data) => {
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
  // projects/<slug>.md or just <slug>
  const projectMatch = file.match(/^(?:projects\/)?([^\/]+?)(?:\.md)?$/);
  if (projectMatch) {
    const slug = projectMatch[1];
    const project = data.projects.find((p) => p.slug === slug || p.slug === `${slug}` || p.name === slug);
    if (project) {
      const out: CommandLine[] = [
        { text: `# ${project.name}`, kind: "highlight" },
        { text: `  no:          ${project.no}`, kind: "muted" },
        { text: `  period:      ${project.periodStart} 〜 ${project.periodEnd ?? "現在"} (${project.periodLabel})`, kind: "muted" },
      ];
      if (project.roleName) out.push({ text: `  role:        ${project.roleName}`, kind: "muted" });
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

const treeHandler: CommandHandler = (args, data) => {
  const path = args[0] ?? "projects/";
  if (path === "projects/" || path === "projects" || path === "./projects") {
    const out: CommandLine[] = [{ text: "projects/", kind: "highlight" }];
    data.projects.forEach((p, i) => {
      const isLast = i === data.projects.length - 1;
      const branch = isLast ? "└── " : "├── ";
      out.push({ text: `${branch}${p.slug}` });
    });
    out.push({ text: "" });
    out.push({ text: `${data.projects.length} directories`, kind: "muted" });
    out.push({ text: "" });
    return { lines: out };
  }
  if (path === "tech-tags/" || path === "tech-tags") {
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
  return { lines: [{ text: `tree: ${path}: No such file or directory`, kind: "error" }] };
};

const lsHandler: CommandHandler = (args, data) => {
  const path = args.find((a) => !a.startsWith("-")) ?? "tech-tags/";
  if (path === "tech-tags/" || path === "tech-tags") {
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
  if (path === "projects/" || path === "projects") {
    const out: CommandLine[] = [];
    data.projects.forEach((p) => {
      out.push({
        text: `${padRight(`#${p.no}`, 5)} ${padRight(p.periodStart, 9)} ${padRight(p.roleName ?? "-", 8)} ${p.name}`,
      });
    });
    out.push({ text: "" });
    return { lines: out };
  }
  return { lines: [{ text: `ls: ${path}: No such file or directory`, kind: "error" }] };
};

const grepHandler: CommandHandler = (args, data) => {
  const pattern = args[0];
  const path = args[1] ?? "projects/";
  if (!pattern) {
    return { lines: [{ text: "usage: grep <pattern> <path>", kind: "error" }] };
  }
  if (path === "projects/" || path === "projects" || path === "-r") {
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
  return { lines: [{ text: `grep: ${path}: No such file or directory`, kind: "error" }] };
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
  cat: catHandler,
  tree: treeHandler,
  ls: lsHandler,
  grep: grepHandler,
  stats: statsHandler,
};

export function runCommand(input: string, data: TerminalData): CommandResult {
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
  return handler(args, data);
}
