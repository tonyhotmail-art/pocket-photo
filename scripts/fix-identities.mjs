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

async function fixIdentities() {
    console.log(`\n🛠️ 正在執行身分證精確修正行動...`);

    const TONY_EMAIL = "tony.hotmail@gmail.com";
    const KELLY_EMAIL = "kellykelly555888@gmail.com";
    
    const TONY_TENANT_ID = "tenant_muchen_tony";
    const KELLY_TENANT_ID = "tenant_kelly_owner";

    try {
        const tenantsRef = db.collection("tenants");
        const adminsRef = db.collection("admins");
        const itemsRef = db.collection("portfolio_items");
        const catsRef = db.collection("categories");

        // 1. 清理誤建的紀錄
        const oldSnapshot = await tenantsRef.where("tenantId", "==", "tenant_tony_kelly").get();
        for (const doc of oldSnapshot.docs) await doc.ref.delete();
        console.log(`🗑️ 已註銷錯誤的身分證: tenant_tony_kelly`);

        // 2. 為 Tony (muchen) 建立正確登記
        await tenantsRef.doc(TONY_TENANT_ID).set({
            tenantId: TONY_TENANT_ID,
            slug: "muchen",
            name: "Muchen Portfolio",
            ownerEmail: TONY_EMAIL,
            plan: "pro",
            status: "active",
            updatedAt: new Date().toISOString()
        });
        console.log(`✅ 已為 Tony [muchen] 建立身分證: ${TONY_TENANT_ID}`);

        // 3. 為 Kelly (kelly) 建立正確登記
        await tenantsRef.doc(KELLY_TENANT_ID).set({
            tenantId: KELLY_TENANT_ID,
            slug: "kelly",
            name: "Kelly Photo Portfolio",
            ownerEmail: KELLY_EMAIL,
            plan: "pro",
            status: "active",
            updatedAt: new Date().toISOString()
        });
        console.log(`✅ 已為 Kelly [kelly] 建立身分證: ${KELLY_TENANT_ID}`);

        // 4. 修復 Admin 權限
        const tonyAdmin = await adminsRef.where("email", "==", TONY_EMAIL.toLowerCase()).get();
        for (const doc of tonyAdmin.docs) await doc.ref.update({ tenantId: TONY_TENANT_ID });
        
        const kellyAdmin = await adminsRef.where("email", "==", KELLY_EMAIL.toLowerCase()).get();
        for (const doc of kellyAdmin.docs) await doc.ref.update({ tenantId: KELLY_TENANT_ID });
        console.log(`👮 管理員權限已依照 Email 重新綁定。`);

        // 5. 資料歸位 (遷移照片與分類)
        // 將原本誤標為 tenant_tony_kelly 的歸還給 Kelly
        const wrongItems = await itemsRef.where("tenantId", "==", "tenant_tony_kelly").get();
        for (const doc of wrongItems.docs) await doc.ref.update({ tenantId: KELLY_TENANT_ID });

        // 將原始標記為 muchen 的歸還給 Tony
        const muchenItems = await itemsRef.where("tenantId", "==", "muchen").get();
        for (const doc of muchenItems.docs) await doc.ref.update({ tenantId: TONY_TENANT_ID });

        // 將原始標記為 kelly 的歸還給 Kelly
        const kellyItems = await itemsRef.where("tenantId", "==", "kelly").get();
        for (const doc of kellyItems.docs) await doc.ref.update({ tenantId: KELLY_TENANT_ID });

        // 同步修正分類 (Categories)
        const muchenCats = await catsRef.where("tenantId", "==", "muchen").get();
        for (const doc of muchenCats.docs) await doc.ref.update({ tenantId: TONY_TENANT_ID });

        const kellyCats = await catsRef.where("tenantId", "==", "kelly").get();
        for (const doc of kellyCats.docs) await doc.ref.update({ tenantId: KELLY_TENANT_ID });
        
        const wrongCats = await catsRef.where("tenantId", "==", "tenant_tony_kelly").get();
        for (const doc of wrongCats.docs) await doc.ref.update({ tenantId: KELLY_TENANT_ID });

        console.log(`🖼️ 所有照片與分類已根據原始標記完成精確歸位。`);

    } catch (error) {
        console.error("❌ 修正失敗:", error);
    }
}

fixIdentities().then(() => console.log("\n✨ 身分證精確修正完畢。"));
