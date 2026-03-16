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

async function setupTonyTenant() {
    const slug = "kelly"; // 目前對外的姓名
    const ownerEmail = "tony.hotmail@gmail.com";
    const newTenantId = "tenant_tony_kelly"; // 永久身分證號

    console.log(`\n🚀 開始為 ${ownerEmail} 建立身分證 [${newTenantId}]...`);

    try {
        const tenantsRef = db.collection("tenants");
        
        // 1. 清理之前錯誤建立的 antigravity 紀錄
        const oldSnapshot = await tenantsRef.where("slug", "==", "antigravity").get();
        for (const doc of oldSnapshot.docs) {
            await doc.ref.delete();
            console.log(`🗑️ 已刪除錯誤的租戶紀錄: ${doc.id}`);
        }

        // 2. 檢查 kelly 是否已存在
        const existingSnapshot = await tenantsRef.where("slug", "==", slug).get();
        if (!existingSnapshot.empty) {
            console.log(`✅ 租戶 [${slug}] 已存在，正在更新資料...`);
            await existingSnapshot.docs[0].ref.update({
                tenantId: newTenantId,
                ownerEmail: ownerEmail,
                name: "Kelly Photo Portfolio",
                updatedAt: new Date().toISOString()
            });
        } else {
            // 3. 建立新紀錄
            const newTenant = {
                tenantId: newTenantId,
                slug: slug,
                name: "Kelly Photo Portfolio",
                ownerEmail: ownerEmail,
                plan: "pro",
                status: "active",
                createdAt: new Date().toISOString(),
            };
            await tenantsRef.add(newTenant);
            console.log(`🎉 成功！${ownerEmail} 的身分證已建立。`);
        }

        // 4. 關鍵步驟：同步更新 admins 集合
        console.log(`\n👮 正在同步更新管理員名冊 [${ownerEmail}]...`);
        const adminsRef = db.collection("admins");
        const adminSnapshot = await adminsRef.where("email", "==", ownerEmail.toLowerCase()).get();
        
        if (adminSnapshot.empty) {
            console.log(`⚠️ 警告：在 admins 集合中找不到 ${ownerEmail}。將為其建立權限紀錄...`);
            await adminsRef.add({
                email: ownerEmail.toLowerCase(),
                tenantId: newTenantId,
                role: "system_admin",
                type: "google",
                createdAt: new Date().toISOString()
            });
        } else {
            for (const doc of adminSnapshot.docs) {
                await doc.ref.update({ tenantId: newTenantId });
                console.log(`✅ 已為管理員 ${ownerEmail} 補齊身分證號: ${newTenantId}`);
            }
        }

        // 5. 資料標記遷移 (將舊的 kelly/default 標籤統一為 tenant_tony_kelly)
        console.log(`\n🖼️ 正在將照片與分類資料標記為 [${newTenantId}]...`);
        const collections = ["portfolio_items", "categories"];
        for (const coll of collections) {
            const snap = await db.collection(coll).get();
            let count = 0;
            for (const doc of snap.docs) {
                const data = doc.data();
                if (data.tenantId === "kelly" || data.tenantId === "default" || !data.tenantId) {
                    await doc.ref.update({ tenantId: newTenantId });
                    count++;
                }
            }
            console.log(`- [${coll}]: 成功遷移 ${count} 筆資料`);
        }

    } catch (error) {
        console.error("❌ 執行失敗:", error);
    }
}

setupTonyTenant().then(() => console.log("\n✨ 身分證化遷移完畢。"));
