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

        if (category && category !== "all") {
            // 特定分類模式：使用 categoryName + createdAt 索引
            const constraints: QueryConstraint[] = [
                where("tenantId", "==", tenantId),
                where("categoryName", "==", category),
                orderBy("createdAt", "desc")
            ];
            return await this._executeQueryWithPagination(constraints, page, pageSize);
        } else {
            // 「全部」模式：使用 categoryOrder + createdAt 排序，應用層過濾回收區
            // 避免使用 != 操作符（需要複合索引），改為取出後過濾
            const constraints: QueryConstraint[] = [
                where("tenantId", "==", tenantId),
                orderBy("categoryOrder", "asc"),
                orderBy("createdAt", "desc")
            ];
            return await this._executeQueryWithPaginationFiltered(
                constraints, page, pageSize,
                (item) => item.categoryName !== "__回收區__"
            );
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

    /**
     * 帶應用層過濾的分頁查詢（用於需要排除特定項目但不想使用 != 操作符的場景）
     * 使用較大的 fetch size 確保過濾後仍有足夠資料，適合回收區項目極少的情況
     */
    private async _executeQueryWithPaginationFiltered(
        constraints: QueryConstraint[],
        page: number,
        pageSize: number,
        filterFn: (item: PortfolioItem) => boolean
    ) {
        // 多抓一些資料確保過濾後夠用（假設回收區比例低，多取 50 筆緩衝）
        const BUFFER = 50;
        const fetchSize = (page * pageSize) + BUFFER;

        const q = query(collection(db, this.collectionName), ...constraints, limit(fetchSize));
        const snapshot = await getDocs(q);

        // 應用層過濾
        const allFilteredDocs = snapshot.docs.filter(d => filterFn({ id: d.id, ...d.data() } as PortfolioItem));

        const startIdx = (page - 1) * pageSize;
        const endIdx = startIdx + pageSize;
        const pageDocs = allFilteredDocs.slice(startIdx, endIdx);

        const items = pageDocs.map(d => ({ id: d.id, ...d.data() } as PortfolioItem));

        return {
            items,
            hasNextPage: allFilteredDocs.length > endIdx,
            hasPrevPage: page > 1,
            currentPage: page
        };
    }
}

export const portfolioRepo = new PortfolioRepository();
