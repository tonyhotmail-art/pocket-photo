import { env } from "@/lib/env";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { getAdminApp } from "@/lib/firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { UserRole } from "@/lib/role-hierarchy";

// 從環境變數取得水管設定（預設 'clerk'）
const AUTH_PIPE = env.AUTH_PIPE;

/**
 * 驗證請求是否來自已授權的管理員 (system_admin 或 store_admin)
 */
export async function verifyAdminAuth() {
    try {
        // 改從 auth() 取得 userId 與 sessionClaims，避開舊有 currentUser() 引發的 500 錯誤
        const { userId, sessionClaims } = await auth();

        if (!userId) {
            return {
                success: false,
                error: "未登入，請先驗證身份",
                status: 401
            };
        }

        let email = sessionClaims?.email as string | undefined;
        let publicMetadata: Record<string, unknown> | undefined;

        try {
            // 從 Server 拿取完整的 User 物件，確保 publicMetadata 最新
            const client = await clerkClient();
            const user = await client.users.getUser(userId);
            if (!email) {
                email = user.emailAddresses[0]?.emailAddress;
            }
            publicMetadata = user.publicMetadata;
        } catch (e) {
            console.warn("[Auth] 無法從 Clerk 取得詳細資料", e);
        }

        const userRole = await checkRoleWithDualPipe(userId, email, publicMetadata);

        if (userRole !== 'system_admin' && userRole !== 'store_admin') {
            return {
                success: false,
                error: "無權限執行此操作",
                status: 403
            };
        }

        // 從新 SaaS 架構的 appAccess.photo_slug 讀取 (現在 photo_slug 裡面存的是真實的 tenantId)
        const appAccess = publicMetadata?.appAccess as Record<string, string> | undefined;
        const tenantId = appAccess?.photo_slug ?? (publicMetadata?.tenantSlug as string | undefined);

        return {
            success: true,
            userId,
            email,
            role: userRole,
            tenantId
        };

    } catch (error: any) {
        console.error("驗證過程發生錯誤:", error?.message, error?.stack);
        return {
            success: false,
            error: "驗證失敗",
            status: 500
        };
    }
}

/**
 * 雙水管核心判斷函式 (對齊口袋預約的新角色邏輯)
 */
async function checkRoleWithDualPipe(
    userId: string,
    email: string | undefined,
    publicMetadata: Record<string, unknown> | undefined
): Promise<UserRole | null> {

    const checkClerkPipe = () => checkClerkMetadata(publicMetadata);
    const checkFirebasePipe = () => checkFirestoreRole(userId, email);

    switch (AUTH_PIPE) {
        case "clerk-only":
            return checkClerkPipe();
        case "firebase-only":
            return checkFirebasePipe();
        case "firebase":
            const fbResult = await checkFirebasePipe();
            if (fbResult === 'system_admin' || fbResult === 'store_admin') return fbResult;
            return checkClerkPipe();
        case "clerk":
        default:
            const clerkResult = checkClerkPipe();
            if (clerkResult === 'system_admin' || clerkResult === 'store_admin') return clerkResult;

            const firestoreResult = await checkFirebasePipe();
            // 若 Firestore 驗證過，將角色同步回寫 Clerk publicMetadata
            if (firestoreResult === 'system_admin' || firestoreResult === 'store_admin') {
                syncRoleToClerk(userId, firestoreResult).catch(err =>
                    console.error("[Auth] Clerk Metadata 同步失敗:", err)
                );
            }
            return firestoreResult;
    }
}

function checkClerkMetadata(
    publicMetadata: Record<string, unknown> | undefined
): UserRole | null {
    const role = publicMetadata?.role as string;
    if (role === 'system_admin' || role === 'admin') return 'system_admin';
    if (role === 'store_admin') return 'store_admin';
    return null;
}

async function checkFirestoreRole(
    userId: string,
    email: string | undefined
): Promise<UserRole | null> {
    try {
        const adminDb = getFirestore(getAdminApp());

        // 使用 clerkUserId 比對
        const snapById = await adminDb.collection("admins").where("clerkUserId", "==", userId).limit(1).get();
        if (!snapById.empty) {
            const data = snapById.docs[0].data();
            if (data.role === 'system_admin' || data.role === 'admin') return 'system_admin';
            if (data.role === 'store_admin') return 'store_admin';
        }

        // 使用 email 比對
        if (email) {
            const snapByEmail = await adminDb.collection("admins").where("email", "==", email.toLowerCase()).limit(1).get();
            if (!snapByEmail.empty) {
                const data = snapByEmail.docs[0].data();
                if (data.role === 'system_admin' || data.role === 'admin') return 'system_admin';
                if (data.role === 'store_admin') return 'store_admin';
            }
        }

        return null;
    } catch (error: any) {
        // ★ 修復 500 錯誤的核心：發生 Firebase 拒絕存取時，平穩回傳 null，不再因為 throw Error 導致崩潰
        console.error("[Auth] Firestore 管理員查詢失敗 (可能憑證錯誤等):", error?.code, error?.message);
        return null;
    }
}

async function syncRoleToClerk(userId: string, newRole: string): Promise<void> {
    try {
        const client = await clerkClient();
        // 先讀取現有 metadata，再做合併（spread），避免覆蓋已存在的 appAccess.photo_slug
        const user = await client.users.getUser(userId);
        const existingMetadata = user.publicMetadata ?? {};
        await client.users.updateUserMetadata(userId, {
            publicMetadata: {
                ...existingMetadata,  // 保留所有現有欄位（包含 appAccess）
                role: newRole          // 只更新 role
            }
        });
        console.log(`[Auth] ✅ Clerk Metadata 同步完成 (userId: ${userId}, role: ${newRole})`);
    } catch (error) {
        console.error("[Auth] ❌ Clerk Metadata 同步失敗:", error);
    }
}
