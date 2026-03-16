import { NextResponse } from "next/server";
import { getAdminApp } from "@/lib/firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { verifyAdminAuth } from "@/lib/auth-middleware";
import { env } from "@/lib/env";
import { deleteFromR2 } from "@/lib/r2";

// 回收區專用的 categoryName 常數
export const RECYCLE_CATEGORY = "__回收區__";
// 30 天的毫秒數
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function getDb() {
    return getFirestore(getAdminApp());
}

// POST /api/recycle — 將照片移入回收區（軟刪除）
export async function POST(request: Request) {
    const authResult = await verifyAdminAuth();
    if (!authResult.success) {
        return NextResponse.json({ success: false, error: "未授權" }, { status: authResult.status ?? 401 });
    }

    const body = await request.json();
    const { ids } = body as { ids: string[] };
    if (!ids || ids.length === 0) {
        return NextResponse.json({ success: false, error: "未提供 ID" }, { status: 400 });
    }

    const db = getDb();
    const deletedAt = new Date().toISOString();
    const batch = db.batch();

    for (const id of ids) {
        const ref = db.collection("portfolio_items").doc(id);
        batch.update(ref, {
            categoryName: RECYCLE_CATEGORY,
            deletedAt,
            updatedAt: FieldValue.serverTimestamp(),
        });
    }
    await batch.commit();

    return NextResponse.json({ success: true, count: ids.length });
}

// DELETE /api/recycle?ids=... — 永久刪除（R2 + Firestore）
export async function DELETE(request: Request) {
    const authResult = await verifyAdminAuth();
    if (!authResult.success) {
        return NextResponse.json({ success: false, error: "未授權" }, { status: authResult.status ?? 401 });
    }

    const { searchParams } = new URL(request.url);
    const ids = searchParams.get("ids")?.split(",").filter(Boolean) || [];
    if (ids.length === 0) {
        return NextResponse.json({ success: false, error: "未提供 ID" }, { status: 400 });
    }

    const db = getDb();
    const results: { id: string; success: boolean; error?: string }[] = [];

    for (const id of ids) {
        try {
            const ref = db.collection("portfolio_items").doc(id);
            const snap = await ref.get();
            if (!snap.exists) { results.push({ id, success: false, error: "找不到此項目" }); continue; }
            const data = snap.data()!;
            if (data.imageUrl) {
                try { await deleteFromR2(data.imageUrl); } catch (r2Err) {
                    console.warn(`[recycle] R2 刪除失敗 (id=${id}):`, r2Err);
                }
            }
            await ref.delete();
            results.push({ id, success: true });
        } catch (err: any) {
            results.push({ id, success: false, error: err.message });
        }
    }

    return NextResponse.json({ success: true, results });
}

// PATCH /api/recycle — 復原（移回指定分類）
export async function PATCH(request: Request) {
    const authResult = await verifyAdminAuth();
    if (!authResult.success) {
        return NextResponse.json({ success: false, error: "未授權" }, { status: authResult.status ?? 401 });
    }

    const body = await request.json();
    const { ids, restoreCategory } = body as { ids: string[]; restoreCategory?: string };
    if (!ids || ids.length === 0) {
        return NextResponse.json({ success: false, error: "未提供 ID" }, { status: 400 });
    }

    const db = getDb();
    const batch = db.batch();

    for (const id of ids) {
        const ref = db.collection("portfolio_items").doc(id);
        batch.update(ref, {
            categoryName: restoreCategory || "待分類照片",
            deletedAt: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
        });
    }
    await batch.commit();

    return NextResponse.json({ success: true, count: ids.length });
}

// GET /api/recycle — 讀取回收區，並自動清除超過 30 天的項目
export async function GET(request: Request) {
    const authResult = await verifyAdminAuth();
    if (!authResult.success) {
        return NextResponse.json({ success: false, error: "未授權" }, { status: authResult.status ?? 401 });
    }

    const { searchParams } = new URL(request.url);
    // 優先讀取 tenantId，兼容舊版 tenantSlug
    const tenantSlug = searchParams.get("tenantId") || searchParams.get("tenantSlug") || env.NEXT_PUBLIC_TENANT_ID || "default";
    const db = getDb();

    const snap = await db.collection("portfolio_items")
        .where("tenantId", "==", tenantSlug)
        .where("categoryName", "==", RECYCLE_CATEGORY)
        .get();

    const now = Date.now();
    const items: Record<string, unknown>[] = [];
    const expiredIds: string[] = [];

    snap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const deletedAt = data.deletedAt ? new Date(data.deletedAt as string).getTime() : 0;
        if (deletedAt && (now - deletedAt) > THIRTY_DAYS_MS) {
            expiredIds.push(docSnap.id);
        } else {
            const daysLeft = deletedAt
                ? Math.max(0, 30 - Math.floor((now - deletedAt) / (1000 * 60 * 60 * 24)))
                : 30;
            items.push({ id: docSnap.id, ...data, daysLeft });
        }
    });

    // 背景自動清除過期照片（不阻塞回應）
    if (expiredIds.length > 0) {
        (async () => {
            for (const id of expiredIds) {
                try {
                    const ref = db.collection("portfolio_items").doc(id);
                    const docSnap = await ref.get();
                    if (docSnap.exists) {
                        const d = docSnap.data()!;
                        if (d.imageUrl) {
                            try { await deleteFromR2(d.imageUrl as string); } catch { }
                        }
                        await ref.delete();
                    }
                } catch (e) {
                    console.error(`[recycle] 自動清除過期項目失敗 (id=${id}):`, e);
                }
            }
            console.log(`[recycle] ✅ 自動清除 ${expiredIds.length} 張超過 30 天的回收照片`);
        })();
    }

    return NextResponse.json({ success: true, items, autoCleared: expiredIds.length });
}
