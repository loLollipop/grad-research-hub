import { z } from "zod";

export const accessSettingsSchema = z
  .object({
    currentPassword: z.string().trim().min(1),
    newPassword: z.string().trim().min(8).max(120),
    confirmPassword: z.string().trim(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
  });

export const zoteroSettingsSchema = z.object({
  apiKey: z.string().trim().max(4_000).default(""),
  libraryId: z.string().trim().min(1).max(80),
  libraryType: z.enum(["user", "group"]).default("user"),
  collectionKey: z.string().trim().max(120).default(""),
  syncLimit: z
    .string()
    .trim()
    .transform((value) => Number(value || 100))
    .refine((value) => Number.isInteger(value) && value >= 1 && value <= 500),
});
