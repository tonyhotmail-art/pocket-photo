"use client";

import { useEffect, useState } from "react";
import { clientEnv } from "@/lib/env";

interface GoogleDrivePickerProps {
    onSelect: (files: File[]) => void;
    children: React.ReactNode;
}

declare global {
    interface Window {
        gapi: any;
        google: any;
    }
}

export default function GoogleDrivePicker({ onSelect, children }: GoogleDrivePickerProps) {
    const [isApiLoaded, setIsApiLoaded] = useState(false);
    const [isAuthorized, setIsAuthorized] = useState(false);

    const GOOGLE_API_KEY = clientEnv.NEXT_PUBLIC_GOOGLE_API_KEY || "";
    const GOOGLE_CLIENT_ID = clientEnv.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
    const SCOPES = "https://www.googleapis.com/auth/drive.readonly";

    useEffect(() => {
        // 載入 Google API 腳本
        const loadGoogleApi = () => {
            const script1 = document.createElement("script");
            script1.src = "https://apis.google.com/js/api.js";
            script1.onload = () => {
                window.gapi.load("client:picker", initializeGapi);
            };
            document.body.appendChild(script1);

            const script2 = document.createElement("script");
            script2.src = "https://accounts.google.com/gsi/client";
            document.body.appendChild(script2);
        };

        const initializeGapi = async () => {
            await window.gapi.client.init({
                apiKey: GOOGLE_API_KEY,
                discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
            });
            setIsApiLoaded(true);
        };

        if (!window.gapi) {
            loadGoogleApi();
        } else {
            setIsApiLoaded(true);
        }
    }, [GOOGLE_API_KEY]);

    const handleAuthClick = () => {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: SCOPES,
            callback: (response: any) => {
                if (response.access_token) {
                    setIsAuthorized(true);
                    openPicker(response.access_token);
                }
            },
        });
        tokenClient.requestAccessToken();
    };

    const openPicker = (accessToken: string) => {
        // 計算視窗大小（設定為螢幕的 100% - 最大尺寸）
        const pickerWidth = Math.floor(window.innerWidth);
        const pickerHeight = Math.floor(window.innerHeight);

        const picker = new window.google.picker.PickerBuilder()
            .addView(
                new window.google.picker.DocsView(window.google.picker.ViewId.DOCS_IMAGES)
                    .setIncludeFolders(true)
                    .setMimeTypes("image/png,image/jpeg,image/jpg,image/webp")
            )
            .setOAuthToken(accessToken)
            .setDeveloperKey(GOOGLE_API_KEY)
            .setCallback(pickerCallback)
            .setTitle("選擇照片")
            .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)
            .setSize(pickerWidth, pickerHeight)
            .build();
        picker.setVisible(true);
    };

    const pickerCallback = async (data: any) => {
        console.log("Picker callback triggered:", data);

        if (data.action === window.google.picker.Action.PICKED) {
            console.log("Files selected:", data.docs);
            const files = data.docs;
            const downloadedFiles: File[] = [];

            try {
                for (const file of files) {
                    console.log(`開始下載: ${file.name} (ID: ${file.id})`);

                    try {
                        const response = await fetch(
                            `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
                            {
                                headers: {
                                    Authorization: `Bearer ${window.gapi.client.getToken().access_token}`,
                                },
                            }
                        );

                        if (!response.ok) {
                            throw new Error(`HTTP error! status: ${response.status}`);
                        }

                        const blob = await response.blob();
                        console.log(`下載完成: ${file.name}, 大小: ${blob.size} bytes`);

                        const downloadedFile = new File([blob], file.name, {
                            type: file.mimeType || blob.type,
                        });

                        downloadedFiles.push(downloadedFile);
                    } catch (error) {
                        console.error(`下載檔案 ${file.name} 失敗:`, error);
                        alert(`下載 ${file.name} 失敗,請重試`);
                    }
                }

                if (downloadedFiles.length > 0) {
                    onSelect(downloadedFiles);
                }
            } catch (error) {
                console.error("處理選擇的檔案時發生錯誤:", error);
                alert("處理檔案時發生錯誤,請重試");
            }
        }
    };

    const handleClick = () => {
        if (!isApiLoaded) {
            alert("Google API 尚未載入完成,請稍候再試");
            return;
        }
        handleAuthClick();
    };

    return (
        <div onClick={handleClick} style={{ cursor: "pointer" }}>
            {children}
        </div>
    );
}
