import { getAuth } from "firebase/auth";

export async function getUserIdFromRequest(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const uid = await getAuth().currentUser?.uid;
    return uid || null;
  } catch {
    return null;
  }
}
