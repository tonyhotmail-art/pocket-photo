import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join } from 'path';

// 讀取 Service Account
const serviceAccount = JSON.parse(
  readFileSync('../kellyportfolio-811ca-63bab52901ef.json', 'utf8')
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function runQuery() {
  try {
    const snapshot = await db.collection('portfolio_items')
      .where('tenantId', '==', 'tenant_kelly_owner')
      .get();
    
    console.log('--- 查詢結果 (New ID) ---');
    console.log('標記為 tenant_kelly_owner 的照片總數:', snapshot.size);
    
    const catSnapshot = await db.collection('categories')
      .where('tenantId', '==', 'tenant_kelly_owner')
      .get();
    console.log('標記為 tenant_kelly_owner 的分類總數:', catSnapshot.size);
    
    process.exit(0);
  } catch (error) {
    console.error('查詢出錯:', error);
    process.exit(1);
  }
}

runQuery();
