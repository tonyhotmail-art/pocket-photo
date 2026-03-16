import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join } from 'path';

const serviceAccountPath = join(process.cwd(), 'kellyportfolio-811ca-63bab52901ef.json');
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function countTenantIds() {
  console.log('--- 📊 正在統計所有照片的 ID 分布 ---');

  try {
    const snap = await db.collection('portfolio_items').get();
    const stats = {};

    snap.forEach(doc => {
      const tid = doc.data().tenantId || 'undefined';
      stats[tid] = (stats[tid] || 0) + 1;
    });

    console.log('\n[統計結果]');
    Object.entries(stats).forEach(([tid, count]) => {
      console.log(`- tenantId: "${tid}" -> 照片數: ${count}`);
    });

    if (snap.empty) {
      console.log('❌ 資料庫中沒有任何照片資料。');
    }

    process.exit(0);
  } catch (error) {
    console.error('統計失敗:', error.message);
    process.exit(1);
  }
}

countTenantIds();
