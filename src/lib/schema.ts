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

// 租戶 (Tenant) Schema：這是身分證登記處
export const tenantSchema = z.object({
    id: z.string().optional(), // Firestore Doc ID (這就是真正的身分證字號)
    tenantId: z.string(),     // 系統內碼 (與 id 同值)
    slug: z.string().min(1, "Slug 為必填"), // 對外顯示的姓名 (如 antigravity)
    name: z.string().min(1, "店鋪名稱為必填"),
    ownerEmail: z.string().email("無效的 Email").optional(),
    plan: z.enum(["basic", "pro", "enterprise"]).default("basic"),
    status: z.enum(["active", "past_due", "trialing"]).default("active"),
    createdAt: z.any().optional(),
});

export type Tenant = z.infer<typeof tenantSchema>;

// 作品作品 Schema (原本的 Work 更新為 PortfolioItem)
export const portfolioItemSchema = z.object({
    id: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    imageUrl: z.string().url("無效的圖片連結"),
    categoryName: z.string().min(1, "請選擇分類"),
    categoryOrder: z.number().optional(), // 分類排序權重
    tags: z.array(z.string()),
    createdAt: z.any().optional(), // Firestore Timestamp (上傳時間)
    photoDate: z.string().optional(), // 照片原始拍攝日期 (ISO 字串，從 EXIF 讀取)
    deletedAt: z.string().optional(), // 移入回收區的時間 (ISO 字串，30天後永久刪除)
    contentHash: z.string().optional(), // 內容指紋 (SHA-256)
    tenantId: z.string().optional(),
});




export type PortfolioItem = z.infer<typeof portfolioItemSchema>;

// 為了相容性暫時保留 Work，但建議後續遷移至 PortfolioItem
export type Work = PortfolioItem;

