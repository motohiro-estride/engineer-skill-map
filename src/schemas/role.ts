import { z } from "zod";

const publicRoleSchema = z.object({
  name: z.string(),
  rank: z.number().int().positive(),
});

const selfOnlyRoleSchema = z.object({
  memo: z.string().optional(),
});

export const roleSchema = z.object({
  public: publicRoleSchema,
  selfOnly: selfOnlyRoleSchema.optional(),
});

export type Role = z.infer<typeof roleSchema>;
