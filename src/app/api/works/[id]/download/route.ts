import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/auth-middleware";
import { portfolioRepo } from "@/lib/repositories/portfolio.repo";
import { getFromR2, getR2KeyFromUrl } from "@/lib/r2";
import sharp from "sharp";

export const runtime = "nodejs";

function safeDownloadName(title: string | undefined, imageUrl: string): string {
    const key = getR2KeyFromUrl(imageUrl);
    const originalName = key.split("/").pop() || "pocket-photo";
    const baseName = (title || originalName.replace(/\.[^.]+$/, "") || "pocket-photo")
        .replace(/[\\/:*?"<>|]/g, "_")
        .trim()
        .slice(0, 80);

    return `${baseName || "pocket-photo"}.jpg`;
}

function asciiFallbackName(filename: string): string {
    return filename
        .replace(/[^\x20-\x7E]/g, "_")
        .replace(/[\\/:*?"<>|]/g, "_")
        .slice(0, 100) || "pocket-photo";
}

function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
    const copy = new Uint8Array(buffer.byteLength);
    copy.set(buffer);
    return copy.buffer;
}

async function streamToArrayBuffer(stream: unknown): Promise<ArrayBuffer> {
    if (!stream || typeof (stream as { transformToByteArray?: unknown }).transformToByteArray !== "function") {
        throw new Error("R2 object body is not readable");
    }

    const bytes = await (stream as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return copy.buffer;
}

export async function GET(
    _request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const authResult = await verifyAdminAuth();
    if (!authResult.success) {
        return NextResponse.json(
            { success: false, error: authResult.error },
            { status: authResult.status }
        );
    }

    try {
        const { id } = await context.params;
        if (!id) {
            return NextResponse.json({ success: false, error: "Missing work id" }, { status: 400 });
        }

        const item = await portfolioRepo.getItem(id);
        if (!item?.imageUrl) {
            return NextResponse.json({ success: false, error: "找不到照片" }, { status: 404 });
        }

        if (authResult.role === "store_admin" && (!authResult.tenantId || item.tenantId !== authResult.tenantId)) {
            return NextResponse.json({ success: false, error: "無權限下載此照片" }, { status: 403 });
        }

        const object = await getFromR2(item.imageUrl);
        const sourceBody = await streamToArrayBuffer(object.Body);
        const jpegBody = await sharp(Buffer.from(sourceBody))
            .rotate()
            .flatten({ background: "#ffffff" })
            .jpeg({ quality: 92, mozjpeg: true })
            .toBuffer();
        const filename = safeDownloadName(item.title, item.imageUrl);
        const fallbackFilename = asciiFallbackName(filename);
        const encodedFilename = encodeURIComponent(filename);

        return new NextResponse(bufferToArrayBuffer(jpegBody), {
            status: 200,
            headers: {
                "Content-Type": "image/jpeg",
                "Content-Length": String(jpegBody.byteLength),
                "Content-Disposition": `attachment; filename="${fallbackFilename}"; filename*=UTF-8''${encodedFilename}`,
                "Cache-Control": "private, no-store",
            },
        });
    } catch (error: any) {
        console.error("[Download API] Error:", error);
        return NextResponse.json(
            { success: false, error: "下載失敗" },
            { status: 500 }
        );
    }
}
