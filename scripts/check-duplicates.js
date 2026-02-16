const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // 假設有這個檔，或者使用環境變數

// 注意：在本地開發環境，我們可能需要先從 .env 讀取或直接連接
// 更好的做法是寫一個簡單的 API route 或就在控制台跑

async function checkDuplicates() {
    // 這裡我們直接查資料庫
    const snapshot = await db.collection('portfolio_items').where('categoryName', '==', '寫真造型').get();
    const items = [];
    snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() }));

    console.log('Total items in 寫真造型:', items.length);
    const hashes = {};
    items.forEach(item => {
        if (item.contentHash) {
            if (!hashes[item.contentHash]) hashes[item.contentHash] = [];
            hashes[item.contentHash].push(item.id);
        }
    });

    for (const [hash, ids] of Object.entries(hashes)) {
        if (ids.length > 1) {
            console.log(`Duplicate found for hash ${hash}:`, ids);
        }
    }
}
