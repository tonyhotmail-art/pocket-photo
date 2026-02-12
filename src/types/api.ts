/**
 * 統一 API 回傳格式
 * 所有 API 必須使用此格式回傳資料
 */
export interface ApiResponse<T = any> {
    /** 操作是否成功 */
    success: boolean;
    /** 成功時回傳的資料 */
    data?: T;
    /** 失敗時的錯誤訊息 */
    error?: string;
    /** 額外的錯誤詳情 (開發用) */
    details?: string;
}

/**
 * 上傳 API 回傳資料
 */
export interface UploadResponseData {
    /** 上傳後的檔案 URL */
    url: string;
}

/**
 * 刪除 API 回傳資料
 */
export interface DeleteResponseData {
    /** 成功刪除的數量 */
    deletedCount?: number;
    /** 失敗的數量 */
    failedCount?: number;
}
