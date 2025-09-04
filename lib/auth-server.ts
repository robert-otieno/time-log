import { adminAuth } from "@/lib/firebase-admin";

export async function getServerUser(req: Request) {
    const auth = req.headers.get("authorization") || req.headers.get("Authorization");
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;
    if (!token) return null;
    try {
        const decoded = await adminAuth.verifyIdToken(token);
        return { uid: decoded.uid, email: decoded.email || null };
    } catch {
        return null;
    }
}