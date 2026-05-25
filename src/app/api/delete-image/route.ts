import { NextRequest, NextResponse } from "next/server";
import { r2Client } from "@/lib/r2";
import { env } from "@/lib/env";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { verifyAdminAuth } from "@/lib/auth-middleware";

export async function POST(request: NextRequest) {
    // 🔒 Clerk 驗證身份
    const authResult = await verifyAdminAuth();
    if (!authResult.success) {
        return NextResponse.json(
            { error: authResult.error },
            { status: authResult.status }
        );
    }

    if (!env.R2_BUCKET_NAME) {
        return NextResponse.json(
            { success: false, error: "R2_BUCKET_NAME not configured" },
            { status: 500 }
        );
    }

    try {
        const body = await request.json();
        const { imageUrl } = body;

        if (!imageUrl) {
            return NextResponse.json({ error: "No imageUrl provided" }, { status: 400 });
        }

        // 從 URL 解析 Key，並限制店長只能刪除自己租戶目錄下的檔案
        let key = imageUrl;
        if (imageUrl.startsWith("http")) {
            try {
                const url = new URL(imageUrl);
                const publicDomain = env.R2_PUBLIC_DOMAIN ? new URL(env.R2_PUBLIC_DOMAIN) : null;
                if (!publicDomain || url.hostname !== publicDomain.hostname) {
                    return NextResponse.json(
                        { success: false, error: "不允許刪除非本系統網域的檔案" },
                        { status: 400 }
                    );
                }
                // 移除開頭的斜線
                key = url.pathname.substring(1);
            } catch (e) {
                console.error("Invalid URL format:", imageUrl);
                return NextResponse.json(
                    { success: false, error: "Invalid imageUrl format" },
                    { status: 400 }
                );
            }
        }

        if (authResult.role !== "system_admin") {
            if (!authResult.tenantId || !key.startsWith(`uploads/${authResult.tenantId}/`)) {
                return NextResponse.json(
                    { success: false, error: "未授權刪除此檔案" },
                    { status: 403 }
                );
            }
        }

        console.log(`[Delete Image API] Deleting from R2: ${key}`);

        const command = new DeleteObjectCommand({
            Bucket: env.R2_BUCKET_NAME,
            Key: key,
        });

        await r2Client.send(command);

        console.log("[Delete Image API] Success");

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("[API] Delete Image Error:", error);
        return NextResponse.json({
            success: false,
            error: "刪除圖片失敗",
            details: error.message,
        }, { status: 500 });
    }
}
