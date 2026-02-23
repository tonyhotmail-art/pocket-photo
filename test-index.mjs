import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

// 手動解析 .env.local
const envContent = readFileSync('.env.local', 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
    const idx = line.indexOf('=');
    if (idx > 0) {
        const key = line.slice(0, idx).trim();
        let val = line.slice(idx + 1).trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        env[key] = val;
    }
}

const privateKey = env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
const tenantId = env.NEXT_PUBLIC_TENANT_ID;
console.log('tenantId:', tenantId);

if (!getApps().length) {
    initializeApp({ credential: cert({ projectId: env.FIREBASE_PROJECT_ID, clientEmail: env.FIREBASE_CLIENT_EMAIL, privateKey }) });
}
const db = getFirestore();

try {
    const snap = await db.collection('portfolio_items')
        .where('tenantId', '==', tenantId)
        .where('categoryName', '!=', '__回收區__')
        .orderBy('categoryName', 'asc')
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get();
    console.log('✅ 索引正常，查詢返回', snap.size, '筆');
} catch (err) {
    console.error('❌ 錯誤:', err.message);
    if (err.message.includes('https://')) {
        console.log('請開啟此連結建立索引:', err.message.match(/https:\/\/[^\s]+/)?.[0]);
    }
}
