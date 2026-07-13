"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptSecret = encryptSecret;
exports.decryptSecret = decryptSecret;
exports.generateSecret = generateSecret;
exports.generateQrCode = generateQrCode;
exports.verifyCode = verifyCode;
exports.generateBackupCodes = generateBackupCodes;
const speakeasy_1 = __importDefault(require("speakeasy"));
const qrcode_1 = __importDefault(require("qrcode"));
const crypto_1 = __importDefault(require("crypto"));
const ALGORITHM = 'aes-256-gcm';
const APP_ISSUER = 'Digilog';
// ── Encryption key ────────────────────────────────────────────────────────────
function getEncryptionKey() {
    const hex = process.env.TOTP_ENCRYPTION_KEY;
    if (!hex || hex.length !== 64) {
        throw new Error('TOTP_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
            'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    }
    return Buffer.from(hex, 'hex');
}
// ── AES-256-GCM encrypt / decrypt ─────────────────────────────────────────────
/**
 * Encrypt a TOTP secret using AES-256-GCM.
 * Output format: `<iv_hex>:<authTag_hex>:<ciphertext_hex>`
 */
function encryptSecret(plaintext) {
    const key = getEncryptionKey();
    const iv = crypto_1.default.randomBytes(12);
    const cipher = crypto_1.default.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}
/**
 * Decrypt a TOTP secret previously encrypted with `encryptSecret()`.
 */
function decryptSecret(ciphertext) {
    const key = getEncryptionKey();
    const parts = ciphertext.split(':');
    if (parts.length !== 3)
        throw new Error('Invalid ciphertext format');
    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const decipher = crypto_1.default.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted).toString('utf8') + decipher.final('utf8');
}
/**
 * Generate a new TOTP secret for `username`.
 */
function generateSecret(username, issuer = APP_ISSUER) {
    const generated = speakeasy_1.default.generateSecret({
        name: `${issuer}:${username}`,
        issuer,
        length: 20,
    });
    const secret = generated.base32;
    const otpauthUrl = generated.otpauth_url;
    const encryptedSecret = encryptSecret(secret);
    return { secret, encryptedSecret, otpauthUrl };
}
// ── QR code ───────────────────────────────────────────────────────────────────
/**
 * Convert an `otpauth://` URL into a base64 data URL suitable for an <img> tag.
 */
async function generateQrCode(otpauthUrl) {
    return qrcode_1.default.toDataURL(otpauthUrl);
}
// ── Code verification ─────────────────────────────────────────────────────────
/**
 * Verify a 6-digit TOTP code against an encrypted secret stored in the DB.
 * A window of ±1 step (±30 s) is allowed to tolerate minor clock skew.
 */
function verifyCode(encryptedSecret, token) {
    const secret = decryptSecret(encryptedSecret);
    return speakeasy_1.default.totp.verify({
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
function generateBackupCodes() {
    return Array.from({ length: 8 }, () => {
        const hex = crypto_1.default.randomBytes(4).toString('hex'); // 8 hex chars
        const [a, b] = hex.match(/.{4}/g);
        return `${a}-${b}`;
    });
}
