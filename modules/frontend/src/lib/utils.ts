import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges conditional class values with Tailwind conflict resolution.
 *
 * @param inputs Class values accepted by clsx.
 * @returns A merged class string.
 * @since 0.0.1
 */
export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/**
 * Removes a `child` prop from a type when present.
 *
 * @since 0.0.1
 */
export type WithoutChild<T> = T extends { child?: unknown } ? Omit<T, "child"> : T;

/**
 * Removes a `children` prop from a type when present.
 *
 * @since 0.0.1
 */
export type WithoutChildren<T> = T extends { children?: unknown } ? Omit<T, "children"> : T;

/**
 * Removes both `children` and `child` props from a type when present.
 *
 * @since 0.0.1
 */
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;

/**
 * Adds an optional element ref prop to a type.
 *
 * @since 0.0.1
 */
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & {
	ref?: U | null;
};
