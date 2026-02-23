import { auth, currentUser, clerkClient } from "@clerk/nextjs/server";
import { getAdminApp } from "@/lib/firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

// 從環境變數取得水管設定（預設 'clerk'）
const AUTH_PIPE = (process.env.AUTH_PIPE ?? "clerk") as
    | "clerk"
    | "firebase"
    | "clerk-only"
    | "firebase-only";

/**
 * 驗證請求是否來自已授權的管理員
 * 使用雙水管 (Dual-Pipe) 架構：Clerk Metadata 與 Firestore admins 集合互為備援
 * 透過 AUTH_PIPE 環境變數控制優先順序與備援行為
 */
export async function verifyAdminAuth() {
    try {
        // 1. 從 Clerk 取得當前使用者 Session
        const { userId } = await auth();

        if (!userId) {
            return {
                success: false,
                error: "未登入，請先驗證身份",
                status: 401
            };
        }

        // 2. 取得使用者完整資訊（含 Email）
        const user = await currentUser();
        const email = user?.emailAddresses[0]?.emailAddress;

        // 3. 根據 AUTH_PIPE 決定判斷邏輯
        const isAdmin = await checkAdminWithDualPipe(userId, email, user?.publicMetadata);

        if (!isAdmin) {
            return {
                success: false,
                error: "無權限執行此操作",
                status: 403
            };
        }

        return {
            success: true,
            userId,
            email
        };

    } catch (error) {
        console.error("驗證過程發生錯誤:", error);
        return {
            success: false,
            error: "驗證失敗",
            status: 500
        };
    }
}

/**
 * 雙水管核心判斷函式
 * 根據 AUTH_PIPE 環境變數依序嘗試兩個管道
 */
async function checkAdminWithDualPipe(
    userId: string,
    email: string | undefined,
    publicMetadata: Record<string, unknown> | undefined
): Promise<boolean> {

    const checkClerkPipe = () => checkClerkMetadata(publicMetadata);
    const checkFirebasePipe = () => checkFirestoreAdmin(userId, email);

    switch (AUTH_PIPE) {
        case "clerk-only":
            // 只用 Clerk，不查 Firestore
            return checkClerkPipe();

        case "firebase-only":
            // 只用 Firestore，不查 Clerk
            return checkFirebasePipe();

        case "firebase":
            // Firestore 優先，Clerk 備援
            const fbResult = await checkFirebasePipe();
            if (fbResult) return true;
            console.log("[Auth] Firestore 未找到管理員，回退至 Clerk Metadata...");
            return checkClerkPipe();

        case "clerk":
        default:
            // Clerk Metadata 優先，Firestore 備援（預設）
            const clerkResult = await checkClerkPipe();
            if (clerkResult) return true;
            console.log("[Auth] Clerk Metadata 未標記，回退至 Firestore...");
            const firestoreResult = await checkFirebasePipe();
            // 若 Firestore 確認是管理員，觸發非同步同步（補水管 A）
            if (firestoreResult) {
                syncRoleToClerk(userId).catch(err =>
                    console.error("[Auth] Clerk Metadata 同步失敗:", err)
                );
            }
            return firestoreResult;
    }
}

/**
 * 水管 A：讀取 Clerk publicMetadata
 * 速度最快，不需查詢資料庫
 */
function checkClerkMetadata(
    publicMetadata: Record<string, unknown> | undefined
): boolean {
    return publicMetadata?.role === "admin";
}

/**
 * 水管 B：查詢 Firestore admins 集合
 * 完全自主，不依賴第三方
 */
async function checkFirestoreAdmin(
    userId: string,
    email: string | undefined
): Promise<boolean> {
    try {
        const adminDb = getFirestore(getAdminApp());

        // 先比對 clerkUserId
        const snapById = await adminDb.collection("admins")
            .where("clerkUserId", "==", userId)
            .limit(1)
            .get();
        if (!snapById.empty) return true;

        if (email) {
            // 再比對 Email
            const snapByEmail = await adminDb.collection("admins")
                .where("email", "==", email.toLowerCase())
                .limit(1)
                .get();
            if (!snapByEmail.empty) return true;

            // 硬編碼超級管理員清單
            const superAdmins = [
                "tony.hotmail@gmail.com",
                "tony7777777@gmail.com"
            ];
            if (superAdmins.includes(email.toLowerCase())) return true;
        }

        return false;
    } catch (error) {
        console.error("[Auth] Firestore 管理員查詢失敗:", error);
        return false;
    }
}

/**
 * 自動同步：當 Firestore 確認是管理員但 Clerk Metadata 尚未標記時，
 * 自動將 role: 'admin' 寫入 Clerk publicMetadata，為下次登入備妥水管 A
 */
async function syncRoleToClerk(userId: string): Promise<void> {
    try {
        const client = await clerkClient();
        await client.users.updateUserMetadata(userId, {
            publicMetadata: { role: "admin" }
        });
        console.log(`[Auth] ✅ Clerk Metadata 同步完成 (userId: ${userId})`);
    } catch (error) {
        console.error("[Auth] ❌ Clerk Metadata 同步失敗:", error);
        throw error;
    }
}
