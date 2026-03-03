import { portfolioRepo } from "@/lib/repositories/portfolio.repo";
import { uploadToR2, deleteFromR2 } from "@/lib/r2";
import { PortfolioItem, portfolioItemSchema } from "@/lib/schema";
import { v4 as uuidv4 } from "uuid";

export class PortfolioService {
    /**
     * 上傳並建立作品
     * @param fileBuffer 檔案 Buffer
     * @param fileType 檔案類型
     * @param originalName 原始檔名
     * @param metadata 作品中繼資料 (分類、標籤等)
     * @param tenantId 租戶 ID
     * @param requestingUserId 發起請求的金鑰 ID
     * @param requestingUserRole 發起請求的角色
     */
    async uploadAndCreateItem(
        fileBuffer: Buffer,
        fileType: string,
        originalName: string,
        metadata: {
            title?: string;
            categoryName: string;
            categoryOrder: number;
            tags: string[];
            contentHash: string;
            description?: string;
            width?: number;
            height?: number;
            photoDate?: string; // EXIF 拍攝時間 (ISO 字串格式)
        },
        tenantId: string,
        requestingUserId: string,
        requestingUserRole: string
    ): Promise<string> {
        // 1. 上傳至 Cloudflare R2
        const imageUrl = await uploadToR2(fileBuffer, fileType, tenantId, originalName);

        // 2. 準備 Firestore 資料
        const itemData = {
            imageUrl,
            title: metadata.title || "",
            categoryName: metadata.categoryName,
            categoryOrder: metadata.categoryOrder,
            tags: metadata.tags,
            width: metadata.width || 0,
            height: metadata.height || 0,
            contentHash: metadata.contentHash,
            description: metadata.description || "",
            visible: true,
            // 若有 EXIF 拍攝時間則使用，否則以上傳時間作為 fallback
            photoDate: metadata.photoDate || new Date().toISOString(),
        };

        // 3. 驗證 Schema (確保資料正確性，加入必要的 tenantId 與 createdat 以通過驗證，但 repo 會覆蓋)
        portfolioItemSchema.parse({
            ...itemData,
            tenantId,
            id: 'temp-id',
            createdAt: new Date().toISOString()
        });

        // 4. 寫入資料庫
        const itemId = await portfolioRepo.createItem(
            itemData,
            tenantId,
            requestingUserId,
            requestingUserRole
        );

        return itemId;
    }

    /**
     * 取得作品列表
     */
    async getItems(tenantId: string, options: any) {
        return await portfolioRepo.getItems(tenantId, options);
    }

    /**
     * 更新作品
     */
    async updateItem(id: string, data: Partial<PortfolioItem>) {
        await portfolioRepo.updateItem(id, data);
    }

    /**
     * 刪除作品 (包含圖片)
     */
    async deleteItem(id: string, imageUrl?: string) {
        // 如果沒有提供 imageUrl，從 DB 獲取
        if (!imageUrl) {
            const item = await portfolioRepo.getItem(id);
            if (item) {
                imageUrl = item.imageUrl;
            }
        }

        if (imageUrl) {
            await deleteFromR2(imageUrl);
        }

        await portfolioRepo.deleteItem(id);
    }

    /**
     * 取得分頁作品列表
     * (封裝複雜的 Firestore Offset 邏輯)
     */
    async getPaginatedItems(tenantId: string, page: number, pageSize: number, category: string) {
        // 這裡我們需要使用 repository 的底層方法或直接在這裡組裝查詢
        // 為了保持架構，我們應該在 Repository 擴充支援分頁的方法，
        // 但為了簡化遷移，我們先複用原本 API Route 的邏輯，並透過 repo 的 getItems 改寫

        // 由於 Repository 的 getItems 是基於 constraints，我們可以傳入 startAfter 等
        // 但因為我們需要"第N頁"，這在 Firestore 比較麻煩，需要 skip count

        // 簡單起見，我們先用 getItems 抓取足夠數量的資料 (僅適用於資料量不大時)
        // 或者，我們在 Service 層實作原本 API 的 "skip" 邏輯

        // 為了不讓 Service 層直接依賴 Firestore SDK (query, getDocs)，
        // 最好的方式是 Repo 提供一個 `getCursor(tenantId, offset, options)` 方法，
        // 但現在我們先讓 Service 處理業務邏輯，Repo 負責資料存取。

        // 暫時的解決方案：我們使用 repo.getItems，但傳入 limit = page * pageSize
        // 這樣雖然有效率問題，但對於作品集(幾百張)來說還好。
        // 如果要完美，應該在 Repo 實作更強大的分頁。

        // 讓我們嘗試用 Repo 的現有方法 getItems 來模擬
        // 選項：
        // 1. Repo 新增 queryWithCursor
        // 2. Service 直接操作 DB (不建議)
        // 3. 讀取全部然後記憶體分頁 (資料量小可以)

        // 鑑於目前 API 邏輯已經寫好 cursor 邏輯，我建議將該邏輯"搬"到 Repository 會更好，
        // 但 repo.ts 已經寫了 getItems。

        // 我們採用：新增 `getPortfolioWithPagination` 到 Repository
        // 抱歉，這需要修改 Repository。

        // 讓我們在 Service 呼叫 Repo 多次來取得 cursor?
        // 這樣太慢。

        // 決定：直接在 Service 實作類似原本 API 的邏輯，但使用 Repo 的 getItems 配合 limit。
        // 原本邏輯：query limit(skipCount) 取得最後一個 doc，然後 startAfter(lastDoc)。

        // 但 Repo.getItems 回傳的是 Data[]，不是 Snapshot，所以拿不到 Doc Snapshot。
        // 所以 Repo 必須暴露 Snapshot 或者是提供分頁功能。

        // **修正策略**：修改 PortfolioRepository 的 getItems，讓它回傳 { items, lastDoc }
        // 或者新增一個專門的分頁方法。

        // 為了不改動太大，我們在 Repository 新增 `getPaginated(tenantId, page, pageSize, category)`
        // 但 Repository 通常不處理 "page number"，而是 "cursor"。

        // 好吧，我將在 Repository 新增 `getItemsByPage` 方法。
        return await portfolioRepo.getItemsByPage(tenantId, page, pageSize, category);
    }
}

export const portfolioService = new PortfolioService();
