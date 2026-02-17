import { clientEnv } from "./env";

interface AccessConfig {
  tenantId?: string; // Reserved for multi-tenant support
}

export const siteConfig = {
  name: "Antigravity Portfolio",
  description: "A type-A personal portfolio module.",
};

console.log("[Config] Loading Firebase Config...");
console.log("[Config] API Key present:", !!clientEnv.NEXT_PUBLIC_FIREBASE_API_KEY);
console.log("[Config] Auth Domain:", clientEnv.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN);

export const firebaseConfig = {
  apiKey: clientEnv.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: clientEnv.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: clientEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: clientEnv.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: clientEnv.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: clientEnv.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const accessConfig: AccessConfig = {
  tenantId: clientEnv.NEXT_PUBLIC_TENANT_ID, // 使用 env 中的預設值或設定值
};
