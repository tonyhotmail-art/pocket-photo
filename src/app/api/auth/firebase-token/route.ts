import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getAdminAuth } from "@/lib/firebase-admin";

/**
 * POST /api/auth/firebase-token
 *
 * Clerk 登入後，前端呼叫此 API 取得 Firebase Custom Token。
 * 用途：讓 Firestore Security Rules 的 request.auth 有值。
 *
 * 流程：
 * 1. 驗證 Clerk Session
 * 2. 透過 currentUser() 取得使用者完整資料（含 email）
 * 3. 用 Firebase Admin SDK 產生 Custom Token（帶 email claims）
 * 4. 回傳 token 給前端
 */
export async function POST() {
    try {
        // 驗證 Clerk Session
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json(
                { error: "未登入，無法產生 Firebase Token" },
                { status: 401 }
            );
        }

        // 透過 currentUser() 取得完整使用者資料（含 email）
        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress || "";

        console.log(`[firebase-token] 為 Clerk 使用者 ${userId} 產生 Firebase Custom Token（email: ${email}）`);

        // 用 Firebase Admin SDK 產生 Custom Token
        // claims 中帶入 email，讓 Firestore rules 的 request.auth.token.email 可用
        const adminAuth = getAdminAuth();
        const customToken = await adminAuth.createCustomToken(userId, {
            email: email,
        });

        return NextResponse.json({ token: customToken });
    } catch (error) {
        console.error("[firebase-token] 產生 Custom Token 失敗:", error);
        return NextResponse.json(
            { error: "產生 Firebase Token 失敗" },
            { status: 500 }
        );
    }
}
