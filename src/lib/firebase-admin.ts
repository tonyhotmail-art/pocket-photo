
import { initializeApp, getApps, cert, getApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";

// 為了避免 Next.js 熱重載造成重複初始化，我們建立一個單例模式
const firebaseAdminConfig = {
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

export function getAdminApp() {
    if (getApps().length > 0) {
        return getApp();
    }

    // 這裡我們需要使用 Service Account，但因為使用者尚未提供，我們先嘗試使用默認憑證或警告
    // 如果環境變數中有 FIREBASE_PRIVATE_KEY 則使用 cert，否則這將會報錯，提示使用者設定
    if (process.env.FIREBASE_PRIVATE_KEY) {
        return initializeApp({
            credential: cert(firebaseAdminConfig),
            storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
        });
    }

    // 如果沒有密鑰，嘗試不帶憑證初始化 (這在某些 google cloud 環境會通，但在本地可能會失敗)
    // 但這是過渡方案，最終還是需要 key
    return initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    });
}

export const adminStorage = getStorage(getAdminApp());
