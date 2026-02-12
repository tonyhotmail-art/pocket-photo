import { z } from "zod";

/**
 * 環境變數 Schema 驗證
 * 所有環境變數必須透過此檔案存取,禁止直接使用 process.env
 */
const envSchema = z.object({
    // Firebase 客戶端 (公開)
    NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1, "Firebase API Key 為必填"),
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1, "Firebase Auth Domain 為必填"),
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1, "Firebase Project ID 為必填"),
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().min(1, "Firebase Storage Bucket 為必填"),
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1, "Firebase Messaging Sender ID 為必填"),
    NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1, "Firebase App ID 為必填"),

    // Firebase Admin (私密)
    FIREBASE_PROJECT_ID: z.string().min(1, "Firebase Admin Project ID 為必填"),
    FIREBASE_CLIENT_EMAIL: z.string().email("Firebase Client Email 格式錯誤"),
    FIREBASE_PRIVATE_KEY: z.string().min(1, "Firebase Private Key 為必填"),

    // Cloudflare R2 (私密)
    R2_ACCOUNT_ID: z.string().min(1, "R2 Account ID 為必填"),
    R2_ACCESS_KEY_ID: z.string().min(1, "R2 Access Key ID 為必填"),
    R2_SECRET_ACCESS_KEY: z.string().min(1, "R2 Secret Access Key 為必填"),
    R2_BUCKET_NAME: z.string().min(1, "R2 Bucket Name 為必填"),
    R2_PUBLIC_DOMAIN: z.string().url("R2 Public Domain 必須是有效的 URL"),

    // Google APIs (選用)
    NEXT_PUBLIC_GOOGLE_API_KEY: z.string().optional(),
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: z.string().optional(),
});

/**
 * 驗證並匯出環境變數
 * 如果驗證失敗,會在啟動時拋出錯誤
 */
export const env = envSchema.parse(process.env);

/**
 * 型別定義
 */
export type Env = z.infer<typeof envSchema>;
