"use client";

import { useState } from "react";

interface GooglePhotosPickerProps {
    onSelect: (files: File[]) => void;
    children: React.ReactNode;
}

export default function GooglePhotosPicker({ onSelect, children }: GooglePhotosPickerProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleClick = async () => {
        try {
            setLoading(true);
            setError(null);

            // Step 1: 取得 Google OAuth access token
            const accessToken = await getAccessToken();

            if (!accessToken) {
                throw new Error("無法取得 Google 授權");
            }

            // Step 2: 建立 Photos Picker session
            const sessionResponse = await fetch("/api/photos-picker/session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ accessToken }),
            });

            if (!sessionResponse.ok) {
                throw new Error("建立 session 失敗");
            }

            const sessionData = await sessionResponse.json();
            const { sessionId, pickerUri } = sessionData.data;

            // 儲存 sessionId 和 accessToken 到 localStorage，以便回來後使用
            localStorage.setItem("photosPickerSessionId", sessionId);
            localStorage.setItem("photosPickerAccessToken", accessToken);
            localStorage.setItem("photosPickerPending", "true");

            // Step 3: 重新導向到 Google Photos Picker (加上 /autoclose 自動關閉視窗)
            window.location.href = `${pickerUri}/autoclose`;

        } catch (err: any) {
            console.error("[GooglePhotosPicker] Error:", err);
            setError(err.message || "發生錯誤");
            setLoading(false);
        }
    };

    return (
        <div onClick={handleClick} style={{ position: "relative" }}>
            {children}
            {loading && (
                <div style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: "rgba(255,255,255,0.8)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "8px",
                }}>
                    <span>載入中...</span>
                </div>
            )}
            {error && (
                <div style={{ color: "red", fontSize: "12px", marginTop: "4px" }}>
                    {error}
                </div>
            )}
        </div>
    );
}

/**
 * 取得 Google OAuth 2.0 access token
 * 使用 Google Identity Services (GIS) 進行授權
 */
async function getAccessToken(): Promise<string | null> {
    return new Promise((resolve) => {
        // 確保 Google Identity Services 已載入
        if (!window.google || !window.google.accounts) {
            console.error("Google Identity Services not loaded");
            resolve(null);
            return;
        }

        const client = window.google.accounts.oauth2.initTokenClient({
            client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
            scope: "https://www.googleapis.com/auth/photospicker.mediaitems.readonly",
            callback: (response: any) => {
                if (response.access_token) {
                    resolve(response.access_token);
                } else {
                    resolve(null);
                }
            },
        });

        client.requestAccessToken();
    });
}

/**
 * 檢查是否有待處理的 Photos Picker session
 * 在頁面載入時呼叫，處理從 Google Photos 回來的情況
 */
export async function checkPendingPhotosPickerSession(
    onPhotosSelected: (files: File[]) => void
) {
    const pending = localStorage.getItem("photosPickerPending");

    if (pending !== "true") {
        return; // 沒有待處理的 session
    }

    const sessionId = localStorage.getItem("photosPickerSessionId");
    const accessToken = localStorage.getItem("photosPickerAccessToken");

    if (!sessionId || !accessToken) {
        console.error("Missing sessionId or accessToken");
        localStorage.removeItem("photosPickerPending");
        return;
    }

    console.log("[GooglePhotosPicker] Checking pending session:", sessionId);

    try {
        // 開始輪詢 session 狀態
        const pollInterval = setInterval(async () => {
            try {
                const pollResponse = await fetch(
                    `/api/photos-picker/poll?sessionId=${sessionId}&accessToken=${accessToken}`
                );

                if (!pollResponse.ok) {
                    throw new Error("輪詢失敗");
                }

                const pollData = await pollResponse.json();

                if (pollData.data.mediaItemsSet) {
                    // 使用者已完成選擇
                    clearInterval(pollInterval);
                    console.log("[GooglePhotosPicker] Media items selected!");

                    // 取得選中的照片
                    const mediaResponse = await fetch(
                        `/api/photos-picker/media?sessionId=${sessionId}&accessToken=${accessToken}`
                    );

                    if (!mediaResponse.ok) {
                        throw new Error("取得照片失敗");
                    }

                    const mediaData = await mediaResponse.json();
                    const photos = mediaData.data.photos;

                    console.log(`[GooglePhotosPicker] Got ${photos.length} photos`);

                    // 將 base64 資料轉換為 File 物件
                    const files = photos.map((photo: any) => {
                        const byteCharacters = atob(photo.base64Data);
                        const byteNumbers = new Array(byteCharacters.length);
                        for (let i = 0; i < byteCharacters.length; i++) {
                            byteNumbers[i] = byteCharacters.charCodeAt(i);
                        }
                        const byteArray = new Uint8Array(byteNumbers);
                        const blob = new Blob([byteArray], { type: photo.mimeType });
                        return new File([blob], photo.filename, { type: photo.mimeType });
                    });

                    // 清除 localStorage
                    localStorage.removeItem("photosPickerPending");
                    localStorage.removeItem("photosPickerSessionId");
                    localStorage.removeItem("photosPickerAccessToken");

                    // 回傳照片給父組件
                    onPhotosSelected(files);
                }
            } catch (err) {
                console.error("[GooglePhotosPicker] Poll error:", err);
                clearInterval(pollInterval);
                localStorage.removeItem("photosPickerPending");
            }
        }, 2000); // 每 2 秒輪詢一次

        // 設定 timeout (30 秒後停止輪詢)
        setTimeout(() => {
            clearInterval(pollInterval);
            localStorage.removeItem("photosPickerPending");
            console.log("[GooglePhotosPicker] Polling timeout");
        }, 30000);

    } catch (err) {
        console.error("[GooglePhotosPicker] Error:", err);
        localStorage.removeItem("photosPickerPending");
    }
}
