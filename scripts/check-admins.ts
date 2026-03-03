import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
        }),
    });
}

async function main() {
    const db = admin.firestore();
    const snap = await db.collection('admins').where('email', '==', 'kellykelly555888@gmail.com').get();

    if (snap.empty) {
        console.log("找不到 Kelly 的管理員紀錄，現在幫忙建立一筆新的");
        await db.collection('admins').add({
            email: 'kellykelly555888@gmail.com',
            role: 'store_admin',
            tenantSlug: 'kelly',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log("建立成功！");
    } else {
        console.log("找到 Kelly，進行身分覆寫為 store_admin 與綁定 kelly tenantSlug...");
        for (const doc of snap.docs) {
            await doc.ref.update({
                role: 'store_admin',
                tenantSlug: 'kelly'
            });
            console.log("覆寫完成: ", doc.id);
        }
    }
}

main().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
});
