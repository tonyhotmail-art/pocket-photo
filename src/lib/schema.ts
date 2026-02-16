import { z } from "zod";

// 分類 Schema
export const categorySchema = z.object({
    id: z.string().optional(),
    tenantId: z.string().optional(), // 多租戶支援
    name: z.string().min(1, "分類名稱為必填"),
    order: z.number().default(0),
    visible: z.boolean().default(true), // 控制前台顯示
});



export type Category = z.infer<typeof categorySchema>;

// 作品作品 Schema (原本的 Work 更新為 PortfolioItem)
export const portfolioItemSchema = z.object({
    id: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    imageUrl: z.string().url("無效的圖片連結"),
    categoryName: z.string().min(1, "請選擇分類"),
    categoryOrder: z.number().optional(), // 分類排序權重
    tags: z.array(z.string()),
    createdAt: z.any().optional(), // Firestore Timestamp
    contentHash: z.string().optional(), // 內容指紋 (SHA-256)
    tenantId: z.string().optional(),
});



export type PortfolioItem = z.infer<typeof portfolioItemSchema>;

// 為了相容性暫時保留 Work，但建議後續遷移至 PortfolioItem
export type Work = PortfolioItem;

