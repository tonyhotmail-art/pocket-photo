/**
 * 計算檔案內容的 SHA-256 雜湊值 (Hash)
 * 用於辨識重複圖片
 * 備用方案：若 crypto.subtle 不可用（HTTP 環境），改用檔案大小+名稱+修改時間產生簡易識別碼
 */
export async function calculateImageHash(file: File): Promise<string> {
    try {
        // 優先嘗試使用 crypto.subtle（需 HTTPS 或 localhost）
        if (typeof crypto !== 'undefined' && crypto.subtle) {
            const buffer = await file.arrayBuffer();
            const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        }
    } catch {
        // 發生錯誤時降級使用備用方案
    }

    // 備用方案：使用檔案名稱 + 大小 + 修改時間組合（非完美但可防止明顯重複）
    const fallback = `${file.name}-${file.size}-${file.lastModified}`;
    return fallback.split('').reduce((hash, char) => {
        const code = char.charCodeAt(0);
        return ((hash << 5) - hash + code) | 0;
    }, 0).toString(16).replace('-', 'n');
}
