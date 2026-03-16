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

async function inspectData() {
  console.log('--- 🕵️ 資料庫欄位偵查中 ---');

  try {
    const collections = ['tenants', 'categories', 'portfolio_items'];
    
    for (const col of collections) {
      console.log(`\n[集合: ${col}]`);
      const snap = await db.collection(col).limit(3).get();
      
      if (snap.empty) {
        console.log('  ❌ 查無資料');
      } else {
        snap.forEach(doc => {
          const data = doc.data();
          console.log(`  - DocID: ${doc.id}`);
          console.log(`    tenantId:   ${data.tenantId}`);
          console.log(`    tenantSlug: ${data.tenantSlug || '無'}`);
          if (col === 'tenants') {
            console.log(`    slug:       ${data.slug || '無'}`);
          }
          if (col === 'portfolio_items') {
            console.log(`    categoryName: ${data.categoryName}`);
          }
        });
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('偵查失敗:', error.message);
    process.exit(1);
  }
}

inspectData();
