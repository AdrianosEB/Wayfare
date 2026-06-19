import bcrypt from "bcryptjs";

/**
 * Password hashing via bcryptjs (pure-JS, no native build). Cost factor 12 (≥ 10 per the
 * auth contract). Plaintext passwords are never stored or logged — only the resulting hash.
 */

const COST = 12;

export const hashPassword = (plaintext: string): Promise<string> =>
  bcrypt.hash(plaintext, COST);

export const verifyPassword = (plaintext: string, hash: string): Promise<boolean> =>
  bcrypt.compare(plaintext, hash);
