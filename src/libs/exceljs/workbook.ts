import ExcelJS from "exceljs";
import type { Cell, Worksheet } from "exceljs";

export type { Cell, Worksheet };

export async function readWorkbook(path: string): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  return wb;
}

export function cellText(cell: Cell): string {
  const v = cell.value;
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date) {
    const y = v.getUTCFullYear();
    const m = String(v.getUTCMonth() + 1).padStart(2, "0");
    const d = String(v.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    if (Array.isArray(obj.richText)) {
      return (obj.richText as { text: string }[]).map((r) => r.text).join("");
    }
    if (typeof obj.text === "string") return obj.text;
    if (obj.result != null) {
      if (obj.result instanceof Date) return cellText({ value: obj.result } as Cell);
      return String(obj.result);
    }
    if (typeof obj.formula === "string") return "";
  }
  return "";
}

export function isMasterCell(cell: Cell): boolean {
  return !cell.isMerged || cell.master === cell;
}

export function getRowMasterCells(ws: Worksheet, rowNumber: number, maxCol?: number): string[] {
  const row = ws.getRow(rowNumber);
  const colCount = maxCol ?? ws.actualColumnCount ?? ws.columnCount;
  const out: string[] = [];
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    if (!isMasterCell(cell)) {
      out.push("");
      continue;
    }
    out.push(cellText(cell).trim());
  }
  return out;
}
