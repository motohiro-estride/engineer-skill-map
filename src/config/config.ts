export type BuildMode = "public" | "excel" | "local";

const VALID_BUILD_MODES: readonly BuildMode[] = ["public", "excel", "local"];

export function getBuildMode(): BuildMode {
  const raw = process.env.BUILD_MODE;
  const mode = (raw ?? "local") as BuildMode;
  if (!VALID_BUILD_MODES.includes(mode)) {
    throw new Error(
      `Unknown BUILD_MODE: "${raw}". Valid values: ${VALID_BUILD_MODES.join(", ")}`,
    );
  }
  return mode;
}
