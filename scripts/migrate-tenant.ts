import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as dotenv from "dotenv";
import * as path from "path";

// 載入 .env.local 環境變數
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// 初始化 Firebase Admin
const firebaseAdminConfig = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

const app = initializeApp({
    credential: cert(firebaseAdminConfig)
});

const adminDb = getFirestore(app);

/**
 * 執行多租戶資料遷移腳本
 */
async function runMigration() {
    console.log("🚀 開始執行資料庫遷移...");
    const targetSlug = "kelly";

    try {
        // --- 1. 建立 Tenant 商店資料 ---
        const tenantRef = adminDb.collection("tenants").doc(targetSlug);
        const tenantDoc = await tenantRef.get();

        if (!tenantDoc.exists) {
            console.log(`[Tenants] 正在建立商店資料: ${targetSlug}...`);
            await tenantRef.set({
                slug: targetSlug,
                name: "Kelly Photo",
                createdAt: new Date().toISOString(),
                isActive: true
            });
            console.log(`[Tenants] ✅ 商店 ${targetSlug} 建立成功！`);
        } else {
            console.log(`[Tenants] ⏩ 商店 ${targetSlug} 已存在，跳過建立。`);
        }

        // --- 2. 更新所有舊照片的 tenantId 與 tenantSlug ---
        console.log(`[Photos] 正在尋找 portfolio_items...`);
        const photosRef = adminDb.collection("portfolio_items");
        const snapshot = await photosRef.get();

        if (snapshot.empty) {
            console.log("[Photos] 沒有找到任何照片需要更新。");
            return;
        }

        console.log(`[Photos] 共找到 ${snapshot.size} 張照片，準備更新...`);

        // 使用 Batch 加速更新
        let batch = adminDb.batch();
        let count = 0;
        let batchCount = 0;

        for (const doc of snapshot.docs) {
            const data = doc.data();

            // 無論之前有沒有 tenantId，這次一律補上 tenantSlug
            batch.update(doc.ref, {
                tenantId: targetSlug,
                tenantSlug: targetSlug
            });

            count++;

            // Firestore Batch 上限為 500 次寫入
            if (count === 400) {
                await batch.commit();
                batchCount += count;
                console.log(`[Photos] 已更新 ${batchCount} 張...`);
                batch = adminDb.batch(); // 建立新的 Batch
                count = 0;
            }
        }

        // 提交剩餘的更新
        if (count > 0) {
            await batch.commit();
            batchCount += count;
        }

        console.log(`[Photos] ✅ 更新完成！總共遷移了 ${batchCount} 張照片。`);
        console.log("🎉 遷移腳本執行結束！");

    } catch (error) {
        console.error("❌ 遷移過程發生錯誤:", error);
    }
}

runMigration();
