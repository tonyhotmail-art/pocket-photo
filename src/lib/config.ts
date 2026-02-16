
interface AccessConfig {
  tenantId?: string; // Reserved for multi-tenant support
}

export const siteConfig = {
  name: "KELLY PHOTO",
  description: "Makeup Artist Portfolio",
  lineAtUrl: "https://line.me/R/ti/p/@your_id", // 請替換成您的 LINE@ 連結
  lineId: "@your_id",
  instagramUrl: "https://instagram.com/",
  facebookUrl: "https://facebook.com/",
};

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const accessConfig: AccessConfig = {
  tenantId: process.env.NEXT_PUBLIC_TENANT_ID, // Optional
};
