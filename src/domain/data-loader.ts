import type { BuildMode } from "@/config";
import type { EngineerFile, ProjectFile } from "@/schemas";

/**
 * Project の section を BUILD_MODE に応じて展開し、フラット化された業務オブジェクトを返す。
 * - public/excel: public フィールドのみ
 * - local: public + selfOnly.memo
 */
export function expandProject(file: ProjectFile, mode: BuildMode) {
  return {
    visibility: file.visibility,
    ...file.public,
    memo: mode === "local" ? file.selfOnly?.memo : undefined,
  };
}

/**
 * Engineer の section を BUILD_MODE に応じて展開。
 * - public: public のみ
 * - excel/local: public + excelOnly
 */
export function expandEngineer(file: EngineerFile, mode: BuildMode) {
  if (mode === "public") {
    return file.public;
  }
  return { ...file.public, ...file.excelOnly };
}
