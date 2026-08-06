import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().default(false),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email"),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// Self-registration (phases-plan 1.4). Same field set as Client-Requests.md
// "Fields (same for both)" — self-registration and superadmin direct
// creation share one profile shape, just a different starting status.
// Profile picture is handled separately as multipart form data, not part
// of this JSON schema (matches uploadProfilePicture's File-based API).
export const registerSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  middleName: z.string().trim().optional(),
  lastName: z.string().trim().min(1, "Last name is required"),
  suffix: z.string().trim().optional(),
  contactNumber: z.string().trim().optional(),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email"),
  description: z.string().trim().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type RegisterInput = z.infer<typeof registerSchema>;

// Profile edit (phases-plan 1.7). Same profile fields as registerSchema,
// minus password and email — changing your password is reset-password's
// job (lib/auth/reset-token.ts), and email changes aren't in
// Client-Requests.md's edit scope, only its create-account field list, so
// this only covers what the profile page actually lets you change.
export const profileUpdateSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  middleName: z.string().trim().optional(),
  lastName: z.string().trim().min(1, "Last name is required"),
  suffix: z.string().trim().optional(),
  contactNumber: z.string().trim().optional(),
  description: z.string().trim().optional(),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
