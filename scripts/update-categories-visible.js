// 執行此腳本來為所有現有分類新增 visible 欄位
// 在瀏覽器的開發者工具 Console 中執行

import { db } from './src/lib/firebase';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';

async function updateCategories() {
    const categoriesRef = collection(db, 'categories');
    const snapshot = await getDocs(categoriesRef);

    let count = 0;
    for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        if (data.visible === undefined) {
            await updateDoc(doc(db, 'categories', docSnap.id), {
                visible: true
            });
            count++;
            console.log(`已更新分類: ${data.name}`);
        }
    }

    console.log(`✅ 完成!共更新了 ${count} 個分類`);
}

updateCategories();
