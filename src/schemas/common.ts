import { z } from "zod";

export const visibilitySchema = z.enum(["default", "stats_only", "archived"]);
export type Visibility = z.infer<typeof visibilitySchema>;

export const yearMonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "YYYY-MM 形式で記述してください");

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 形式で記述してください");

export const periodSchema = z.object({
  start: yearMonthSchema,
  end: yearMonthSchema.nullable(),
});

export type Period = z.infer<typeof periodSchema>;
