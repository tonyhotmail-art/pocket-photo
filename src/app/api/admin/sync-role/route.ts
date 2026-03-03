import { NextResponse } from "next/server";
import { auth, currentUser, clerkClient } from "@clerk/nextjs/server";
import { getAdminApp } from "@/lib/firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

/**
 * POST /api/admin/sync-role
 * 同步 Firestore 管理員狀態到 Clerk publicMetadata
 * 此端點只有「已登入且在 Firestore 確認為管理員」的使用者才能執行
 */
export async function POST() {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: "未登入" }, { status: 401 });
        }

        const user = await currentUser();
        const email = user?.emailAddresses[0]?.emailAddress;

        // 1. 先確認 Firestore 中儲存的權限與店鋪綁定資料（水管 B 最終確認）
        const firestoreAdminData = await checkFirestoreAdmin(userId, email);

        if (!firestoreAdminData) {
            return NextResponse.json({ error: "無管理員權限" }, { status: 403 });
        }

        // 2. 已確認是管理員，同步 role 與 appAccess 到 Clerk publicMetadata（新 SaaS 架構）
        const photoSlug = firestoreAdminData.tenantSlug || null;
        const client = await clerkClient();
        await client.users.updateUserMetadata(userId, {
            publicMetadata: {
                role: firestoreAdminData.role,
                // 新 SaaS 架構：用 appAccess 儲存各 App 的分店 slug
                appAccess: photoSlug ? { photo_slug: photoSlug } : null,
                // 保留舊版 tenantSlug 供相容（待全面切換後可移除）
                tenantSlug: photoSlug
            }
        });

        console.log(`[SyncRole] ✅ userId: ${userId} 已同步至 Clerk Metadata (role: ${firestoreAdminData.role}, photo_slug: ${photoSlug})`);

        return NextResponse.json({
            success: true,
            message: "管理員角色已同步至 Clerk",
            userId,
            email
        });

    } catch (error) {
        console.error("[SyncRole] 同步失敗:", error);
        return NextResponse.json({ error: "同步失敗" }, { status: 500 });
    }
}

/**
 * DELETE /api/admin/sync-role
 * 從 Clerk publicMetadata 移除管理員標記（revoke 水管 A）
 * 當管理員從 Firestore 被移除時，可呼叫此端點撤銷 Clerk 側的標記
 */
export async function DELETE() {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: "未登入" }, { status: 401 });
        }

        const client = await clerkClient();
        await client.users.updateUserMetadata(userId, {
            publicMetadata: { role: null, tenantSlug: null, appAccess: null }
        });

        console.log(`[SyncRole] 🗑️ userId: ${userId} 的 Clerk Metadata 管理員標記已移除`);

        return NextResponse.json({ success: true, message: "管理員標記已撤銷" });

    } catch (error) {
        console.error("[SyncRole] 撤銷失敗:", error);
        return NextResponse.json({ error: "撤銷失敗" }, { status: 500 });
    }
}

/**
 * 查詢 Firestore admins 集合確認管理員身份，並回傳角色與所屬的 Slug
 */
interface AdminData {
    role: "system_admin" | "admin" | "store_admin";
    tenantSlug?: string;
}

async function checkFirestoreAdmin(userId: string, email: string | undefined): Promise<AdminData | null> {
    try {
        const adminDb = getFirestore(getAdminApp());

        const snapById = await adminDb.collection("admins")
            .where("clerkUserId", "==", userId)
            .limit(1)
            .get();
        if (!snapById.empty) {
            const data = snapById.docs[0].data();
            return { role: data.role, tenantSlug: data.tenantSlug };
        }

        if (email) {
            const snapByEmail = await adminDb.collection("admins")
                .where("email", "==", email.toLowerCase())
                .limit(1)
                .get();
            if (!snapByEmail.empty) {
                const data = snapByEmail.docs[0].data();
                return { role: data.role, tenantSlug: data.tenantSlug };
            }

            const superAdmins = [
                "tony.hotmail@gmail.com",
                "tony7777777@gmail.com"
            ];
            if (superAdmins.includes(email.toLowerCase())) {
                return { role: "system_admin" };
            }
        }

        return null;
    } catch (error) {
        console.error("[SyncRole] Firestore 查詢失敗:", error);
        return null;
    }
}
