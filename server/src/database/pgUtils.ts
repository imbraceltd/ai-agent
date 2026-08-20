/**
 * PostgreSQL utility functions
 */

import { genSaltSync, hashSync } from "bcrypt-ts";

/**
 * Generate a hashed password using bcrypt
 */
export function generateHashedPassword(password: string): string {
  const salt = genSaltSync(10);
  const hash = hashSync(password, salt);
  return hash;
}

/**
 * Generate a UUID v4
 */
export function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
