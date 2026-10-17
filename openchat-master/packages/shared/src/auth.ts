import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().email("Invalid email format").max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

export const settingsUpdateSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  customInstructions: z.string().nullable().optional(),
  defaultModel: z.string().nullable().optional(),
  memoryEnabled: z.boolean().optional(),
  responseStyle: z.enum(["concise", "balanced", "detailed", "formal"]).optional(),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type SettingsUpdateInput = z.infer<typeof settingsUpdateSchema>;
