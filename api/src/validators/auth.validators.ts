import { z } from 'zod';

const DeviceSchema = z
  .object({
    platform: z.enum(['android', 'ios']),
    name: z.string().min(1).max(100).optional(),
  })
  .strict();

const EmailSchema = z.string().email().max(254).transform((v) => v.trim().toLowerCase());
const PasswordSchema = z.string().min(8).max(128);
const RefreshTokenSchema = z.string().min(1).max(512);

export const RegisterSchema = z
  .object({
    email: EmailSchema,
    password: PasswordSchema,
    device: DeviceSchema.optional(),
  })
  .strict();

export const LoginSchema = z
  .object({
    email: EmailSchema,
    password: z.string().min(1).max(128),
    device: DeviceSchema.optional(),
  })
  .strict();

export const RefreshSchema = z.object({ refreshToken: RefreshTokenSchema }).strict();
export const LogoutSchema = z.object({ refreshToken: RefreshTokenSchema }).strict();

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
