export interface PreAuthTokenPayload {
  sub: string;  // userId
  sid: string;  // tenant schemaName
  stage: 'pre_auth' | 'password_change';
  iat?: number;
  exp?: number;
}

export interface AccessTokenPayload {
  sub: string;      // userId
  sid: string;      // tenant schemaName
  role: string;     // roleId
  roleName: string; // human-readable role name
  username: string;
  firstName: string;
  lastName: string;
  perms: Record<string, string>;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  sub: string;  // userId
  sid: string;  // tenant schemaName
  jti: string;  // UUID matching RefreshToken.id in DB
  iat?: number;
  exp?: number;
}

/** Attached to req.user by requireAccessToken middleware */
export interface AuthenticatedUser {
  id: string;
  schemaName: string;
  roleId: string;
  roleName: string;
  permissions: Record<string, string>;
}

export interface UserSummary {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  role: string;
}

/** Returned after full authentication is complete */
export interface AuthTokensResult {
  access_token: string;
  refresh_token: string;
  user: UserSummary;
}

/** Returned by POST /api/auth/login */
export interface LoginResult {
  pre_auth_token?: string;
  access_token?: string;
  refresh_token?: string;
  user?: UserSummary;
  requires_totp: boolean;
  requires_password_change: boolean;
}
