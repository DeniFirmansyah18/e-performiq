import bcrypt from 'bcryptjs';

const BCRYPT_COST = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

/**
 * Mengembalikan false untuk hash yang rusak alih-alih melempar, agar
 * pemanggil tidak perlu membedakan "password salah" dari "hash korup".
 */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}
