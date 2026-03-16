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

async function deepInspect() {
  console.log('--- 🔍 深度偵查：尋找 KELLY 的真實身分紀錄 ---');

  try {
    // 1. 檢查 tenants 集合
    console.log('\n[集合: tenants]');
    const tenantsSnap = await db.collection('tenants').get();
    if (tenantsSnap.empty) {
      console.log('  ❌ tenants 集合為空');
    } else {
      tenantsSnap.forEach(doc => {
        const data = doc.data();
        if (doc.id.includes('kelly') || (data.slug && data.slug.includes('kelly')) || (data.name && data.name.includes('kelly'))) {
          console.log(`  ✅ 找到相關 DocID: ${doc.id}`);
          console.log(`     內容: ${JSON.stringify(data, null, 2)}`);
        }
      });
    }

    // 2. 檢查 global_tenants 集合 (這是 admin.ts 用來對應的身分表)
    console.log('\n[集合: global_tenants]');
    const globalSnap = await db.collection('global_tenants').get();
    if (globalSnap.empty) {
      console.log('  ❌ global_tenants 集合為空');
    } else {
      globalSnap.forEach(doc => {
        const data = doc.data();
        if (doc.id.includes('kelly') || (data.slug && data.slug.includes('kelly')) || (data.ownerEmail && data.ownerEmail.includes('kelly'))) {
          console.log(`  ✅ 找到相關 DocID: ${doc.id}`);
          console.log(`     內容: ${JSON.stringify(data, null, 2)}`);
        }
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('偵查失敗:', error.message);
    process.exit(1);
  }
}

deepInspect();
