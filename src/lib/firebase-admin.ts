import "server-only"; // 強制此檔案僅能在 Server-side 執行，防止金鑰洩漏
import { createPrivateKey } from "node:crypto";
import { initializeApp, getApps, cert, getApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { env } from "./env";

/**
 * 正規化 Firebase Private Key，確保與 Node.js 18+/OpenSSL 3 相容。
 * 步驟：
 *   1. 清理環境變數中可能存在的多餘引號與跳脫字元
 *   2. 用 crypto.createPrivateKey() 解析原始 PEM
 *   3. 重新匯出為標準 PKCS#8 PEM 格式（OpenSSL 3 完全相容）
 */
function normalizePrivateKey(raw: string): string {
    // 清理：移除外層引號、把 \n 字面字串轉換為真實換行
    const cleaned = raw
        .trim()
        .replace(/^["']|["']$/g, '')
        .replace(/\\n/g, '\n');

    try {
        // 用 Node 內建 crypto 重新解析並匯出，確保格式正確
        const keyObj = createPrivateKey({ key: cleaned, format: 'pem' });
        return keyObj.export({ type: 'pkcs8', format: 'pem' }) as string;
    } catch (e) {
        // 若解析失敗（不應發生），降級回傳已清理的原始 key
        console.warn('[firebase-admin] Key 正規化失敗，使用原始 key:', e);
        return cleaned;
    }
}

const firebaseAdminConfig = {
    projectId: env.FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey: normalizePrivateKey(env.FIREBASE_PRIVATE_KEY),
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

/**
 * 取得 Firebase Admin Auth 實例
 * 用於產生 Custom Token（Clerk → Firebase 同步登入）
 */
export function getAdminAuth() {
    return getAuth(getAdminApp());
}

export const adminStorage = getStorage(getAdminApp());

/**
 * 取得 Firebase Admin Firestore 實例
 * 擁有無視 Security Rules 的最高權限（僅供可信賴的後端使用）
 */
export const adminDb = getFirestore(getAdminApp());

