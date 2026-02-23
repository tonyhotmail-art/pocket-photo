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

        // 1. 先確認 Firestore 確實是管理員（水管 B 最終確認）
        const isFirestoreAdmin = await checkFirestoreAdmin(userId, email);

        if (!isFirestoreAdmin) {
            return NextResponse.json({ error: "無管理員權限" }, { status: 403 });
        }

        // 2. 已確認是管理員，同步 role 到 Clerk publicMetadata（啟用水管 A）
        const client = await clerkClient();
        await client.users.updateUserMetadata(userId, {
            publicMetadata: { role: "admin" }
        });

        console.log(`[SyncRole] ✅ userId: ${userId} 已同步至 Clerk Metadata`);

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
            publicMetadata: { role: null }
        });

        console.log(`[SyncRole] 🗑️ userId: ${userId} 的 Clerk Metadata 管理員標記已移除`);

        return NextResponse.json({ success: true, message: "管理員標記已撤銷" });

    } catch (error) {
        console.error("[SyncRole] 撤銷失敗:", error);
        return NextResponse.json({ error: "撤銷失敗" }, { status: 500 });
    }
}

/**
 * 查詢 Firestore admins 集合確認管理員身份
 */
async function checkFirestoreAdmin(userId: string, email: string | undefined): Promise<boolean> {
    try {
        const adminDb = getFirestore(getAdminApp());

        const snapById = await adminDb.collection("admins")
            .where("clerkUserId", "==", userId)
            .limit(1)
            .get();
        if (!snapById.empty) return true;

        if (email) {
            const snapByEmail = await adminDb.collection("admins")
                .where("email", "==", email.toLowerCase())
                .limit(1)
                .get();
            if (!snapByEmail.empty) return true;

            const superAdmins = [
                "tony.hotmail@gmail.com",
                "tony7777777@gmail.com"
            ];
            if (superAdmins.includes(email.toLowerCase())) return true;
        }

        return false;
    } catch (error) {
        console.error("[SyncRole] Firestore 查詢失敗:", error);
        return false;
    }
}
