"use client";

import { useState } from "react";
import { clientEnv } from "@/lib/env";

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

            const accessToken = await getAccessToken();

            if (!accessToken) {
                throw new Error("無法取得 Google 授權");
            }

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

            localStorage.setItem("photosPickerSessionId", sessionId);
            localStorage.setItem("photosPickerAccessToken", accessToken);
            localStorage.setItem("photosPickerPending", "true");

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

async function getAccessToken(): Promise<string | null> {
    return new Promise((resolve) => {
        if (!window.google || !window.google.accounts) {
            console.error("Google Identity Services not loaded");
            resolve(null);
            return;
        }

        const client = window.google.accounts.oauth2.initTokenClient({
            client_id: clientEnv.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
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

export async function checkPendingPhotosPickerSession(
    onPhotosSelected: (files: File[]) => void
) {
    const pending = localStorage.getItem("photosPickerPending");
    if (pending !== "true") return;

    const sessionId = localStorage.getItem("photosPickerSessionId");
    const accessToken = localStorage.getItem("photosPickerAccessToken");

    if (!sessionId || !accessToken) {
        localStorage.removeItem("photosPickerPending");
        return;
    }

    try {
        const pollInterval = setInterval(async () => {
            try {
                const pollResponse = await fetch(
                    `/api/photos-picker/poll?sessionId=${sessionId}&accessToken=${accessToken}`
                );

                if (pollResponse.ok) {
                    const pollData = await pollResponse.json();
                    if (pollData.data.mediaItemsSet) {
                        clearInterval(pollInterval);
                        const mediaResponse = await fetch(
                            `/api/photos-picker/media?sessionId=${sessionId}&accessToken=${accessToken}`
                        );
                        if (mediaResponse.ok) {
                            const mediaData = await mediaResponse.json();
                            const photos = mediaData.data.photos;
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
                            localStorage.removeItem("photosPickerPending");
                            onPhotosSelected(files);
                        }
                    }
                }
            } catch (err) {
                clearInterval(pollInterval);
            }
        }, 2000);
        setTimeout(() => clearInterval(pollInterval), 30000);
    } catch (err) {
        localStorage.removeItem("photosPickerPending");
    }
}
