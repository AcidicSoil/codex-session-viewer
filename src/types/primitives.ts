/** Primitive and branded types used across the data model */

/** ISO-8601 timestamp string, e.g., 2025-09-08T17:12:03.123Z */
export type ISO8601String = string & { readonly __brand: 'iso8601' }

/** Opaque ID string branding to avoid mixing different id kinds */
export type Id<T extends string> = string & { readonly __brand: T }

/** File system path (posix-like) */
export type FilePath = string & { readonly __brand: 'filepath' }
