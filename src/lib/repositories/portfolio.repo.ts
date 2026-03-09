import { db } from "@/lib/firebase";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
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
        } else {
            // 如果是撈取「全部」，必須排除回收區的照片
            constraints.push(where("categoryName", "!=", "__回收區__"));
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
     * 建立新作品 (特權操作：強制使用 Admin SDK)
     * @param data 作品資料
     * @param tenantId 租戶 ID
     * @param requestingUserId 發出請求的登入者 ID
     * @param requestingUserRole 發出請求的登入者角色
     * @returns 建立後的作品 ID
     */
    async createItem(
        data: Omit<PortfolioItem, "id" | "createdAt" | "tenantId">,
        tenantId: string,
        requestingUserId: string,
        requestingUserRole: string
    ): Promise<string> {

        // 🛡️ 防呆：確保店長只能新增照片到自己的店裡（Slug 機制的前置保護）
        // 假設未來 tenantId 等同於 store_admin 的 userid (或商店綁定值)，目前我們強力防止匿名寫入。
        if (!requestingUserId || !requestingUserRole) {
            throw new Error("Unauthorized write: 缺乏有效身分，拒絕寫入。");
        }

        const newData = {
            ...data,
            tenantId,
            createdAt: FieldValue.serverTimestamp(),
        };

        // 改用 adminDb 寫入，直接繞過前端 Firestore Rules 的屏蔽 (PERMISSION_DENIED)
        const docRef = await adminDb.collection(this.collectionName).add(newData);
        return docRef.id;
    }

    /**
     * 取得單一作品
     */
    async getItem(id: string): Promise<PortfolioItem | null> {
        const docRef = adminDb.collection(this.collectionName).doc(id);
        const snapshot = await docRef.get();

        if (!snapshot.exists) return null;

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
        const docRef = adminDb.collection(this.collectionName).doc(id);
        await docRef.delete();
    }

    /**
     * 更新作品
     * @param id 作品 ID
     * @param data 更新內容
     */
    async updateItem(id: string, data: Partial<PortfolioItem>): Promise<void> {
        const docRef = adminDb.collection(this.collectionName).doc(id);
        await docRef.update(data);
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
            return await this._executeQueryWithPaginationAdmin(tenantId, page, pageSize, category);
        } else {
            // 「全部」模式：使用 categoryOrder + createdAt 排序，應用層過濾回收區
            return await this._executeQueryWithPaginationFilteredAdmin(
                tenantId, page, pageSize,
                (item) => item.categoryName !== "__回收區__"
            );
        }
    }

    private async _executeQueryWithPaginationAdmin(tenantId: string, page: number, pageSize: number, category: string) {
        let query = adminDb.collection(this.collectionName)
            .where("tenantId", "==", tenantId)
            .where("categoryName", "==", category)
            .orderBy("createdAt", "desc");

        const skipCount = (page - 1) * pageSize;
        if (skipCount > 0) {
            query = query.offset(skipCount);
        }

        // 多取一筆用來判斷是否有下一頁
        query = query.limit(pageSize + 1);

        const snapshot = await query.get();
        const items = snapshot.docs.slice(0, pageSize).map(d => ({ id: d.id, ...d.data() } as PortfolioItem));

        return {
            items,
            hasNextPage: snapshot.docs.length > pageSize,
            hasPrevPage: page > 1,
            currentPage: page
        };
    }

    /**
     * 帶應用層過濾的分頁查詢（用於需要排除特定項目但不想使用 != 操作符的場景）
     * 使用較大的 fetch size 確保過濾後仍有足夠資料，適合回收區項目極少的情況
     */
    private async _executeQueryWithPaginationFilteredAdmin(
        tenantId: string,
        page: number,
        pageSize: number,
        filterFn: (item: PortfolioItem) => boolean
    ) {
        // 多抓一些資料確保過濾後夠用（假設回收區比例低，多取 50 筆緩衝）
        const BUFFER = 50;
        const fetchSize = (page * pageSize) + BUFFER;

        const query = adminDb.collection(this.collectionName)
            .where("tenantId", "==", tenantId)
            .orderBy("categoryOrder", "asc")
            .orderBy("createdAt", "desc")
            .limit(fetchSize);

        const snapshot = await query.get();

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
