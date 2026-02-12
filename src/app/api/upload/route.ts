import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { r2Client, R2_BUCKET_NAME, R2_PUBLIC_DOMAIN } from "@/lib/r2";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { verifyAdminAuth } from "@/lib/auth-middleware";

/**
 * Upload API (R2 Supported)
 * 接收 FormData 中的 file，上傳至 Cloudflare R2，回傳公開 URL
 */
export async function POST(request: NextRequest) {
    // 🔒 驗證身份
    const authResult = await verifyAdminAuth(request);
    if (!authResult.success) {
        return NextResponse.json(
            { error: authResult.error },
            { status: authResult.status }
        );
    }

    try {
        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        const folder = formData.get("folder") as string || "uploads";

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        // 轉換 File 為 Buffer
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // 生成唯一檔名
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filename = `${folder}/${Date.now()}_${uuidv4()}_${safeName}`;

        console.log(`[Upload API] Uploading to R2: ${filename}`);

        // 上傳至 Cloudflare R2
        const command = new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: filename,
            Body: buffer,
            ContentType: file.type,
            // R2 不需要 ACL: 'public-read'，權限由 Bucket Policy 或 Public Access 決定
        });

        await r2Client.send(command);

        // 組合公開 URL
        let publicUrl = "";
        if (R2_PUBLIC_DOMAIN) {
            publicUrl = `${R2_PUBLIC_DOMAIN}/${filename}`;
        } else {
            // Fallback: 如果沒有設定 Public Domain，嘗試回傳一個 R2.dev 格式的 URL (但通常需要設定)
            throw new Error("R2_PUBLIC_DOMAIN not configured");
        }

        console.log("[Upload API] Success:", publicUrl);

        return NextResponse.json({
            success: true,
            data: { url: publicUrl }
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
