import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
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

        const client = await clerkClient();
        const user = await client.users.getUser(userId);
        const email = user.emailAddresses[0]?.emailAddress;

        // ⚠️ 超管保護機制：這些帳號的 role 永遠固定為 system_admin，任何程式都不可降級
        const SUPER_ADMIN_EMAILS = ["tony.hotmail@gmail.com", "tony7777777@gmail.com"];
        if (email && SUPER_ADMIN_EMAILS.includes(email.toLowerCase())) {
            // client 已在上方宣告，直接使用即可
            const currentMeta = user.publicMetadata ?? {};
            // 只有目前不是 system_admin 時才更新（避免不必要的 API 呼叫）
            if (currentMeta.role !== "system_admin") {
                await client.users.updateUserMetadata(userId, {
                    publicMetadata: { ...currentMeta, role: "system_admin" }
                });
                console.log(`[SyncRole] 🔒 超管保護：${email} 的 role 已強制鎖定為 system_admin`);
            }
            return NextResponse.json({ success: true, message: "超管身分已確認", userId, email });
        }

        // 1. 先確認 Firestore 中儲存的權限（admins 集合）
        const firestoreAdminData = await checkFirestoreAdmin(userId, email);

        if (!firestoreAdminData) {
            return NextResponse.json({ error: "無管理員權限" }, { status: 403 });
        }

        // 1.5 另外查詢 global_tenants 集合，取得此使用者的 photo slug（admins 集合沒有存 slug）
        const photoSlugFromGlobalTenants = await getPhotoSlugForUser(userId, email);

        // 2. 已確認是管理員，同步 role 與 appAccess 到 Clerk publicMetadata（新 SaaS 架構）
        // 先讀取 Clerk 現有的 appAccess（在 grantRoleAndTenant 成功的情況下，這裡應該已有值）
        const existingAppAccess = (user.publicMetadata?.appAccess as Record<string, string>) ?? {};

        // 來源優先級：global_tenants > admins.tenantSlug > Clerk 現有的 photo_slug
        const photoSlug =
            photoSlugFromGlobalTenants ??
            (firestoreAdminData.tenantSlug || undefined) ??
            existingAppAccess.photo_slug ??
            undefined;

        // 合併策略：有找到 slug 就寫入，否則保留 Clerk 現有的 appAccess
        const mergedAppAccess = photoSlug
            ? { ...existingAppAccess, photo_slug: photoSlug }
            : existingAppAccess;

        // client 已在上方宣告，直接使用
        await client.users.updateUserMetadata(userId, {
            publicMetadata: {
                ...user.publicMetadata,   // 保留所有現有欄位
                role: firestoreAdminData.role,
                appAccess: mergedAppAccess,
                // 保留舊版 tenantSlug 供相容（待全面切換後可移除）
                tenantSlug: photoSlug ?? null
            }
        });

        const finalPhotoSlug = photoSlug ?? null;

        console.log(`[SyncRole] ✅ userId: ${userId} 已同步至 Clerk Metadata (role: ${firestoreAdminData.role}, photo_slug: ${finalPhotoSlug})`);

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

/**
 * 從 global_tenants 集合查詢使用者被分配到的 photo slug
 * admins 集合沒有存 tenantSlug，所以必須查這裡
 */
async function getPhotoSlugForUser(userId: string, email: string | undefined): Promise<string | null> {
    try {
        const adminDb = getFirestore(getAdminApp());

        // 優先用 Clerk User ID 查
        const snapById = await adminDb.collection("global_tenants")
            .where("type", "==", "photo")
            .where("ownerClerkId", "==", userId)
            .limit(1)
            .get();
        if (!snapById.empty) {
            const slug = snapById.docs[0].data().slug;
            console.log(`[SyncRole] 📦 從 global_tenants 查到 slug: ${slug}`);
            return slug || null;
        }

        // 若查不到，改用 email 查（相容早期資料）
        if (email) {
            const snapByEmail = await adminDb.collection("global_tenants")
                .where("type", "==", "photo")
                .where("ownerEmail", "==", email.toLowerCase())
                .limit(1)
                .get();
            if (!snapByEmail.empty) {
                const slug = snapByEmail.docs[0].data().slug;
                console.log(`[SyncRole] 📦 從 global_tenants（by email）查到 slug: ${slug}`);
                return slug || null;
            }
        }

        return null;
    } catch (error) {
        console.error("[SyncRole] global_tenants 查詢失敗:", error);
        return null;
    }
}
