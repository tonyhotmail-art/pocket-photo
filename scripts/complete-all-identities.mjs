import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// 載入環境變數
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

async function completeAllIdentities() {
    console.log(`\n🌍 正在執行「全量身分證化」：補齊所有舊用戶...`);

    try {
        const tenantsRef = db.collection("tenants");
        const itemsRef = db.collection("portfolio_items");
        const catsRef = db.collection("categories");

        // 1. 掃描所有出現過的舊標籤 (排除已轉換的 tenant_ 格式)
        const allItems = await itemsRef.get();
        const oldSlugs = new Set();
        
        allItems.docs.forEach(doc => {
            const tid = doc.data().tenantId;
            if (tid && !tid.startsWith("tenant_")) {
                oldSlugs.add(tid);
            }
        });

        const allCats = await catsRef.get();
        allCats.docs.forEach(doc => {
            const tid = doc.data().tenantId;
            if (tid && !tid.startsWith("tenant_")) {
                oldSlugs.add(tid);
            }
        });

        console.log(`🔍 發現待轉換的舊標籤: ${Array.from(oldSlugs).join(", ")}`);

        // 2. 逐一發放身分證並遷移資料
        for (const slug of oldSlugs) {
            const newTenantId = `tenant_${slug.replace(/-/g, '_')}`;
            console.log(`\n📦 處理用戶 [${slug}] -> [${newTenantId}]...`);

            // A. 建立租戶登記
            await tenantsRef.doc(newTenantId).set({
                tenantId: newTenantId,
                slug: slug,
                name: `${slug.charAt(0).toUpperCase() + slug.slice(1)} Portfolio`,
                plan: "basic",
                status: "active",
                updatedAt: new Date().toISOString()
            }, { merge: true });

            // B. 遷移照片
            const itemSnap = await itemsRef.where("tenantId", "==", slug).get();
            for (const doc of itemSnap.docs) await doc.ref.update({ tenantId: newTenantId });
            console.log(`  ✅ 遷移照片: ${itemSnap.size} 筆`);

            // C. 遷移分類
            const catSnap = await catsRef.where("tenantId", "==", slug).get();
            for (const doc of catSnap.docs) await doc.ref.update({ tenantId: newTenantId });
            console.log(`  ✅ 遷移分類: ${catSnap.size} 筆`);
        }

    } catch (error) {
        console.error("❌ 補齊失敗:", error);
    }
}

completeAllIdentities().then(() => console.log("\n✨ 全量身分證補齊完畢。"));
