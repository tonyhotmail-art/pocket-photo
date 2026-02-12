import { auth } from "./firebase";

/**
 * 發送已授權的 API 請求
 * 自動附加 Firebase ID Token 到 Authorization header
 */
export async function authenticatedFetch(
    url: string,
    options: RequestInit = {}
): Promise<Response> {
    try {
        // 取得當前使用者的 ID Token
        const user = auth.currentUser;

        if (!user) {
            throw new Error("使用者未登入");
        }

        const token = await user.getIdToken();

        // 合併 headers
        const headers = new Headers(options.headers);
        headers.set("Authorization", `Bearer ${token}`);

        // 發送請求
        return fetch(url, {
            ...options,
            headers,
        });
    } catch (error) {
        console.error("Authenticated fetch error:", error);
        throw error;
    }
}
