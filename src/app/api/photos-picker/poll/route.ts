import { NextRequest, NextResponse } from "next/server";

/**
 * Google Photos Picker API - Session Polling
 * 
 * 輪詢 session 狀態，檢查使用者是否已完成照片選擇
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

        // 呼叫 Google Photos Picker API 取得 session 狀態
        const response = await fetch(
            `https://photospicker.googleapis.com/v1/sessions/${sessionId}`,
            {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                },
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            console.error("[Photos Picker] Poll failed:", errorData);
            return NextResponse.json(
                { success: false, error: "輪詢失敗", details: errorData },
                { status: response.status }
            );
        }

        const sessionData = await response.json();

        return NextResponse.json({
            success: true,
            data: {
                mediaItemsSet: sessionData.mediaItemsSet || false,
                pickerUri: sessionData.pickerUri,
            },
        });

    } catch (error: any) {
        console.error("[Photos Picker] Poll error:", error);
        return NextResponse.json(
            { success: false, error: "伺服器錯誤", details: error.message },
            { status: 500 }
        );
    }
}
