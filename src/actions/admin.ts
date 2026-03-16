"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { getAdminApp } from "@/lib/firebase-admin";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

interface AdminData {
    role: "system_admin" | "admin" | "store_admin";
    tenantId?: string;
    tenantSlug?: string;
}

/**
 * 查詢 Firestore admins 集合確認管理員身份，並回傳角色與所屬的 Slug
 */
async function checkFirestoreAdmin(userId: string, email: string | undefined): Promise<AdminData | null> {
    try {
        const adminDb = getFirestore(getAdminApp());

        const snapById = await adminDb.collection("admins")
            .where("clerkUserId", "==", userId)
            .limit(1)
            .get();
        if (!snapById.empty) {
            const data = snapById.docs[0].data();
            return { role: data.role, tenantId: data.tenantId, tenantSlug: data.tenantSlug };
        }

        if (email) {
            const snapByEmail = await adminDb.collection("admins")
                .where("email", "==", email.toLowerCase())
                .limit(1)
                .get();
            if (!snapByEmail.empty) {
                const data = snapByEmail.docs[0].data();
                return { role: data.role, tenantId: data.tenantId, tenantSlug: data.tenantSlug };
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
        console.error("[SyncRole Action] Firestore 查詢失敗:", error);
        return null;
    }
}

/**
 * 從 global_tenants 集合查詢使用者被分配到的 photo tenantId (原：slug)
 */
async function getPhotoTenantIdForUser(userId: string, email: string | undefined): Promise<string | null> {
    try {
        const adminDb = getFirestore(getAdminApp());

        const snapById = await adminDb.collection("global_tenants")
            .where("type", "==", "photo")
            .where("ownerClerkId", "==", userId)
            .where("status", "==", "active")
            .limit(1)
            .get();
        if (!snapById.empty) {
            const data = snapById.docs[0].data();
            return data.tenantId || data.id || snapById.docs[0].id;
        }

        if (email) {
            const snapByEmail = await adminDb.collection("global_tenants")
                .where("type", "==", "photo")
                .where("ownerEmail", "==", email.toLowerCase())
                .where("status", "==", "active")
                .limit(1)
                .get();
            if (!snapByEmail.empty) {
                const data = snapByEmail.docs[0].data();
                return data.tenantId || data.id || snapByEmail.docs[0].id;
            }
        }

        return null;
    } catch (error) {
        console.error("[SyncRole Action] global_tenants 查詢失敗:", error);
        return null;
    }
}

/**
 * 同步 Firestore 管理員狀態到 Clerk publicMetadata
 * (取代原來的 POST /api/admin/sync-role)
 */
export async function syncAdminRoleAction() {
    try {
        const { userId } = await auth();

        if (!userId) {
            return { success: false, error: "未登入" };
        }

        const client = await clerkClient();
        const user = await client.users.getUser(userId);
        const email = user.emailAddresses[0]?.emailAddress;

        // ⚠️ 超管保護機制
        const SUPER_ADMIN_EMAILS = ["tony.hotmail@gmail.com", "tony7777777@gmail.com"];
        if (email && SUPER_ADMIN_EMAILS.includes(email.toLowerCase())) {
            const currentMeta = user.publicMetadata ?? {};
            if (currentMeta.role !== "system_admin") {
                await client.users.updateUserMetadata(userId, {
                    publicMetadata: { ...currentMeta, role: "system_admin" }
                });
                console.log(`[SyncRole Action] 🔒 超管保護：${email} 的 role 已強制鎖定為 system_admin`);
            }
            return { success: true, message: "超管身分已確認", userId, email };
        }

        const firestoreAdminData = await checkFirestoreAdmin(userId, email);

        if (!firestoreAdminData) {
            return { success: false, error: "無管理員權限", status: 403 };
        }

        const photoTenantIdFromGlobalTenants = await getPhotoTenantIdForUser(userId, email);
        const existingAppAccess = (user.publicMetadata?.appAccess as Record<string, string>) ?? {};

        const photoTenantId =
            photoTenantIdFromGlobalTenants ??
            (firestoreAdminData.tenantId || undefined) ??
            (firestoreAdminData.tenantSlug || undefined) ??
            undefined;

        const mergedAppAccess = photoTenantId
            ? { ...existingAppAccess, photo_slug: photoTenantId }
            : { ...existingAppAccess, photo_slug: undefined };

        await client.users.updateUserMetadata(userId, {
            publicMetadata: {
                ...user.publicMetadata,
                role: firestoreAdminData.role,
                appAccess: mergedAppAccess,
                tenantSlug: photoTenantId ?? null
            }
        });

        console.log(`[SyncRole Action] ✅ userId: ${userId} 已同步至 Clerk Metadata`);

        return {
            success: true,
            message: "管理員角色已同步至 Clerk",
            userId,
            email
        };

    } catch (error) {
        console.error("[SyncRole Action] 同步失敗:", error);
        return { success: false, error: "同步失敗" };
    }
}

/**
 * 提交申請開通相館服務
 * (取代原來的 POST /api/apply)
 */
export async function applyTenantAction(formData: {
    name: string;
    phone: string;
    description: string;
}) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return { success: false, error: "未登入，請先登入後再申請" };
        }

        const client = await clerkClient();
        const user = await client.users.getUser(userId);
        const email = user.emailAddresses[0]?.emailAddress;

        if (!email) {
            return { success: false, error: "找不到聯絡信箱" };
        }

        const db = getFirestore(getAdminApp());

        // 1. 檢查是否已經提交過申請（包含待審核或已核准但尚未配發 tenant）
        const applicationsRef = db.collection("applications");
        const existingAppSnapshot = await applicationsRef
            .where("applicantClerkId", "==", userId)
            .where("status", "in", ["pending", "approved"])
            .get();

        if (!existingAppSnapshot.empty) {
            return { success: false, error: "您已經有處理中的申請，請靜候通知。" };
        }

        // 2. 檢查是否已經有專屬的 slug（已是正式用戶）
        const tenantsRef = db.collection("global_tenants");
        const existingTenantSnapshot = await tenantsRef
            .where("ownerClerkId", "==", userId)
            .get();

        if (!existingTenantSnapshot.empty) {
            return { success: false, error: "您已經開通相館服務，無需重複申請。" };
        }

        // 3. 寫入新申請單
        const newAppRef = applicationsRef.doc();
        await newAppRef.set({
            appName: "Pocket Photo", // 標記是申請哪個服務
            applicantEmail: email,
            applicantClerkId: userId,
            name: formData.name,
            phone: formData.phone,
            description: formData.description,
            status: "pending", // 狀態：pending, approved, rejected, provisioned
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        });

        console.log(`[Apply Action] ✅ ${email} 提交了申請單 (${newAppRef.id})`);
        return { success: true };
    } catch (error) {
        console.error("[Apply Action] ❌ 儲存申請單失敗:", error);
        return { success: false, error: "伺服器錯誤，申請失敗" };
    }
}
