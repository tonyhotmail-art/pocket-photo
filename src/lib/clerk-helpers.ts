import { auth, clerkClient } from '@clerk/nextjs/server';
import type { User } from '@clerk/nextjs/server';

/**
 * 取得目前登入的 Clerk 使用者（強制從 Clerk 伺服器拉取最新資料）
 * 取代過時的 currentUser()，確保 publicMetadata 永遠是最新的
 * @throws {Error} 如果使用者未登入
 */
export async function requireAuth(): Promise<User> {
    const { userId } = await auth();
    if (!userId) {
        throw new Error('未登入，請先驗證身份');
    }
    const client = await clerkClient();
    return client.users.getUser(userId);
}

/**
 * 不拋出錯誤的版本，適合在 API Route 中自行處理 401 回應
 * 若未登入則回傳 null
 */
export async function getAuthUser(): Promise<User | null> {
    try {
        const { userId } = await auth();
        if (!userId) return null;
        const client = await clerkClient();
        return client.users.getUser(userId);
    } catch {
        return null;
    }
}
