"use client";

import { useState, useRef } from "react";
import { Camera, Loader2 } from "lucide-react";
import { useParams } from "next/navigation";
import { compressImage } from "@/lib/image-compression";
import { calculateImageHash } from "@/lib/hash";
import { authenticatedFetch } from "@/lib/api-client";
import exifr from "exifr";
import { clsx } from "clsx";

interface CameraUploadButtonProps {
    tenantId: string;
    className?: string;
    iconProps?: {
        size?: number;
        strokeWidth?: number;
    }
}

export default function CameraUploadButton({ tenantId, className, iconProps }: CameraUploadButtonProps) {
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            // 1. 計算 Hash
            const contentHash = await calculateImageHash(file);

            // 2. 獲取 EXIF 時間
            let photoDate: string | undefined;
            try {
                const exifData = await exifr.parse(file, { pick: ["DateTimeOriginal", "DateTime"] });
                const dateValue = exifData?.DateTimeOriginal || exifData?.DateTime;
                if (dateValue instanceof Date) {
                    photoDate = dateValue.toISOString();
                } else if (dateValue) {
                    photoDate = new Date(dateValue).toISOString();
                }
            } catch {
                // Ignore EXIF errors
            }

            // 3. 壓縮圖片
            const compressed = await compressImage(file, { maxWidthOrHeight: 1280 });

            // 4. 準備上傳
            const formData = new FormData();
            formData.append("file", compressed);
            formData.append("title", "");
            formData.append("description", "");
            formData.append("categoryName", "待分類照片"); // 獨立上傳皆預設進入待分類
            formData.append("categoryOrder", "0");
            formData.append("tags", JSON.stringify([]));
            formData.append("contentHash", contentHash);
            if (photoDate) {
                formData.append("photoDate", photoDate);
            }
            formData.append("tenantId", tenantId);

            // 5. 呼叫上傳 API
            const uploadRes = await authenticatedFetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            const result = await uploadRes.json();

            if (!result.success) {
                throw new Error(result.error || "上傳失敗");
            }

            // 6. 成功後觸發畫面重新整理
            window.dispatchEvent(new CustomEvent("portfolio-updated"));
            alert("照片上傳成功！");

        } catch (error) {
            console.error("Camera upload error:", error);
            alert(`拍照上傳失敗: ${error instanceof Error ? error.message : "未知錯誤"}`);
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    return (
        <>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
            />
            <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className={clsx(
                    "shadow-xl rounded-[20px] hover:scale-110 transition-all flex items-center justify-center border",
                    className || "w-11 h-11 bg-white text-[#1A1A1A] border-gray-200"
                )}
                title="拍照上傳"
            >
                {uploading ? (
                    <Loader2 className="animate-spin" size={iconProps?.size || 20} strokeWidth={iconProps?.strokeWidth || 2} />
                ) : (
                    <Camera size={iconProps?.size || 20} strokeWidth={iconProps?.strokeWidth || 1.5} />
                )}
            </button>
        </>
    );
}
