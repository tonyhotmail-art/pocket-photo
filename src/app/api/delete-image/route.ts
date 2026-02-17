import { NextRequest, NextResponse } from "next/server";
import { r2Client, deleteFromR2 } from "@/lib/r2";
import { env } from "@/lib/env";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { verifyAdminAuth } from "@/lib/auth-middleware";

export async function POST(request: NextRequest) {
    // 🔒 驗證身份
    const authResult = await verifyAdminAuth(request);
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

        // 從 URL 解析 Key
        // 假設 URL 格式為 https://R2_PUBLIC_DOMAIN/folder/filename
        let key = imageUrl;
        if (imageUrl.startsWith("http")) {
            try {
                const url = new URL(imageUrl);
                // 移除開頭的斜線
                key = url.pathname.substring(1);
            } catch (e) {
                console.error("Invalid URL format:", imageUrl);
                // 如果解析失敗，嘗試直接使用傳入的字串，或視為錯誤
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
