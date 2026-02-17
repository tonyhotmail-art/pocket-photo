# Firestore 索引與查詢對照表 (Index-Query Mapping)

> [!IMPORTANT]
> 此文件為開發規範 (ROOT) 規則 4 要求之「索引溯源」紀錄。
> 修改 `firestore.indexes.json` 時必須同步更新此表，嚴禁刪除尚有出處對應的索引。

## Portfolio Items (作品集合)

### 1. 全部作品 (管理員與首頁全覽)

- **索引路徑**：`tenantId (ASC), categoryOrder (ASC), createdAt (DESC)`
- **檔案出處**：
  - `src/app/page.tsx` -> `useEffect` (第 140 行)
  - `src/lib/repositories/portfolio.repo.ts` -> `getItems` (第 39 行)
- **用途**：在管理視角或首頁「全部」分類下，按分類順序與日期排序顯示。

### 2. 特定分類過濾 (管理員與非管理員)

- **索引路徑**：`tenantId (ASC), categoryName (ASC), categoryOrder (ASC), createdAt (DESC)`
- **檔案出處**：
  - `src/app/page.tsx` -> `useEffect` (第 130 行, 第 150 行)
- **用途**：首頁特定分類點擊、非管理員過濾掉「待分類照片」。

### 3. 分類統計與 API 分頁

- **索引路徑**：`tenantId (ASC), categoryName (ASC), createdAt (DESC)`
- **檔案出處**：
  - `src/components/WorkManager.tsx` -> `loadCategoryCounts` (第 117 行)
  - `src/lib/repositories/portfolio.repo.ts` -> `getItemsByPage` (第 164 行)
- **用途**：計算每個分類有多少張照片、後台分頁 API 按分類讀取。

### 4. 僅按日期分頁 (後台全部視角)

- **索引路徑**：`tenantId (ASC), createdAt (DESC)`
- **檔案出處**：
  - `src/lib/repositories/portfolio.repo.ts` -> `getItemsByPage` (第 171 行)
- **用途**：後台管理介面在「全部」視角下的分頁功能。

### 5. 標籤搜尋 (Array-Contains)

- **索引路徑**：`tenantId (ASC), tags (ARRAY_CONTAINS), categoryOrder (ASC), createdAt (DESC)`
- **檔案出處**：
  - `src/app/page.tsx` -> `useEffect` (第 121 行)
  - `src/lib/repositories/portfolio.repo.ts` -> `getItems` (第 50 行)
- **用途**：首頁標籤篩選功能。

### 6. 重複上傳檢查

- **索引路徑**：`tenantId (ASC), contentHash (ASC)`
- **檔案出處**：
  - `src/lib/repositories/portfolio.repo.ts` -> `isDuplicate` (第 132 行)
- **用途**：上傳前檢查圖片 MD5/Hash 是否已存在，避免重複佔用空間。

## Categories (分類集合)

### 1. 管理員清單

- **索引路徑**：`tenantId (ASC), order (ASC)`
- **檔案出處**：
  - `src/app/page.tsx` -> `useEffect` (第 85 行)
  - `src/components/WorkManager.tsx` -> `loadCategoryCounts` (第 92 行)
- **用途**：讀取完整分類清單。

### 2. 民眾版清單 (排除待分類)

- **索引路徑**：`visible (ASC), tenantId (ASC), name (ASC), order (ASC)`
- **檔案出處**：
  - `src/app/page.tsx` -> `useEffect` (第 94 行)
- **用途**：首頁側邊欄對一般訪客顯示的分類，需過濾不等於「待分類照片」。

## Admins (管理員權限)

### 1. 登入權限檢查

- **索引路徑**：`type (ASC), email (ASC)`
- **檔案出處**：
  - `src/components/AuthContext.tsx`
- **用途**：檢查使用者的 Google Email 是否在管理員白名單中。
