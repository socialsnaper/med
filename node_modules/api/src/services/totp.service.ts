/**
 * totp.service.ts
 *
 * Handles all TOTP / 2FA operations:
 *  - Secret generation with AES-256-GCM encryption at rest
 *  - QR code generation
 *  - Code verification (with replay-attack window)
 *  - One-time backup code generation
 *
 * Copilot tip: "Using speakeasy, generate a TOTP secret,
 * encrypt it with AES-256-GCM using a key from
 * process.env.TOTP_ENCRYPTION_KEY, and return a QR code URL"
 */

import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';

const ALGORITHM  = 'aes-256-gcm' as const;
const APP_ISSUER = 'Digilog';

// ── Encryption key ────────────────────────────────────────────────────────────

function getEncryptionKey(): Buffer {
  const hex = process.env.TOTP_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      'TOTP_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }
  return Buffer.from(hex, 'hex');
}

// ── AES-256-GCM encrypt / decrypt ─────────────────────────────────────────────

/**
 * Encrypt a TOTP secret using AES-256-GCM.
 * Output format: `<iv_hex>:<authTag_hex>:<ciphertext_hex>`
 */
export function encryptSecret(plaintext: string): string {
  const key  = getEncryptionKey();
  const iv   = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag   = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt a TOTP secret previously encrypted with `encryptSecret()`.
 */
export function decryptSecret(ciphertext: string): string {
  const key  = getEncryptionKey();
  const parts = ciphertext.split(':');
  if (parts.length !== 3) throw new Error('Invalid ciphertext format');

  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv        = Buffer.from(ivHex,        'hex');
  const authTag   = Buffer.from(authTagHex,   'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return decipher.update(encrypted).toString('utf8') + decipher.final('utf8');
}

// ── Secret generation ─────────────────────────────────────────────────────────

export interface GeneratedSecret {
  /** base32-encoded plaintext secret — shown to user once / encoded in QR. Never persisted. */
  secret: string;
  /** AES-256-GCM encrypted secret — safe to store in the database. */
  encryptedSecret: string;
  /** otpauth:// URL — pass to generateQrCode() */
  otpauthUrl: string;
}

/**
 * Generate a new TOTP secret for `username`.
 */
export function generateSecret(username: string, issuer = APP_ISSUER): GeneratedSecret {
  const generated = speakeasy.generateSecret({
    name:   `${issuer}:${username}`,
    issuer,
    length: 20,
  });

  const secret          = generated.base32!;
  const otpauthUrl      = generated.otpauth_url!;
  const encryptedSecret = encryptSecret(secret);

  return { secret, encryptedSecret, otpauthUrl };
}

// ── QR code ───────────────────────────────────────────────────────────────────

/**
 * Convert an `otpauth://` URL into a base64 data URL suitable for an <img> tag.
 */
export async function generateQrCode(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl);
}

// ── Code verification ─────────────────────────────────────────────────────────

/**
 * Verify a 6-digit TOTP code against an encrypted secret stored in the DB.
 * A window of ±1 step (±30 s) is allowed to tolerate minor clock skew.
 */
export function verifyCode(encryptedSecret: string, token: string): boolean {
  const secret = decryptSecret(encryptedSecret);
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 1,
  });
}

// ── Backup codes ──────────────────────────────────────────────────────────────

/**
 * Generate 8 one-time backup codes.
 *
 * Format: `xxxx-xxxx` (two groups of 4 lowercase hex characters).
 *
 * // Generate 8 backup codes
 * const codes = Array.from({length: 8}, () =>
 *   crypto.randomBytes(4).toString('hex')
 *     .match(/.{4}/g)!.join('-')
 * )
 */
export function generateBackupCodes(): string[] {
  return Array.from({ length: 8 }, () => {
    const hex     = crypto.randomBytes(4).toString('hex'); // 8 hex chars
    const [a, b]  = hex.match(/.{4}/g) as [string, string];
    return `${a}-${b}`;
  });
}
