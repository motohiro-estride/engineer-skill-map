import type { BuildMode } from "@/config";
import type { Visibility } from "@/schemas";

/**
 * Project の visibility と BUILD_MODE から、表示すべきかを判定。
 * - local: 全 visibility 表示 (棚卸し用途)
 * - public/excel: visibility=default のみ (stats_only / archived は除外)
 */
export function isProjectVisible(visibility: Visibility, mode: BuildMode): boolean {
  if (mode === "local") return true;
  return visibility === "default";
}

/**
 * 集計対象 (TechTag 累積年数等) に含めるかを判定。
 * archived のみ除外、default と stats_only は含む。
 */
export function isProjectInStats(visibility: Visibility): boolean {
  return visibility !== "archived";
}
