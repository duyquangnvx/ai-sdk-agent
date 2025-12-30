/**
 * Common schemas used across the application
 */
import { z } from "zod";

// Vector3 for position, rotation, scale
export const Vector3Schema = z.object({
	x: z.number(),
	y: z.number(),
	z: z.number(),
});
export type Vector3 = z.infer<typeof Vector3Schema>;

// RGBA color
export const ColorSchema = z.object({
	r: z.number().min(0).max(255),
	g: z.number().min(0).max(255),
	b: z.number().min(0).max(255),
	a: z.number().min(0).max(1).default(1),
});
export type Color = z.infer<typeof ColorSchema>;
