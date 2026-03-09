import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { z } from 'zod';

// Zod 驗證 schema
const applySchema = z.object({
    storeName: z.string().min(2, '店館名稱至少需要 2 個字').max(50, '店館名稱不得超過 50 個字'),
    slug: z.string()
        .min(2, 'Slug 至少需要 2 個字元')
        .max(30, 'Slug 不得超過 30 個字元')
        .regex(/^[a-z0-9-]+$/, 'Slug 只能包含小寫英文、數字、連字號'),
    contactEmail: z.string().email('請填入有效的電子郵件地址'),
});

/**
 * POST /api/apply
 * 提交相片館開通申請
 * Beta 模式：申請即自動開通，給予 30 天免費試用期
 */
export async function POST(req: NextRequest) {
    try {
        // 驗證登入狀態
        const { userId: clerkUserId } = await auth();
        if (!clerkUserId) {
            return NextResponse.json({ success: false, error: '請先登入再提交申請' }, { status: 401 });
        }
        const client = await clerkClient();
        const user = await client.users.getUser(clerkUserId);

        // 若已有相館，不需再申請
        const appAccess = user.publicMetadata?.appAccess as Record<string, string> | undefined;
        const existingSlug = appAccess?.photo_slug ?? (user.publicMetadata?.tenantSlug as string | undefined);
        if (existingSlug) {
            return NextResponse.json({ success: false, error: '您已擁有相館，無需重複申請' }, { status: 400 });
        }

        const body = await req.json();

        // Zod 驗證
        const parsed = applySchema.safeParse(body);
        if (!parsed.success) {
            const errors = parsed.error.issues.map((e: { message: string }) => e.message).join('、');
            return NextResponse.json({ success: false, error: errors }, { status: 400 });
        }

        const { storeName, slug, contactEmail } = parsed.data;

        // 檢查 Slug 是否已被使用
        const tenantConflictSnap = await adminDb.collection('tenants')
            .where('slug', '==', slug)
            .limit(1)
            .get();

        if (!tenantConflictSnap.empty) {
            return NextResponse.json({ success: false, error: `網址代號「${slug}」已被使用，請換一個不同的代號。` }, { status: 400 });
        }

        const userEmail = user.emailAddresses[0]?.emailAddress || contactEmail;
        const today = new Date().toISOString().split('T')[0]; // "2026-03-08" 格式
        const trialDays = 30;

        // ====== 自動開通：一次完成所有設定 ======

        // 1. 建立 tenants/{slug} 文件（含試用期資訊）
        await adminDb.collection('tenants').doc(slug).set({
            slug,
            name: storeName,
            ownerClerkId: clerkUserId,
            ownerEmail: userEmail.toLowerCase().trim(),
            status: 'active',
            plan: 'trial',
            trialStartDate: today,
            trialDays: trialDays,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // 2. 建立 system_settings/{slug}（相本名稱 = 申請者填寫的名稱）
        await adminDb.collection('system_settings').doc(slug).set({
            tenantId: slug,
            siteName: storeName,
            allowSharing: true,
            showTimeline: false,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        // 3. 烙印 Clerk Metadata（設定角色 + 相館代號）
        const existingMetadata = user.publicMetadata || {};
        const existingAppAccess = (existingMetadata.appAccess as Record<string, string>) || {};
        await client.users.updateUserMetadata(clerkUserId, {
            publicMetadata: {
                ...existingMetadata,
                role: existingMetadata.role || 'store_admin',
                appAccess: {
                    ...existingAppAccess,
                    photo_slug: slug,
                },
            },
        });

        // 4. 建立預設分類「待分類照片」
        await adminDb.collection('categories').add({
            name: '待分類照片',
            order: 0,
            visible: true,
            tenantId: slug,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // 5. 記錄到 admins 表
        await adminDb.collection('admins').doc(clerkUserId).set({
            clerkUserId,
            email: userEmail.toLowerCase().trim(),
            role: 'store_admin',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        console.log(`[API: /api/apply] ✅ 自動開通成功：${storeName} (/${slug})，試用 ${trialDays} 天`);

        return NextResponse.json({
            success: true,
            slug,
            message: `您的相館「${storeName}」已自動開通！享有 ${trialDays} 天免費試用期。`,
        });

    } catch (error: any) {
        console.error('[API: /api/apply] 自動開通失敗:', error);
        return NextResponse.json({ success: false, error: '伺服器錯誤，請稍後再試' }, { status: 500 });
    }
}
