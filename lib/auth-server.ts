import "server-only";

import type { DecodedIdToken } from "firebase-admin/auth";

import { getAdminAuth } from "@/lib/firebase-admin";

export interface AuthActor {
  type: "user";
  uid: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
}

interface TokenVerifier {
  verifyIdToken(token: string, checkRevoked?: boolean): Promise<DecodedIdToken>;
  verifySessionCookie(cookie: string, checkRevoked?: boolean): Promise<DecodedIdToken>;
}

export class AuthenticationError extends Error {
  readonly code = "authentication_invalid";

  constructor() {
    super("Authentication credentials are invalid or expired.");
    this.name = "AuthenticationError";
  }
}

export function authActorFromClaims(token: DecodedIdToken): AuthActor {
  return {
    type: "user",
    uid: token.uid,
    email: token.email ?? null,
    emailVerified: token.email_verified ?? false,
    displayName: token.name ?? null,
  };
}

function requireCredential(value: string): string {
  const credential = value.trim();
  if (!credential) throw new AuthenticationError();
  return credential;
}

export async function verifyFirebaseIdToken(
  idToken: string,
  options: { checkRevoked?: boolean; verifier?: TokenVerifier } = {},
): Promise<AuthActor> {
  return authActorFromClaims(await verifyFirebaseIdTokenClaims(idToken, options));
}

export async function verifyFirebaseIdTokenClaims(
  idToken: string,
  options: { checkRevoked?: boolean; verifier?: TokenVerifier } = {},
): Promise<DecodedIdToken> {
  const token = requireCredential(idToken);
  const verifier = options.verifier ?? getAdminAuth();

  try {
    return await verifier.verifyIdToken(token, options.checkRevoked ?? false);
  } catch {
    throw new AuthenticationError();
  }
}

export async function verifyFirebaseSessionCookie(
  sessionCookie: string,
  options: { checkRevoked?: boolean; verifier?: TokenVerifier } = {},
): Promise<AuthActor> {
  const cookie = requireCredential(sessionCookie);
  const verifier = options.verifier ?? getAdminAuth();

  try {
    return authActorFromClaims(await verifier.verifySessionCookie(cookie, options.checkRevoked ?? true));
  } catch {
    throw new AuthenticationError();
  }
}

export async function getServerUser(request: Request): Promise<AuthActor | null> {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  try {
    return await verifyFirebaseIdToken(match[1]);
  } catch (error) {
    if (error instanceof AuthenticationError) return null;
    throw error;
  }
}
