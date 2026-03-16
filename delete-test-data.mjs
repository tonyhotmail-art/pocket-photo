import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync('../kellyportfolio-811ca-63bab52901ef.json', 'utf8')
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function cleanupTestData() {
  const TEST_ID = 'tenant_kelly_owner';
  
  try {
    // 1. 刪除照片
    const itemsSnapshot = await db.collection('portfolio_items')
      .where('tenantId', '==', TEST_ID)
      .get();
    
    console.log(`正在刪除 ${itemsSnapshot.size} 張標記為 ${TEST_ID} 的測試照片...`);
    
    const batch = db.batch();
    itemsSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    // 2. 刪除分類
    const catsSnapshot = await db.collection('categories')
      .where('tenantId', '==', TEST_ID)
      .get();
    
    console.log(`正在刪除 ${catsSnapshot.size} 個標記為 ${TEST_ID} 的測試分類...`);
    
    catsSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    if (!itemsSnapshot.empty || !catsSnapshot.empty) {
      await batch.commit();
      console.log('✅ 測試資料已永久刪除。');
    } else {
      console.log('找不到任何測試資料。');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ 刪除失敗:', error);
    process.exit(1);
  }
}

cleanupTestData();
