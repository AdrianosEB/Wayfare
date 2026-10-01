import bcrypt from "bcryptjs";

/** Password hashing via bcryptjs (pure JS, no native build). The auth contract requires cost ≥ 10. */

const COST = 12;

export const hashPassword = (plaintext: string): Promise<string> =>
  bcrypt.hash(plaintext, COST);

export const verifyPassword = (plaintext: string, hash: string): Promise<boolean> =>
  bcrypt.compare(plaintext, hash);
