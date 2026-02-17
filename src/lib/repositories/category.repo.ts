import { db } from "@/lib/firebase";
import { Category, categorySchema } from "@/lib/schema";
import {
    collection,
    query,
    where,
    orderBy,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    writeBatch
} from "firebase/firestore";

export class CategoryRepository {
    private collectionName = "categories";

    /**
     * 取得分類列表
     * @param tenantId 租戶 ID
     * @returns 分類陣列
     */
    async getCategories(tenantId: string): Promise<Category[]> {
        const q = query(
            collection(db, this.collectionName),
            where("tenantId", "==", tenantId),
            orderBy("order", "asc")
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Category));
    }

    /**
     * 建立新分類
     * @param data 分類資料
     * @param tenantId 租戶 ID
     * @returns 建立後的分類 ID
     */
    async createCategory(data: Omit<Category, "id">, tenantId: string): Promise<string> {
        // 強制寫入 tenantId
        const newData = {
            ...data,
            tenantId,
        };
        // 驗證 Schema
        categorySchema.parse(newData);

        const docRef = await addDoc(collection(db, this.collectionName), newData);
        return docRef.id;
    }

    /**
     * 更新分類
     * @param id 分類 ID
     * @param data 更新資料
     */
    async updateCategory(id: string, data: Partial<Category>): Promise<void> {
        const docRef = doc(db, this.collectionName, id);
        await updateDoc(docRef, data);
    }

    /**
     * 刪除分類
     * @param id 分類 ID
     */
    async deleteCategory(id: string): Promise<void> {
        const docRef = doc(db, this.collectionName, id);
        await deleteDoc(docRef);
    }

    /**
     * 批次更新分類順序
     * @param categories 分類陣列
     */
    async reorderCategories(categories: Category[]): Promise<void> {
        const batch = writeBatch(db);

        categories.forEach((cat) => {
            if (!cat.id) return;
            const ref = doc(db, this.collectionName, cat.id);
            batch.update(ref, { order: cat.order });
        });

        await batch.commit();
    }
}

export const categoryRepo = new CategoryRepository();
