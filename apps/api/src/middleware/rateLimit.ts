import rateLimit from 'express-rate-limit';

/**
 * IP-based rate limiter for the login endpoint.
 * Acts as a fast first-pass defence before the DB-level per-username check.
 * 20 requests per 15-minute window per IP.
 */
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'RATE_LIMITED',
    message: 'Too many login attempts from this IP. Try again in 15 minutes.',
  },
  skipSuccessfulRequests: false,
});

/**
 * Stricter rate limiter for 2FA and token endpoints.
 * 10 requests per 5-minute window per IP.
 */
export const totpRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'RATE_LIMITED',
    message: 'Too many attempts. Try again in 5 minutes.',
  },
});
