import { z } from "zod";

/**
 * Client-side Environment Variables Schema
 * Only variables starting with NEXT_PUBLIC_ are accessible in the browser.
 */
const clientEnvSchema = z.object({
    // Firebase Client (Public)
    NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1, "Firebase API Key 為必填"),
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1, "Firebase Auth Domain 為必填"),
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1, "Firebase Project ID 為必填"),
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().min(1, "Firebase Storage Bucket 為必填"),
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1, "Firebase Messaging Sender ID 為必填"),
    NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1, "Firebase App ID 為必填"),
    NEXT_PUBLIC_TENANT_ID: z.string().default("default"),

    // Google APIs (Optional)
    NEXT_PUBLIC_GOOGLE_API_KEY: z.string().optional(),
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: z.string().optional(),

    // Clerk Authentication (Public)
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1, "Clerk Publishable Key 為必填"),
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: z.string().default("/sign-in"),
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: z.string().default("/sign-up"),
    NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL: z.string().default("/"),
    NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL: z.string().default("/"),
});


/**
 * Server-side Environment Variables Schema
 * Extends client schema with private variables.
 */
const serverEnvSchema = clientEnvSchema.extend({
    // Firebase Admin (Private)
    FIREBASE_PROJECT_ID: z.string().min(1, "Firebase Admin Project ID 為必填"),
    FIREBASE_CLIENT_EMAIL: z.string().email("Firebase Client Email 格式錯誤"),
    FIREBASE_PRIVATE_KEY: z.string().min(1, "Firebase Private Key 為必填"),

    // Cloudflare R2 (Private)
    R2_ACCOUNT_ID: z.string().min(1, "R2 Account ID 為必填"),
    R2_ACCESS_KEY_ID: z.string().min(1, "R2 Access Key ID 為必填"),
    R2_SECRET_ACCESS_KEY: z.string().min(1, "R2 Secret Access Key 為必填"),
    R2_BUCKET_NAME: z.string().min(1, "R2 Bucket Name 為必填"),
    R2_PUBLIC_DOMAIN: z.string().url("R2 Public Domain 必須是有效的 URL").optional().or(z.literal("")),

    // Clerk Authentication (Private)
    CLERK_SECRET_KEY: z.string().min(1, "Clerk Secret Key 為必填"),

    // 雙水管切換開關 (auth pipe selector)
    // 'clerk'    = 優先用 Clerk publicMetadata，失敗則 fallback 到 Firestore
    // 'firebase' = 優先用 Firestore admins 集合，失敗則 fallback 到 Clerk
    // 'clerk-only'    = 只用 Clerk，完全不查 Firestore
    // 'firebase-only' = 只用 Firestore，完全不查 Clerk
    AUTH_PIPE: z.enum(['clerk', 'firebase', 'clerk-only', 'firebase-only']).default('clerk'),
});

const _clientEnv = clientEnvSchema.safeParse({
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    NEXT_PUBLIC_TENANT_ID: process.env.NEXT_PUBLIC_TENANT_ID,
    NEXT_PUBLIC_GOOGLE_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_API_KEY,
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL,
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL,
    NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL,
    NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL,
});


if (!_clientEnv.success) {
    console.error("❌ Invalid client environment variables:", _clientEnv.error.format());
}

export const clientEnv = _clientEnv.success ? _clientEnv.data : {} as z.infer<typeof clientEnvSchema>;

// Only validate server env if we are on the server
const isServer = typeof window === 'undefined';
const _serverEnv = isServer ? serverEnvSchema.safeParse(process.env) : { success: true, data: {} as any };

if (isServer && !_serverEnv.success && 'error' in _serverEnv) {
    console.error("❌ Invalid environment variables:", _serverEnv.error.format());
    throw new Error("Invalid environment variables");
}

type ServerEnv = z.infer<typeof serverEnvSchema>;
export const env = (isServer && _serverEnv.success ? _serverEnv.data : clientEnv) as ServerEnv;
