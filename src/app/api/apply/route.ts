import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { z } from 'zod';

// Zod 驗證 schema（遵守 ROOT RULE：使用 Zod 驗證）
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
 */
export async function POST(req: NextRequest) {
    try {
        // 驗證登入狀態
        const user = await currentUser();
        if (!user) {
            return NextResponse.json({ success: false, error: '請先登入再提交申請' }, { status: 401 });
        }

        // 若已有相館（新 SaaS 架構用 appAccess.photo_slug，相容舊版 tenantSlug），不需再申請
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

        // 檢查是否已有待審核的申請
        const existingSnap = await adminDb.collection('pending_tenants')
            .where('userId', '==', user.id)
            .where('status', '==', 'pending')
            .limit(1)
            .get();

        if (!existingSnap.empty) {
            return NextResponse.json({
                success: false,
                error: '您已有一份待審核的申請，請等待管理員審核後再送出新的申請。'
            }, { status: 400 });
        }

        // 檢查 Slug 是否已被使用
        const slugConflictSnap = await adminDb.collection('pending_tenants')
            .where('slug', '==', slug)
            .where('status', 'in', ['pending', 'approved'])
            .limit(1)
            .get();

        const tenantConflictSnap = await adminDb.collection('tenants')
            .where('slug', '==', slug)
            .limit(1)
            .get();

        if (!slugConflictSnap.empty || !tenantConflictSnap.empty) {
            return NextResponse.json({ success: false, error: `網址代號「${slug}」已被使用，請換一個不同的代號。` }, { status: 400 });
        }

        // 儲存申請到 Firebase
        const newRef = adminDb.collection('pending_tenants').doc();
        await newRef.set({
            userId: user.id,
            email: user.emailAddresses[0]?.emailAddress || contactEmail,
            contactEmail,
            storeName,
            slug,
            status: 'pending',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return NextResponse.json({ success: true, applicationId: newRef.id });

    } catch (error: any) {
        console.error('[API: /api/apply] 申請送出失敗:', error);
        return NextResponse.json({ success: false, error: '伺服器錯誤，請稍後再試' }, { status: 500 });
    }
}
