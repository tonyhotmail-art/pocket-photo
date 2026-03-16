import { getDocs, query, collection, limit } from "firebase/firestore";
import { db } from "./src/lib/firebase";

async function run() {
    console.log("--- 查詢 Tenants ---");
    const tenantsSnap = await getDocs(collection(db, "tenants"));
    tenantsSnap.forEach(doc => {
        console.log(`[Tenants] ID: ${doc.id}, slug: ${doc.data().slug}, name: ${doc.data().name}`);
    });

    console.log("\n--- 查詢 Portfolio Items (取前 20 筆樣本) ---");
    const itemsSnap = await getDocs(query(collection(db, "portfolio_items"), limit(20)));
    
    const tenantCounts = {};
    itemsSnap.forEach(doc => {
        const tId = doc.data().tenantId || "UNDEFINED";
        tenantCounts[tId] = (tenantCounts[tId] || 0) + 1;
        console.log(`[Item] ID: ${doc.id}, tenantId: ${tId}, title: ${doc.data().title || '無標題'}`);
    });

    console.log("\n--- 前 20 筆 TenantId 統計 ---");
    console.log(tenantCounts);
}

run().catch(console.error);
