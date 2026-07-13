"use strict";
/**
 * email.service.ts
 *
 * Thin wrapper around nodemailer using Gmail SMTP.
 *
 * Required env vars:
 *   GMAIL_USER          — the Gmail address used to send (e.g. noreply@yourdomain.com)
 *   GMAIL_APP_PASSWORD  — a Google "App Password" (not the account password)
 *   EMAIL_FROM_NAME     — display name, defaults to "Digilog"
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendWelcomeEmail = sendWelcomeEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
function createTransport() {
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;
    if (!user || !pass) {
        throw new Error('GMAIL_USER and GMAIL_APP_PASSWORD environment variables are required for email sending.');
    }
    return nodemailer_1.default.createTransport({
        service: 'gmail',
        auth: { user, pass },
    });
}
const FROM_NAME = process.env.EMAIL_FROM_NAME ?? 'Digilog';
// ── Helpers ───────────────────────────────────────────────────────────────────
function fromAddress() {
    const user = process.env.GMAIL_USER ?? '';
    return `"${FROM_NAME}" <${user}>`;
}
// ── Welcome email ─────────────────────────────────────────────────────────────
/**
 * Sends a welcome / onboarding email with the temporary password.
 * Non-throwing — callers should `.catch()` and log failures.
 */
async function sendWelcomeEmail(to, firstName, username, tempPassword) {
    const transport = createTransport();
    const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
      <h2 style="margin-bottom:4px">Welcome to ${FROM_NAME}, ${firstName}!</h2>
      <p style="color:#555;margin-top:0">Your account has been created by an administrator.</p>

      <table style="width:100%;border-collapse:collapse;margin:24px 0">
        <tr>
          <td style="padding:8px 12px;background:#f4f4f5;border-radius:6px 0 0 6px;font-weight:600;white-space:nowrap">Username</td>
          <td style="padding:8px 12px;background:#f4f4f5;border-radius:0 6px 6px 0;font-family:monospace">${username}</td>
        </tr>
        <tr><td colspan="2" style="height:6px"></td></tr>
        <tr>
          <td style="padding:8px 12px;background:#f4f4f5;border-radius:6px 0 0 6px;font-weight:600;white-space:nowrap">Temporary password</td>
          <td style="padding:8px 12px;background:#f4f4f5;border-radius:0 6px 6px 0;font-family:monospace">${tempPassword}</td>
        </tr>
      </table>

      <p style="color:#b45309;background:#fefce8;border:1px solid #fde68a;border-radius:6px;padding:10px 14px;font-size:14px">
        ⚠️ You will be required to change your password on first login. Please keep this email confidential.
      </p>

      <p style="font-size:13px;color:#888;margin-top:32px">
        If you did not expect this email, please contact your system administrator.
      </p>
    </div>
  `;
    await transport.sendMail({
        from: fromAddress(),
        to,
        subject: `Your ${FROM_NAME} account is ready`,
        html,
    });
}
