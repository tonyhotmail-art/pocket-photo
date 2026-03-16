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

async function scanData() {
    console.log(`\n🔍 正在掃描資料庫結構...`);

    const collections = ["portfolio_items", "categories", "admins"];
    
    for (const coll of collections) {
        const snapshot = await db.collection(coll).limit(10).get();
        console.log(`\n- [${coll}]: 讀取前 10 筆資料分析...`);
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            console.log(`  - Doc ID: ${doc.id}`);
            console.log(`    tenantId: ${data.tenantId || "❌ 無"}`);
            console.log(`    categoryName: ${data.categoryName || "❌ 無"}`);
        });
    }
}

scanData().then(() => console.log("\n✨ 分析完畢。"));
