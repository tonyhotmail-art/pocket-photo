const admin = require("firebase-admin");
const serviceAccount = require("../kellyportfolio-811ca-63bab52901ef.json");

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

async function executeMigration() {
    console.log("🔍 開始讀取全庫關聯對應表 (global_tenants)...");
    const tenantsSnap = await db.collection("global_tenants").where("status", "==", "active").get();
    
    const slugToTenantIdMap = new Map();
    tenantsSnap.forEach(doc => {
        const data = doc.data();
        const tenantId = data.tenantId || doc.id;
        const slug = data.slug;
        
        if (slug && tenantId && slug !== tenantId) {
            slugToTenantIdMap.set(slug, tenantId);
        }
    });

    // 歷史遺留的孤兒特例映射 (kelly -> tenant_kelly_owner)
    slugToTenantIdMap.set("kelly", "tenant_kelly_owner");
    slugToTenantIdMap.set("kellyphoto", "tenant_kelly_owner");

    console.log("✅ 對應表建立完成:");
    if (slugToTenantIdMap.size === 0) {
        console.log("⚠️ 找不到任何可以映射的 slug 紀錄，退出程式。");
        return;
    }

    const collectionsToScan = ["portfolio_items", "categories"];
    let grandTotalMigrated = 0;

    for (const colName of collectionsToScan) {
        console.log(`\n🚀 正在處理全庫集合 [${colName}] ...`);
        let migratedCount = 0;

        const snap = await db.collection(colName).get();
        const batch = db.batch(); // 使用 batch 以加速寫入與確保交易完整性
        let batchCount = 0;
        
        snap.forEach(doc => {
            const data = doc.data();
            const currentTenantId = data.tenantId;

            if (currentTenantId && slugToTenantIdMap.has(currentTenantId)) {
                migratedCount++;
                batchCount++;
                const correctTenantId = slugToTenantIdMap.get(currentTenantId);
                
                // 真實寫入覆蓋
                const ref = db.collection(colName).doc(doc.id);
                batch.update(ref, { tenantId: correctTenantId });
            }
        });

        if (batchCount > 0) {
            console.log(`   ⏳ 準備提交 ${batchCount} 筆變更...`);
            await batch.commit();
            console.log(`   ✅ 提交成功！`);
        } else {
             console.log(`   ➖ 沒有發現需要變更的項目。`);
        }
        
        grandTotalMigrated += migratedCount;
    }

    console.log(`\n==================================================`);
    console.log(`🎉 歷史大掃除完成！共成功修正了 ${grandTotalMigrated} 筆資料在 Firebase 中的標籤。`);
}

executeMigration().catch(console.error).finally(() => process.exit(0));
