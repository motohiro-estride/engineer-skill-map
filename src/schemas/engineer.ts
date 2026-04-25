import { z } from "zod";
import { dateSchema, yearMonthSchema } from "./common";

const qualificationSchema = z.object({
  name: z.string(),
  acquiredYearMonth: yearMonthSchema,
});

const stationSchema = z.object({
  line: z.string(),
  station: z.string(),
  walkMinutes: z.number().int().nonnegative().optional(),
  busMinutes: z.number().int().nonnegative().optional(),
});

const overtimeSchema = z.object({
  available: z.boolean(),
  maxHoursPerMonth: z.number().int().positive().optional(),
});

const trinaryAvailabilitySchema = z.enum(["可", "不可", "応相談"]);

const publicEngineerSchema = z.object({
  gender: z.enum(["男性", "女性"]),
  nationality: z.string(),
  finalEducation: z.string(),
  workableArea: z.string(),
  overtime: overtimeSchema,
  weekendWork: trinaryAvailabilitySchema,
  businessTrip: trinaryAvailabilitySchema,
  domainKnowledge: z.string(),
  selfPr: z.string(),
  qualifications: z.array(qualificationSchema),
});

const excelOnlyEngineerSchema = z.object({
  name: z.string(),
  birthDate: dateSchema,
  station: stationSchema,
  workableFrom: dateSchema,
});

export const engineerFileSchema = z.object({
  public: publicEngineerSchema,
  excelOnly: excelOnlyEngineerSchema,
});

export type EngineerFile = z.infer<typeof engineerFileSchema>;
