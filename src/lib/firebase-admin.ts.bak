import { initializeApp, getApps, cert, getApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { env } from "./env";

// 為了避免 Next.js 熱重載造成重複初始化，我們建立一個單例模式
const firebaseAdminConfig = {
    projectId: env.FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
};

export function getAdminApp() {
    if (getApps().length > 0) {
        return getApp();
    }

    // 這裡我們需要使用 Service Account
    return initializeApp({
        credential: cert(firebaseAdminConfig),
        storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    });
}

export const adminStorage = getStorage(getAdminApp());
