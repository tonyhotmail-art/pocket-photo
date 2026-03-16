# Firestore 索引追蹤紀錄

## 2026-03-14：藝廊邏輯與雙認證優化

### categories 集合
- **目的**：支援路人免登入讀取，並排除「待分類照片」。
- **索引結構**：
  - `tenantId` (ASC)
  - `visible` (ASC)
  - `name` (ASC) -> 用於 `!= '待分類照片'` 的範圍查詢
  - `order` (ASC) -> 排序

### portfolio_items 集合
- **目的**：支援路人讀取公開照片，排除「待分類照片」。
- **索引結構**：
  - `tenantId` (ASC)
  - `categoryName` (ASC) -> 用於 `!= '待分類照片'`
  - `categoryOrder` (ASC)
  - `createdAt` (DESC)

## 2026-03-12：雙 ID 聯集查詢支援
- **目的**：解決本地與線上 TenantID/Slug 不一致問題。
- **索引結構**：`tenantId` + `categoryOrder` + `createdAt`。
