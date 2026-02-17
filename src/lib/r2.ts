import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { env } from "./env";
import { v4 as uuidv4 } from "uuid";

export const r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
});



/**
 * 上傳檔案至 Cloudflare R2
 * @param fileBuffer - 檔案 Buffer
 * @param contentType - 檔案類型 (MIME type)
 * @param tenantId - 租戶 ID (用於目錄隔離)
 * @param originalName - 原始檔名 (用於生成安全檔名)
 * @returns 公開存取 URL
 */
export async function uploadToR2(
    fileBuffer: Buffer,
    contentType: string,
    tenantId: string,
    originalName: string
): Promise<string> {
    const safeName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
    // Rule 6: 路徑格式 uploads/${tenantId}/${Date.now()}_${uuidv4()}.webp
    // 注意: 副檔名應根據實際 contentType 決定，但若已強制轉 WebP，則統一為 .webp
    const extension = contentType === "image/webp" ? ".webp" : safeName.substring(safeName.lastIndexOf('.'));
    const filename = `uploads/${tenantId}/${Date.now()}_${uuidv4()}${extension}`;

    const command = new PutObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: filename,
        Body: fileBuffer,
        ContentType: contentType,
    });

    await r2Client.send(command);

    if (env.R2_PUBLIC_DOMAIN) {
        return `${env.R2_PUBLIC_DOMAIN}/${filename}`;
    }
    // Fallback: 若無 Public Domain 設定，拋出錯誤或回傳 R2.dev 連結 (視需求)
    throw new Error("R2_PUBLIC_DOMAIN not configured");
}

/**
 * 從 Cloudflare R2 刪除檔案
 * @param fileUrl 檔案的完整 URL
 */
export async function deleteFromR2(fileUrl: string): Promise<void> {
    if (!fileUrl) return;

    try {
        let fileKey = "";

        if (env.R2_PUBLIC_DOMAIN && fileUrl.startsWith(env.R2_PUBLIC_DOMAIN)) {
            // 從公開 URL 解析 Key
            fileKey = fileUrl.replace(`${env.R2_PUBLIC_DOMAIN}/`, '');
        } else if (fileUrl.startsWith("http")) {
            // 嘗試從其他 URL 格式解析 (例如 r2.dev)
            const urlObj = new URL(fileUrl);
            fileKey = urlObj.pathname.substring(1); // Remove leading /
        } else {
            // 假設傳入的是 key
            fileKey = fileUrl;
        }

        // Decode in case of special chars
        const decodedKey = decodeURIComponent(fileKey);

        console.log(`[R2] Deleting key: ${decodedKey}`);

        const command = new DeleteObjectCommand({
            Bucket: env.R2_BUCKET_NAME,
            Key: decodedKey,
        });

        await r2Client.send(command);
    } catch (error) {
        console.error("[R2] Delete error:", error);
        // 不拋出錯誤，避免阻擋主流程 (例如 DB 刪除)
    }
}
