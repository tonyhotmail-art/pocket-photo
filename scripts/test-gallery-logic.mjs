import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join } from 'path';

// 使用正確的路徑找到根目錄的 service account
const serviceAccountPath = join(process.cwd(), 'kellyportfolio-811ca-63bab52901ef.json');
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const SLUG = 'kellyphoto'; // 模擬的 Slug
const TENANT_ID = 'tenant_kelly_owner'; // 模擬的 ID

async function testGalleryLogic() {
  console.log('--- 開始測試 [藝廊邏輯] 與 [索引相容性] ---');

  try {
    // 1. 測試分類查詢 (in + !=)
    console.log('\n[測試 1] 讀取分類 (路人模式：排除待分類)');
    const catQuery = db.collection('categories')
      .where('tenantId', 'in', [SLUG, TENANT_ID])
      .where('visible', '==', true)
      .where('name', '!=', '待分類照片')
      .orderBy('name', 'asc')
      .orderBy('order', 'asc');
    
    const catSnap = await catQuery.get();
    console.log('✅ 分類查詢成功，回傳數量:', catSnap.size);

    // 2. 測試作品查詢 (in + != + 排序)
    console.log('\n[測試 2] 讀取作品 (路人模式：排除待分類)');
    const itemQuery = db.collection('portfolio_items')
      .where('tenantId', 'in', [SLUG, TENANT_ID])
      .where('categoryName', '!=', '待分類照片')
      .orderBy('categoryName', 'asc')
      .orderBy('categoryOrder', 'asc')
      .orderBy('createdAt', 'desc');

    const itemSnap = await itemQuery.get();
    console.log('✅ 作品查詢成功，回傳數量:', itemSnap.size);

    // 3. 測試管理員查詢 (in + 排序)
    console.log('\n[測試 3] 讀取作品 (管理員模式：看全部)');
    const adminQuery = db.collection('portfolio_items')
      .where('tenantId', 'in', [SLUG, TENANT_ID])
      .orderBy('categoryOrder', 'asc')
      .orderBy('createdAt', 'desc');

    const adminSnap = await adminQuery.get();
    console.log('✅ 管理員查詢成功，回傳數量:', adminSnap.size);

    console.log('\n--- 所有測試通過，索引運作正常！ ---');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 測試失敗！');
    if (error.message.includes('FAILED_PRECONDITION')) {
      console.error('原因：缺少 Firestore 複合索引。');
      console.error('請點擊此連結建立索引:', error.message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/)?.[0]);
    } else {
      console.error('原因：', error.message);
    }
    process.exit(1);
  }
}

testGalleryLogic();
