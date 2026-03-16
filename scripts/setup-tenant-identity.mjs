import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";

// 載入環境變數
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env.local") });

const firebaseConfig = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

if (!firebaseConfig.projectId || !firebaseConfig.clientEmail || !firebaseConfig.privateKey) {
    console.error("❌ 錯誤：找不到必要的 Firebase Admin 環境變數。請檢查 .env.local");
    process.exit(1);
}

if (getApps().length === 0) {
    initializeApp({
        credential: cert(firebaseConfig),
    });
}

const db = getFirestore();

async function setupTenant() {
    const slug = "antigravity";
    console.log(`\n🚀 開始為店鋪 [${slug}] 建立身分證...`);

    try {
        const tenantsRef = db.collection("tenants");
        const snapshot = await tenantsRef.where("slug", "==", slug).get();

        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            console.log(`✅ 店鋪 [${slug}] 已存在身分證：${doc.id}`);
            console.log(`📊 租戶 ID: ${doc.data().tenantId}`);
            return;
        }

        // 建立全新的身分證
        const newTenantId = `tenant_${uuidv4().substring(0, 8)}`;
        const newTenant = {
            tenantId: newTenantId,
            slug: slug,
            name: "Antigravity Portfolio",
            ownerEmail: "tony.hotmail@gmail.com",
            plan: "pro",
            status: "active",
            createdAt: new Date().toISOString(),
        };

        const docRef = await tenantsRef.add(newTenant);
        console.log(`🎉 成功！店鋪 [${slug}] 的身分證已建立。`);
        console.log(`🆔 文件 ID: ${docRef.id}`);
        console.log(`🆔 租戶 ID (身分證號): ${newTenantId}`);

    } catch (error) {
        console.error("❌ 建立失敗:", error);
    }
}

setupTenant().then(() => console.log("\n✨ 腳本執行完畢。"));
