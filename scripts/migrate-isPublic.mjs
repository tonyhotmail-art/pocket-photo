/**
 * 資料遷移腳本：為所有現有 portfolio_items 補齊 isPublic 欄位
 *
 * 執行方式：node scripts/migrate-isPublic.mjs
 *
 * 邏輯：
 * - categoryName 為「待分類照片」或「__回收區__」→ isPublic = false
 * - 其餘分類 → isPublic = true
 *
 * 安全措施：
 * - 分塊處理 (每 450 筆一批)，避免觸發 Firestore 500 筆批次限制
 * - 預設為「預覽模式」(DRY_RUN = true)，不會實際寫入
 * - 需手動將 DRY_RUN 改為 false 才會正式執行
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ─── 設定區 ───
const DRY_RUN = false; // ✅ 正式寫入模式 (使用者已於 2026-03-21 11:26 授權)
const BATCH_SIZE = 450; // Firestore 批次限制為 500，保留安全餘量
const PRIVATE_CATEGORIES = ['待分類照片', '__回收區__'];

// ─── 初始化 Firebase Admin ───
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const serviceAccountPath = resolve(__dirname, '..', '..', 'kellyportfolio-811ca-63bab52901ef.json');
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

initializeApp({
    credential: cert(serviceAccount),
});

const db = getFirestore();

/**
 * 主函式：遍歷所有 portfolio_items 並補齊 isPublic
 */
async function migrateIsPublic() {
    console.log('====================================');
    console.log(`模式：${DRY_RUN ? '🔍 預覽 (DRY RUN)' : '🚀 正式寫入'}`);
    console.log('====================================\n');

    const snapshot = await db.collection('portfolio_items').get();
    console.log(`共找到 ${snapshot.size} 筆作品\n`);

    let setToTrue = 0;
    let setToFalse = 0;
    let alreadySet = 0;
    let batchCount = 0;
    let batch = db.batch();
    let batchOps = 0;

    for (const doc of snapshot.docs) {
        const data = doc.data();
        const categoryName = data.categoryName || '';
        const shouldBePublic = !PRIVATE_CATEGORIES.includes(categoryName);

        // 如果已經有正確的 isPublic 值，跳過
        if (data.isPublic === shouldBePublic) {
            alreadySet++;
            continue;
        }

        if (shouldBePublic) {
            setToTrue++;
        } else {
            setToFalse++;
        }

        if (!DRY_RUN) {
            batch.update(doc.ref, {
                isPublic: shouldBePublic,
                updatedAt: new Date().toISOString(),
            });
            batchOps++;

            // 分塊寫入：每 BATCH_SIZE 筆提交一次
            if (batchOps >= BATCH_SIZE) {
                batchCount++;
                console.log(`  📦 提交第 ${batchCount} 批 (${batchOps} 筆)...`);
                await batch.commit();
                batch = db.batch();
                batchOps = 0;
            }
        }
    }

    // 提交最後一批
    if (!DRY_RUN && batchOps > 0) {
        batchCount++;
        console.log(`  📦 提交第 ${batchCount} 批 (${batchOps} 筆)...`);
        await batch.commit();
    }

    // ─── 輸出結果報告 ───
    console.log('\n====================================');
    console.log('遷移結果報告');
    console.log('====================================');
    console.log(`✅ 設為 isPublic: true  → ${setToTrue} 筆`);
    console.log(`🔒 設為 isPublic: false → ${setToFalse} 筆`);
    console.log(`⏭️  已有正確值 (跳過)   → ${alreadySet} 筆`);
    console.log(`📦 批次提交次數         → ${batchCount} 次`);

    if (DRY_RUN) {
        console.log('\n⚠️  這是預覽模式，尚未實際寫入。');
        console.log('   請將 DRY_RUN 改為 false 後重新執行。');
    } else {
        console.log('\n🎉 遷移完成！所有資料已更新。');
    }
}

migrateIsPublic().catch((err) => {
    console.error('❌ 遷移腳本執行失敗：', err);
    process.exit(1);
});
