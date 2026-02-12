import { NextRequest, NextResponse } from "next/server";

/**
 * Google Photos Picker API - Session Creation
 * 
 * 建立一個新的 Photos Picker session，回傳 pickerUri 供前端重新導向使用
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { accessToken } = body;

        if (!accessToken) {
            return NextResponse.json(
                { success: false, error: "缺少 access token" },
                { status: 400 }
            );
        }

        // 呼叫 Google Photos Picker API 建立 session
        const response = await fetch("https://photospicker.googleapis.com/v1/sessions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                // 設定選擇器的選項
                mediaFilter: {
                    // 只允許選擇照片和影片
                    mediaTypes: ["PHOTO", "VIDEO"]
                }
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch {
                errorData = { message: errorText };
            }

            console.error("[Photos Picker] Session creation failed:");
            console.error("Status:", response.status);
            console.error("Error:", errorData);
            console.error("Access Token (first 20 chars):", accessToken.substring(0, 20));

            return NextResponse.json(
                { success: false, error: "建立 session 失敗", details: errorData },
                { status: response.status }
            );
        }

        const sessionData = await response.json();

        console.log("[Photos Picker] Session created:", sessionData.id);

        return NextResponse.json({
            success: true,
            data: {
                sessionId: sessionData.id,
                pickerUri: sessionData.pickerUri,
            },
        });

    } catch (error: any) {
        console.error("[Photos Picker] Session creation error:", error);
        return NextResponse.json(
            { success: false, error: "伺服器錯誤", details: error.message },
            { status: 500 }
        );
    }
}
