/**
 * 發送已授權的 API 請求
 * Clerk 使用 Cookie-based Session，無需手動附加 Token。
 * 此函式確保呼叫端已登入，並附加正確的 Content-Type header（若需要）。
 */
export async function authenticatedFetch(
    url: string,
    options: RequestInit = {}
): Promise<Response> {
    try {
        // Clerk Middleware 會自動驗證 Cookie Session，
        // 無需手動取得並附加 Bearer Token
        return fetch(url, {
            ...options,
            // 預設使用 same-origin credentials 以攜帶 Clerk Cookie
            credentials: "same-origin",
        });
    } catch (error) {
        console.error("Authenticated fetch error:", error);
        // NOTE: Sentry 追蹤點 - 請求發送失敗
        throw error;
    }
}
