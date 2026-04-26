import { z } from "zod";

const publicCompanySchema = z.object({
  name: z.string(),
  description: z.string().optional(),
});

const selfOnlyCompanySchema = z.object({
  memo: z.string().optional(),
});

export const companySchema = z.object({
  public: publicCompanySchema,
  selfOnly: selfOnlyCompanySchema.optional(),
});

export type Company = z.infer<typeof companySchema>;
