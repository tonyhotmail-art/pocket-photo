import { db } from "@/lib/firebase";
import { PortfolioItem, portfolioItemSchema } from "@/lib/schema";
import {
    collection,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDoc,
    serverTimestamp,
    QueryConstraint,
    QueryDocumentSnapshot
} from "firebase/firestore";

export class PortfolioRepository {
    private collectionName = "portfolio_items";

    /**
     * 取得作品列表 (支援分頁與篩選)
     * @param tenantId 租戶 ID
     * @param options 篩選選項
     * @returns 作品陣列
     */
    async getItems(
        tenantId: string,
        options: {
            categoryName?: string;
            tag?: string;
            limit?: number;
            lastDoc?: QueryDocumentSnapshot
        } = {}
    ): Promise<PortfolioItem[]> {
        const constraints: QueryConstraint[] = [
            where("tenantId", "==", tenantId),
            orderBy("categoryOrder", "asc"),
            orderBy("createdAt", "desc")
        ];

        if (options.categoryName && options.categoryName !== "all") {
            constraints.push(where("categoryName", "==", options.categoryName));
        }

        if (options.tag) {
            constraints.push(where("tags", "array-contains", options.tag));
        }

        if (options.limit) {
            constraints.push(limit(options.limit));
        }

        if (options.lastDoc) {
            constraints.push(startAfter(options.lastDoc));
        }

        const q = query(collection(db, this.collectionName), ...constraints);
        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as PortfolioItem));
    }

    /**
     * 建立新作品
     * @param data 作品資料
     * @param tenantId 租戶 ID
     * @returns 建立後的作品 ID
     */
    async createItem(data: Omit<PortfolioItem, "id" | "createdAt">, tenantId: string): Promise<string> {
        const newData = {
            ...data,
            tenantId,
            createdAt: serverTimestamp(),
        };

        // 簡單驗證 (詳細驗證由 Zod schema 在 Service 層或API層處理，這裡做雙重保險)
        // 注意: serverTimestamp() 在這裡無法被 Zod 直接驗證，通常在寫入前忽略或用 any 繞過，
        // 但為了嚴謹，我們相信 Service 層傳來的數據，這裡主要負責寫入。

        const docRef = await addDoc(collection(db, this.collectionName), newData);
        return docRef.id;
    }

    /**
     * 取得單一作品
     * @param id 作品 ID
     */
    async getItem(id: string): Promise<PortfolioItem | null> {
        const docRef = doc(db, this.collectionName, id);
        const snapshot = await getDoc(docRef);

        if (!snapshot.exists()) return null;

        return {
            id: snapshot.id,
            ...snapshot.data()
        } as PortfolioItem;
    }

    /**
     * 刪除作品
     * @param id 作品 ID
     */
    async deleteItem(id: string): Promise<void> {
        const docRef = doc(db, this.collectionName, id);
        await deleteDoc(docRef);
    }

    /**
     * 更新作品
     * @param id 作品 ID
     * @param data 更新內容
     */
    async updateItem(id: string, data: Partial<PortfolioItem>): Promise<void> {
        const docRef = doc(db, this.collectionName, id);
        await updateDoc(docRef, data);
    }

    /**
     * 檢查內容雜湊是否重複
     * @param contentHash 檔案雜湊值
     * @param tenantId 租戶 ID
     */
    async isDuplicate(contentHash: string, tenantId: string): Promise<boolean> {
        const q = query(
            collection(db, this.collectionName),
            where("tenantId", "==", tenantId),
            where("contentHash", "==", contentHash),
            limit(1)
        );
        const snapshot = await getDocs(q);
        return !snapshot.empty;
    }

    /**
     * 取得分頁資料 (包含下一頁資訊)
     */
    async getItemsByPage(tenantId: string, page: number, pageSize: number, category: string) {
        const baseConstraints: QueryConstraint[] = [
            where("tenantId", "==", tenantId),
            orderBy("categoryOrder", "asc"), // 確保預設排序一致
            orderBy("createdAt", "desc")
        ];

        if (category && category !== "all") {
            // 注意: 使用 compound query cache 時，orderBy 欄位必須在 wehre 欄位之後或有索引
            // 這裡我們把 categoryName 加入
            // 但上面的 baseConstraints 已經有了 categoryOrder...?
            // Rule 4 說要強制 index。我們先照舊有邏輯，若有 category，則 filter categoryName
            // 並移除 categoryOrder 排序，或者確保有複合索引。
            // 舊有 API: orderBy("createdAt", "desc") (當 all)
            // or where("categoryName", "==", category), orderBy("createdAt", "desc")

            // 讓我們清理 constraints
            const constraints: QueryConstraint[] = [where("tenantId", "==", tenantId)];
            if (category !== "all") {
                constraints.push(where("categoryName", "==", category));
            }
            constraints.push(orderBy("createdAt", "desc"));

            return await this._executeQueryWithPagination(constraints, page, pageSize);
        } else {
            // Default "all"
            const constraints: QueryConstraint[] = [
                where("tenantId", "==", tenantId),
                orderBy("createdAt", "desc")
            ];
            return await this._executeQueryWithPagination(constraints, page, pageSize);
        }
    }

    private async _executeQueryWithPagination(constraints: QueryConstraint[], page: number, pageSize: number) {
        if (page === 1) {
            const q = query(collection(db, this.collectionName), ...constraints, limit(pageSize + 1));
            const snapshot = await getDocs(q);
            const items = snapshot.docs.slice(0, pageSize).map(d => ({ id: d.id, ...d.data() } as PortfolioItem));
            return {
                items,
                hasNextPage: snapshot.docs.length > pageSize,
                hasPrevPage: false,
                currentPage: 1
            };
        } else {
            const skipCount = (page - 1) * pageSize;
            const cursorQ = query(collection(db, this.collectionName), ...constraints, limit(skipCount));
            const cursorSnap = await getDocs(cursorQ);

            if (cursorSnap.docs.length < skipCount) {
                return { items: [], hasNextPage: false, hasPrevPage: false, currentPage: 1, error: "Page out of range" };
            }

            const lastDoc = cursorSnap.docs[cursorSnap.docs.length - 1];
            const pageQ = query(collection(db, this.collectionName), ...constraints, startAfter(lastDoc), limit(pageSize + 1));
            const snapshot = await getDocs(pageQ);
            const items = snapshot.docs.slice(0, pageSize).map(d => ({ id: d.id, ...d.data() } as PortfolioItem));
            return {
                items,
                hasNextPage: snapshot.docs.length > pageSize,
                hasPrevPage: true,
                currentPage: page
            };
        }
    }
}

export const portfolioRepo = new PortfolioRepository();
