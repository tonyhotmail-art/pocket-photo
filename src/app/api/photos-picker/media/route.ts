import { NextRequest, NextResponse } from "next/server";

/**
 * Google Photos Picker API - Media Items Retrieval
 * 
 * 取得使用者選擇的照片清單，並下載照片資料
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get("sessionId");
        const accessToken = searchParams.get("accessToken");

        if (!sessionId || !accessToken) {
            return NextResponse.json(
                { success: false, error: "缺少 sessionId 或 accessToken" },
                { status: 400 }
            );
        }

        // 呼叫 Google Photos Picker API 取得選中的照片清單
        const response = await fetch(
            `https://photospicker.googleapis.com/v1/sessions/${sessionId}/mediaItems`,
            {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                },
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            console.error("[Photos Picker] Get media items failed:", errorData);
            return NextResponse.json(
                { success: false, error: "取得照片清單失敗", details: errorData },
                { status: response.status }
            );
        }

        const mediaData = await response.json();
        const mediaItems = mediaData.mediaItems || [];

        console.log(`[Photos Picker] Found ${mediaItems.length} media items`);

        // 下載每張照片並轉換為 base64
        const downloadedPhotos = await Promise.all(
            mediaItems.map(async (item: any) => {
                try {
                    // 使用 baseUrl 下載照片
                    const photoUrl = `${item.mediaItem.baseUrl}=d`; // =d 參數表示下載原圖
                    const photoResponse = await fetch(photoUrl);

                    if (!photoResponse.ok) {
                        console.error(`Failed to download photo: ${item.mediaItem.id}`);
                        return null;
                    }

                    const blob = await photoResponse.blob();
                    const arrayBuffer = await blob.arrayBuffer();
                    const base64 = Buffer.from(arrayBuffer).toString('base64');

                    return {
                        id: item.mediaItem.id,
                        filename: item.mediaItem.filename || `photo_${item.mediaItem.id}.jpg`,
                        mimeType: item.mediaItem.mimeType || 'image/jpeg',
                        base64Data: base64,
                    };
                } catch (error) {
                    console.error(`Error downloading photo ${item.mediaItem.id}:`, error);
                    return null;
                }
            })
        );

        // 過濾掉下載失敗的照片
        const successfulPhotos = downloadedPhotos.filter(photo => photo !== null);

        console.log(`[Photos Picker] Successfully downloaded ${successfulPhotos.length} photos`);

        return NextResponse.json({
            success: true,
            data: {
                photos: successfulPhotos,
                total: successfulPhotos.length,
            },
        });

    } catch (error: any) {
        console.error("[Photos Picker] Get media items error:", error);
        return NextResponse.json(
            { success: false, error: "伺服器錯誤", details: error.message },
            { status: 500 }
        );
    }
}
