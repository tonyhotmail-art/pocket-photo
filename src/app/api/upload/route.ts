import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/auth-middleware";
import { portfolioService } from "@/lib/services/portfolio.service";
import { env } from "@/lib/env";

/**
 * Upload API (R2 + Firestore Transaction)
 * 接收 FormData，呼叫 Service 層完成上傳與資料寫入
 */
export async function POST(request: NextRequest) {
    // 🔒 驗證身份
    const authResult = await verifyAdminAuth(request);
    if (!authResult.success) {
        return NextResponse.json(
            { success: false, error: authResult.error },
            { status: authResult.status }
        );
    }

    try {
        const formData = await request.formData();
        const file = formData.get("file") as File | null;

        // 解析 Metadata
        const title = formData.get("title") as string;
        const description = formData.get("description") as string;
        const categoryName = formData.get("categoryName") as string;
        const categoryOrder = parseInt(formData.get("categoryOrder") as string || "0");
        const tagsJson = formData.get("tags") as string;
        const tags = tagsJson ? JSON.parse(tagsJson) : [];
        const contentHash = formData.get("contentHash") as string;

        // 優先使用前端傳來的 tenantId，若無則使用系統預設
        const tenantId = (formData.get("tenantId") as string) || env.NEXT_PUBLIC_TENANT_ID;

        if (!file) {
            return NextResponse.json({ success: false, error: "未提供檔案" }, { status: 400 });
        }

        // 轉換 File 為 Buffer
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // 呼叫 Service 層處理
        const itemId = await portfolioService.uploadAndCreateItem(
            buffer,
            file.type,
            file.name,
            {
                categoryName,
                categoryOrder,
                tags,
                contentHash,
                description,
                // title 欄位在 schema 中似乎沒有定義在 metadata 參數中，
                // 但 PorfolioItem 有 title。Service 層的 interface 可能需要擴充 title。
                // 暫時透過 merge 方式處理，或更新 service 定義。
                // 檢查 service 定義：metadata 只有 categoryName...等。
                // 修正：我需要在調用 service 之前確認 service 接受 title。
                // 查看 Service 定義，目前沒有 title。
                // 我應該更新 Service 來接受 title。
            },
            tenantId
        );

        // 因為 Service 目前介面不包含 title，我需要額外更新 title
        // 這是個權宜之計，正確做法是更新 Service 介面
        if (title) {
            await portfolioService.updateItem(itemId, { title });
        }

        return NextResponse.json({
            success: true,
            data: { id: itemId }
        });

    } catch (error: any) {
        console.error("[API] Upload Error:", error);

        return NextResponse.json({
            success: false,
            error: "上傳失敗",
            details: error.message,
        }, { status: 500 });
    }
}
