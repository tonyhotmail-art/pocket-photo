
### 追查與修復 (2026-03-15 後續)

**發現真正的 Root Cause：**
- 發現所有 `kelly` 舊照片之所以會吃錯標籤，是因為在給 Kelly 開通管理員權限時，由 `src/app/api/admin/sync-role/route.ts` 這支 API 以及 `src/actions/admin.ts` 所負責。
- 這兩支程式在去 `global_tenants` 查詢擁有者身分時，**錯誤地提取了網址名稱 (`slug`) 取代真實的 `tenantId`**，並將它寫死進了 Clerk 的 `publicMetadata.appAccess.photo_slug` 欄位中。
- 導致後續 Kelly 登入後，上傳 API 強調安全防衛時，竟拿著這個錯的 slug 當作真理，強制覆寫給了每一張照片。

**修復方案執行：**
1. **修正源頭查詢**：將 `sync-role/route.ts` 跟 `actions/admin.ts` 內的函式重構為 `getPhotoTenantIdForUser`。它現在只會讀取並回傳最底層的真實 `tenantId`（例如 `tenant_kelly_owner`）或文件 `id`。
2. **正名與釐清**：將寫入 Clerk 雖然欄位依舊叫做 `photo_slug`，但內容已經換成了真實 ID。同時在 API 最終端 `/api/upload/route.ts` 跟 `auth-middleware.ts` 裡，把取出這個值的變數名稱從 `tenantSlug` 正名為 `tenantId`，防止未來開發者誤解。
3. **驗證與編譯**：排除因備份檔 `.bak.ts` 引起的 TypeScript 衝突，重新執行 `npm run build` 通過。

**等待開發者下一步驗證：**
1. 去 Clerk Dashboard 把 Kelly 帳號中的 metadata `photo_slug` 清空。
2. 重新觸發一次角色同步（或重新派發權限）。
3. 使用 Kelly 帳號於 `/kelly` 頁面上傳新照片，檢查資料庫中的 `tenantId` 是否終於被正確地打上 `"tenant_kelly_owner"`。
