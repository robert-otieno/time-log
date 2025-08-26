import jwt, { JwtHeader, JwtPayload } from "jsonwebtoken";

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

let publicKeys: Record<string, string> | null = null;

async function getPublicKeys() {
  if (!publicKeys) {
    const res = await fetch("https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com");
    publicKeys = await res.json();
  }
  return publicKeys;
}

export async function verifyToken(token?: string): Promise<(JwtPayload & { user_id?: string }) | null> {
  if (!token) return null;

  try {
    const keys = await getPublicKeys();
    const decodedHeader = jwt.decode(token, {
      complete: true,
    }) as { header: JwtHeader } | null;
    const kid = decodedHeader?.header?.kid;
    const key = kid && keys ? keys[kid] : undefined;
    if (!key || !projectId) return null;

    return jwt.verify(token, key, {
      audience: projectId,
      issuer: `https://securetoken.google.com/${projectId}`,
    }) as JwtPayload & { user_id?: string };
  } catch (err) {
    console.error("Failed to verify ID token", err);
    return null;
  }
}
