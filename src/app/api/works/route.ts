import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/auth-middleware";
import { portfolioService } from "@/lib/services/portfolio.service";

export async function DELETE(request: NextRequest) {
    // 🔒 驗證身份
    const authResult = await verifyAdminAuth(request);
    if (!authResult.success) {
        return NextResponse.json(
            { success: false, error: authResult.error },
            { status: authResult.status }
        );
    }

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");
        const ids = searchParams.get("ids");


        if (!id && !ids) {
            return NextResponse.json({ success: false, error: "Missing id or ids" }, { status: 400 });
        }

        if (ids) {
            const idList = ids.split(",").filter(Boolean);
            console.log(`[Delete API] Batch deleting ${idList.length} items`);

            // Execute in parallel (or sequential if too many, but parallel is usually fine for <50)
            const results = await Promise.allSettled(idList.map(async (itemId) => {
                await portfolioService.deleteItem(itemId);
            }));

            // Check for failures
            const failed = results.filter(r => r.status === 'rejected');
            if (failed.length > 0) {
                console.error(`[Delete API] Some items failed to delete:`, failed);
            }

            return NextResponse.json({
                success: true,
                data: {
                    deletedCount: idList.length - failed.length,
                    failedCount: failed.length
                }
            });
        }

        if (id) {
            await portfolioService.deleteItem(id);
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });

    } catch (error: any) {
        console.error("[Delete API] Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    // 🔒 驗證身份
    const authResult = await verifyAdminAuth(request);
    if (!authResult.success) {
        return NextResponse.json(
            { success: false, error: authResult.error },
            { status: authResult.status }
        );
    }

    try {
        const body = await request.json();
        const { id, categoryName } = body;

        if (!id || !categoryName) {
            return NextResponse.json({
                success: false,
                error: "缺少 ID 或分類名稱"
            }, { status: 400 });
        }

        console.log(`[Update API] Updating work ${id} to category: ${categoryName}`);

        await portfolioService.updateItem(id, { categoryName });

        console.log(`[Update API] Work ${id} updated successfully.`);

        return NextResponse.json({
            success: true,
            data: { id, categoryName }
        });

    } catch (error: any) {
        console.error("[Update API] Error:", error);
        return NextResponse.json({
            success: false,
            error: "更新失敗",
            details: error.message
        }, { status: 500 });
    }
}
