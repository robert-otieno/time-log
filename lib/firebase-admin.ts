import { getApps, initializeApp, applicationDefault, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!getApps().length) {
    if (clientEmail && privateKey) {
        initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
    } else {
        // Fallback to ADC in local dev if you've set GOOGLE_APPLICATION_CREDENTIALS
        initializeApp({ credential: applicationDefault() });
    }
}

export const adminAuth = getAuth();
export const adminDb = getFirestore();