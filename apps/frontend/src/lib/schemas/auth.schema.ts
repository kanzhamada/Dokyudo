import { z } from 'zod';

const passwordValidation = z
	.string()
	.min(8, 'Password must be at least 8 characters')
	.max(72, 'Password is too long')
	.regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).+$/, 'Must contain uppercase, lowercase, number, and symbol (e.g. Secure@123)');

export const loginSchema = z.object({
	email: z.string().email('Invalid email address').max(255, 'Email is too long'),
	password: z.string().min(1, 'Password is required').max(72, 'Password is too long')
});

export const registerSchema = z
	.object({
		email: z.string().email('Invalid email address').max(255, 'Email is too long'),
		password: passwordValidation,
		confirmPassword: z.string().min(1, 'Please confirm your password')
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: 'Passwords do not match',
		path: ['confirmPassword']
	});

export type LoginSchema = typeof loginSchema;
export type RegisterSchema = typeof registerSchema;

export const forgotPasswordSchema = z.object({
	email: z.string().email('Invalid email address').max(255, 'Email is too long')
});
export type ForgotPasswordSchema = typeof forgotPasswordSchema;

export const updatePasswordSchema = z
	.object({
		password: passwordValidation,
		confirmPassword: z.string().min(1, 'Please confirm your password')
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: 'Passwords do not match',
		path: ['confirmPassword']
	});
export type UpdatePasswordSchema = typeof updatePasswordSchema;
