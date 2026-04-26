import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { parseYaml } from "@/libs/js-yaml";

// 公開ビルド成果物 (dist/) に excelOnly / selfOnly 由来の値が含まれていないかを検査するスクリプト。
// 1件でも検出したら exit 1 で deploy をブロックする。

const PRIVATE_DIR = "private";
const DIST_DIR = "dist";
const TEXT_EXT = new Set([
  ".html",
  ".js",
  ".mjs",
  ".cjs",
  ".css",
  ".json",
  ".txt",
  ".xml",
  ".svg",
  ".map",
]);
const MIN_LENGTH = 3; // 短すぎる値 (空文字, "OS" 等) は false positive の元なので除外

function collectBlacklist(): { value: string; source: string }[] {
  const items: { value: string; source: string }[] = [];

  // engineer.yaml の excelOnly セクション
  try {
    const text = readFileSync(join(PRIVATE_DIR, "engineer.yaml"), "utf-8");
    const data = parseYaml<{
      me?: {
        excelOnly?: {
          birthDate?: string;
          station?: { line?: string; station?: string };
          workableFrom?: string;
        };
      };
    }>(text);
    const excel = data?.me?.excelOnly;
    if (excel) {
      const push = (v: unknown, source: string) => {
        if (typeof v === "string" && v.length >= MIN_LENGTH) {
          items.push({ value: v, source });
        }
      };
      push(excel.birthDate, "engineer.excelOnly.birthDate");
      push(excel.station?.line, "engineer.excelOnly.station.line");
      push(excel.station?.station, "engineer.excelOnly.station.station");
      push(excel.workableFrom, "engineer.excelOnly.workableFrom");
    }
  } catch (e) {
    console.warn(`[verify-no-leak] engineer.yaml 読み込みスキップ: ${(e as Error).message}`);
  }

  // projects/*.yaml の selfOnly.memo
  const projectsDir = join(PRIVATE_DIR, "projects");
  try {
    for (const file of readdirSync(projectsDir)) {
      if (!file.endsWith(".yaml")) continue;
      const text = readFileSync(join(projectsDir, file), "utf-8");
      const data = parseYaml<{ selfOnly?: { memo?: string } }>(text);
      const memo = data?.selfOnly?.memo;
      if (typeof memo === "string" && memo.length >= MIN_LENGTH) {
        items.push({ value: memo, source: `projects/${file} selfOnly.memo` });
      }
    }
  } catch (e) {
    console.warn(`[verify-no-leak] projects/ 読み込みスキップ: ${(e as Error).message}`);
  }

  return items;
}

function* walkFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      yield* walkFiles(full);
    } else if (s.isFile()) {
      yield full;
    }
  }
}

function main() {
  const blacklist = collectBlacklist();
  console.log(`[verify-no-leak] blacklist: ${blacklist.length} 件`);

  if (blacklist.length === 0) {
    console.log("[verify-no-leak] 検査対象なし、OK");
    return;
  }

  let distExists = false;
  try {
    statSync(DIST_DIR);
    distExists = true;
  } catch {
    /* not exists */
  }
  if (!distExists) {
    console.error(`[verify-no-leak] ${DIST_DIR}/ が存在しません。先に \`yarn build\` してください`);
    process.exit(1);
  }

  let hits = 0;
  for (const file of walkFiles(DIST_DIR)) {
    if (!TEXT_EXT.has(extname(file).toLowerCase())) continue;
    const content = readFileSync(file, "utf-8");
    for (const { value, source } of blacklist) {
      if (content.includes(value)) {
        console.error(
          `[verify-no-leak] LEAK: ${file} に "${value}" (${source}) が含まれています`,
        );
        hits++;
      }
    }
  }

  if (hits > 0) {
    console.error(
      `[verify-no-leak] ${hits} 件の漏洩を検出、deploy をブロックします`,
    );
    process.exit(1);
  }
  console.log("[verify-no-leak] OK (漏洩なし)");
}

main();
