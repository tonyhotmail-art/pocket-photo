import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env.local") });

const firebaseConfig = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

if (getApps().length === 0) {
    initializeApp({
        credential: cert(firebaseConfig),
    });
}

const db = getFirestore();

async function checkPhotos() {
    console.log("🚀 正在查詢 KELLYPHOTO 相關租戶與照片...");

    // 1. 先列出所有租戶 (Tenants)
    const tenantsSnap = await db.collection("tenants").get();
    console.log(`\n--- 租戶列表 (共 ${tenantsSnap.size} 個) ---`);
    tenantsSnap.forEach(doc => {
        const data = doc.data();
        console.log(`ID: ${doc.id} | Slug: ${data.slug} | Name: ${data.name}`);
    });

    // 2. 統計各租戶的照片數量
    const itemsSnap = await db.collection("portfolio_items").get();
    const stats = {};
    
    itemsSnap.forEach(doc => {
        const data = doc.data();
        const tId = data.tenantId || "unknown";
        stats[tId] = (stats[tId] || 0) + 1;
    });

    console.log(`\n--- 照片統計 ---`);
    for (const [tId, count] of Object.entries(stats)) {
        // 嘗試找出對應的 slug
        const tenant = tenantsSnap.docs.find(d => d.id === tId);
        const label = tenant ? `${tenant.data().slug} (${tenant.data().name})` : tId;
        console.log(`${label}: ${count} 張照片`);
    }

    if (itemsSnap.empty) {
        console.log("\n❌ 目前 portfolio_items 集合中沒有任何照片資料。");
    }
}

checkPhotos().catch(console.error);
