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

async function findId() {
  console.log('--- 🔍 尋找 kellyphoto 的真實 ID ---');

  try {
    const doc = await db.collection('tenants').doc('kellyphoto').get();
    
    if (!doc.exists) {
      console.log('❌ 找不到 kellyphoto 文件，改搜尋 slug 欄位...');
      const snap = await db.collection('tenants').where('slug', '==', 'kellyphoto').limit(1).get();
      if (!snap.empty) {
        console.log('✅ 找到資料：', JSON.stringify(snap.docs[0].data(), null, 2));
      } else {
        console.log('❌ 完全找不到與 kellyphoto 相關的租戶資訊');
      }
    } else {
      console.log('✅ 找到 kellyphoto 文件：', JSON.stringify(doc.data(), null, 2));
    }

    process.exit(0);
  } catch (error) {
    console.error('查詢失敗:', error.message);
    process.exit(1);
  }
}

findId();
