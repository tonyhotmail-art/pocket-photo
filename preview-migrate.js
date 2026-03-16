const admin = require("firebase-admin");
const serviceAccount = require("../kellyportfolio-811ca-63bab52901ef.json");

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

async function previewMigration() {
    console.log("🔍 開始讀取全庫關聯對應表 (global_tenants)...");
    const tenantsSnap = await db.collection("global_tenants").where("status", "==", "active").get();
    
    // 建立 slug -> tenantId 映射表
    const slugToTenantIdMap = new Map();
    tenantsSnap.forEach(doc => {
        const data = doc.data();
        const tenantId = data.tenantId || doc.id;
        const slug = data.slug;
        
        if (slug && tenantId && slug !== tenantId) {
            slugToTenantIdMap.set(slug, tenantId);
        }
    });

    // 由於稍早修復身份時，Kelly 的舊標籤已從資料庫徹底抹除，動態字典查不到
    // 因此這裡加入這個唯一的歷史遺毒斷代史特例：
    slugToTenantIdMap.set("kelly", "tenant_kelly_owner");
    slugToTenantIdMap.set("kellyphoto", "tenant_kelly_owner");

    console.log("✅ 對應表建立完成:");
    for (const [slug, id] of slugToTenantIdMap.entries()) {
        console.log(`   [Slug: ${slug}] ==> [真實 ID: ${id}]`);
    }
    
    if (slugToTenantIdMap.size === 0) {
        console.log("⚠️ 找不到任何可以映射的 slug 紀錄，退出程式。");
        return;
    }

    const collectionsToScan = ["portfolio_items", "categories"];
    let grandTotalScanned = 0;
    let grandTotalWillMigrate = 0;

    for (const colName of collectionsToScan) {
        console.log(`\n📸 掃描全庫集合 (${colName}) 尋找錯誤標記...`);
        let totalScanned = 0;
        let willMigrateCount = 0;
        const migrationPreviewList = [];

        const snap = await db.collection(colName).get();
        
        snap.forEach(doc => {
            totalScanned++;
            const data = doc.data();
            const currentTenantId = data.tenantId;

            if (currentTenantId && slugToTenantIdMap.has(currentTenantId)) {
                willMigrateCount++;
                const correctTenantId = slugToTenantIdMap.get(currentTenantId);
                migrationPreviewList.push({
                    id: doc.id,
                    oldTag: currentTenantId,
                    newTag: correctTenantId
                });
            }
        });

        console.log(`--------------------------------------------------`);
        console.log(`📊 [${colName}] 掃描總結：共檢視了 ${totalScanned} 筆資料`);
        console.log(`🚨 發現需要修復的資料共：${willMigrateCount} 筆`);
        
        if (willMigrateCount > 0) {
            console.log(`📌 這是前 5 筆需要修復的預覽（只看不改）：`);
            migrationPreviewList.slice(0, 5).forEach((item, i) => {
                console.log(`   ${i+1}. ID: ${item.id} | 從 [${item.oldTag}] -> [${item.newTag}]`);
            });
            if (willMigrateCount > 5) {
                console.log(`   ... 還有 ${willMigrateCount - 5} 筆。`);
            }
        }
        
        grandTotalScanned += totalScanned;
        grandTotalWillMigrate += willMigrateCount;
    }

    console.log(`\n\n==================================================`);
    console.log(`🔥 最終統計：總掃描了 ${grandTotalScanned} 筆資料，將有 ${grandTotalWillMigrate} 筆被修正。`);
}

previewMigration().catch(console.error).finally(() => process.exit(0));
