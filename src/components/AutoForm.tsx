"use client";

import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { portfolioItemSchema, type Category, type PortfolioItem } from "@/lib/schema";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, where, limit, getDocs } from "firebase/firestore";
import { accessConfig } from "@/lib/config";
import { compressImage } from "@/lib/image-compression";
import { calculateImageHash } from "@/lib/hash";
import { Loader2, UploadCloud, X, Tag, Cloud } from "lucide-react";
import { clsx } from "clsx";
import GoogleDrivePicker from "@/components/GoogleDrivePicker";
import GooglePhotosPicker, { checkPendingPhotosPickerSession } from "@/components/GooglePhotosPicker";
import { authenticatedFetch } from "@/lib/api-client";
import exifr from "exifr";
import { useParams } from "next/navigation";

interface AutoFormProps {
    tenantId: string;
}

export default function AutoForm({ tenantId }: AutoFormProps) {
    const [uploading, setUploading] = useState(false);
    const [previews, setPreviews] = useState<string[]>([]);
    const [dragActive, setDragActive] = useState(false);
    const [fileError, setFileError] = useState<string | null>(null);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [tagsInput, setTagsInput] = useState("");
    const [downloadProgress, setDownloadProgress] = useState<{ current: number; total: number } | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        reset,
        formState: { errors },
    } = useForm<PortfolioItem>({
        resolver: zodResolver(portfolioItemSchema),
        defaultValues: {
            tenantId: tenantId,
            tags: [],
            title: "",
            description: "",
            categoryOrder: 0,
            categoryName: "待分類照片",
            isPublic: true, // NOTE: 預設為公開，Service 層會根據分類自動覆寫
        }
    });

    const currentTags = watch("tags") || [];

    // 檢查是否有待處理的 Google Photos Picker session
    useEffect(() => {
        checkPendingPhotosPickerSession((files) => {
            console.log("[AutoForm] Received photos from Google Photos Picker:", files.length);
            handleGoogleDriveSelect(files);
        });
    }, []);

    useEffect(() => {
        const q = query(
            collection(db, "categories"),
            where("tenantId", "==", tenantId),
            orderBy("order", "asc")
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const cats = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Category[];
            setCategories(cats);
        });
        return () => unsubscribe();
    }, []);

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files) {
            processFiles(Array.from(e.dataTransfer.files));
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            processFiles(Array.from(e.target.files));
        }
    };

    const processFiles = async (files: File[]) => {
        setFileError(null);

        // 支援的圖片副檔名（用於處理 HEIC/HEIF 等 MIME type 不標準的舊格式）
        const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp', 'tiff', 'tif', 'avif'];
        const isImageFile = (f: File) => {
            if (f.type.startsWith('image/')) return true;
            const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
            return IMAGE_EXTS.includes(ext);
        };

        // 限制最多 100 張
        const validFiles = files.filter(isImageFile).slice(0, 100);

        if (validFiles.length === 0) {
            setFileError("請上傳有效的圖片檔案（支援 JPG、PNG、HEIC 等格式）");
            return;
        }

        if (files.length > 100) {
            setFileError("一次最多只能上傳 100 張圖片，已為您選取前 100 張");
        }

        try {
            const processed = [];
            const batchHashes = new Set<string>();
            const currentQueueHashes = new Set(selectedFiles.map(f => (f as any).contentHash).filter(Boolean));

            for (const file of validFiles) {
                // 1. 計算內容指紋 (Hash)
                const contentHash = await calculateImageHash(file);

                // 2. 檢查是否重複 (本地隊列 + 本次批次 + Firestore)
                let isDuplicate = false;

                if (batchHashes.has(contentHash) || currentQueueHashes.has(contentHash)) {
                    isDuplicate = true;
                } else {
                    const q = query(
                        collection(db, "portfolio_items"),
                        where("tenantId", "==", tenantId),
                        where("contentHash", "==", contentHash),
                        limit(1)
                    );
                    const snapshot = await getDocs(q);
                    isDuplicate = !snapshot.empty;
                }

                if (!isDuplicate) {
                    batchHashes.add(contentHash);
                    // 3. 嘗試讀取 EXIF 拍攝時間（在壓縮前讀取，因為壓縮後 EXIF 資訊可能遺失）
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
                        // 無 EXIF 資訊，忽略錯誤（使用上傳時間作為備用）
                    }
                    // 4. 壓縮圖片
                    const compressed = await compressImage(file, { maxWidthOrHeight: 1280 });
                    processed.push({
                        file: compressed,
                        originalFile: file,
                        preview: URL.createObjectURL(compressed),
                        contentHash,
                        photoDate,
                        isDuplicate: false
                    });
                } else {
                    processed.push({ isDuplicate: true });
                }
            }

            // 過濾掉重複的照片，並確保型別正確
            const uniqueFiles = processed.filter((p): p is { file: File, originalFile: File, preview: string, contentHash: string, photoDate: string | undefined, isDuplicate: false } => !p.isDuplicate);
            const duplicateCount = processed.length - uniqueFiles.length;

            if (duplicateCount > 0) {
                setFileError(`已自動略過 ${duplicateCount} 張重複的照片 (內容完全相同)`);
            }

            if (uniqueFiles.length === 0 && duplicateCount > 0) {
                return;
            }

            setSelectedFiles(prev => [...prev, ...uniqueFiles.map(p => {
                const f = p.file as any;
                f.contentHash = p.contentHash;
                f.photoDate = p.photoDate; // 儲存 EXIF 拍攝時間
                return f;
            })]);

            setPreviews((prev: string[]) => [...prev, ...uniqueFiles.map(p => p.preview)]);

            if (uniqueFiles.length > 0) {
                setValue("imageUrl", "https://uploading.com/placeholder");
            }

        } catch (error) {
            console.error("Processing error:", error);
            setFileError("圖片處理失敗");
        }
    };

    const handleGoogleDriveSelect = async (files: File[]) => {
        if (files.length === 0) return;

        // 顯示下載進度
        setDownloadProgress({ current: 0, total: files.length });

        try {
            const processed = await Promise.all(files.map(async file => {
                // 計算 Hash
                const contentHash = await calculateImageHash(file);

                // 檢查重複
                const q = query(
                    collection(db, "portfolio_items"),
                    where("tenantId", "==", tenantId),
                    where("contentHash", "==", contentHash),
                    limit(1)
                );
                const snapshot = await getDocs(q);
                const isDuplicate = !snapshot.empty;

                // 在壓縮前讀取 EXIF 拍攝時間
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
                    // 無 EXIF 資訊，忽略錯誤
                }
                const compressed = await compressImage(file, { maxWidthOrHeight: 1280 });
                return {
                    file: compressed,
                    preview: URL.createObjectURL(compressed),
                    contentHash,
                    photoDate,
                    isDuplicate
                };
            }));

            const uniqueFiles = processed.filter(p => !p.isDuplicate);
            const duplicateCount = processed.length - uniqueFiles.length;

            if (duplicateCount > 0) {
                setFileError(`已自動略過 ${duplicateCount} 張重複的雲端照片`);
            }

            if (uniqueFiles.length > 0) {
                setSelectedFiles(prev => [...prev, ...uniqueFiles.map(p => {
                    const f = p.file as any;
                    f.contentHash = p.contentHash;
                    f.photoDate = p.photoDate; // 儲存 EXIF 拍攝時間
                    return f;
                })]);
                setPreviews(prev => [...prev, ...uniqueFiles.map(p => p.preview)]);
                setValue("imageUrl", "https://uploading.com/placeholder");
            }

        } catch (error) {
            console.error("處理 Google Drive 照片失敗:", error);
            setFileError("處理照片失敗,請重試");
        } finally {
            // 清除進度顯示
            setTimeout(() => setDownloadProgress(null), 500);
        }
    };

    const addTag = () => {
        if (tagsInput.trim() && !currentTags.includes(tagsInput.trim())) {
            setValue("tags", [...currentTags, tagsInput.trim()]);
            setTagsInput("");
        }
    };

    const removeTag = (tagToRemove: string) => {
        setValue("tags", currentTags.filter(t => t !== tagToRemove));
    };

    const onSubmit = async (values: PortfolioItem) => {
        if (selectedFiles.length === 0) {
            setFileError("請選擇圖片");
            return;
        }

        setUploading(true);
        try {
            // 獲取目前分類的順序權重
            const categoryOrder = categories.find(c => c.name === values.categoryName)?.order ?? 0;
            const currentTenantId = tenantId;

            // 批次處理上傳
            for (const file of selectedFiles) {
                const formData = new FormData();
                formData.append("file", file);
                // 傳遞 Metadata
                formData.append("title", values.title || "");
                formData.append("description", values.description || "");
                formData.append("categoryName", values.categoryName);
                formData.append("categoryOrder", categoryOrder.toString());
                formData.append("tags", JSON.stringify(currentTags)); // 陣列需轉字串傳遞
                formData.append("contentHash", (file as any).contentHash || "");
                // 傳遞 EXIF 拍攝時間（若有的話）
                if ((file as any).photoDate) {
                    formData.append("photoDate", (file as any).photoDate);
                }
                formData.append("tenantId", currentTenantId); // 強制傳遞 tenantId

                const uploadRes = await authenticatedFetch("/api/upload", {
                    method: "POST",
                    body: formData,
                });

                const result = await uploadRes.json();

                if (!result.success) {
                    throw new Error(result.error || "上傳失敗");
                }

                // 成功後，不需要在前端寫入 Firestore，因為後端 Service 已處理
                // 但為了 UI 體驗，我們可以在這裡做樂觀更新，或者依賴 onSnapshot / portfolio-updated 事件
            }

            reset();
            setPreviews([]);
            setSelectedFiles([]);
            setTagsInput("");
            if (fileInputRef.current) fileInputRef.current.value = "";

            // 發送事件通知 WorkManager 刷新資料
            window.dispatchEvent(new CustomEvent("portfolio-updated"));

            alert(`成功上傳 ${selectedFiles.length} 件作品！`);
        } catch (error) {
            console.error("Upload error:", error);
            alert(`上傳失敗: ${error instanceof Error ? error.message : "未知錯誤"}`);
        } finally {
            setUploading(false);
        }
    };


    return (
        <div className="w-full mx-auto">
            <h2 className="text-xl md:text-2xl font-bold mb-6 text-gray-800">上傳作品</h2>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

                {/* 1. 上傳照片區域 (最上方) */}
                <div>
                    <label className="block text-lg font-bold text-gray-800 mb-3">📸 上傳照片</label>
                    <div
                        className={clsx(
                            "relative border-3 border-dashed rounded-2xl p-10 transition-all text-center cursor-pointer min-h-[280px] flex flex-col justify-center",
                            dragActive
                                ? "border-blue-500 bg-blue-50 scale-[1.02] shadow-lg"
                                : "border-gray-300 hover:border-gray-400 hover:bg-gray-50",
                            errors.imageUrl || fileError ? "border-red-300 bg-red-50" : ""
                        )}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleFileChange}
                            className="hidden"
                        />

                        {previews.length > 0 ? (
                            <div className="grid grid-cols-3 xs:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                                {previews.map((url, i) => (
                                    <div
                                        key={i}
                                        className="relative aspect-square client-uploaded-image group animate-in fade-in zoom-in duration-300"
                                        style={{ animationDelay: `${i * 50}ms` }}
                                    >
                                        <img
                                            src={url}
                                            alt={`預覽 ${i + 1}`}
                                            className="w-full h-full object-cover rounded-lg shadow-md border-2 border-gray-200 group-hover:border-blue-400 transition-all group-hover:scale-105"
                                        />
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const newPreviews = [...previews];
                                                const newFiles = [...selectedFiles];
                                                newPreviews.splice(i, 1);
                                                newFiles.splice(i, 1);
                                                setPreviews(newPreviews);
                                                setSelectedFiles(newFiles);
                                                if (newFiles.length === 0) setValue("imageUrl", "");
                                            }}
                                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 shadow-lg hover:bg-red-600 transition-all hover:scale-110 z-10"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                        <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                                            {i + 1}
                                        </div>
                                    </div>
                                ))}
                                <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg aspect-square text-gray-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50/50 transition-all cursor-pointer group">
                                    <UploadCloud size={28} className="group-hover:scale-110 transition-transform" />
                                    <span className="text-[11px] mt-2 font-semibold">繼續新增</span>
                                    <span className="text-[9px] text-gray-400">{selectedFiles.length}/100</span>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-5 py-8">
                                <div className={clsx(
                                    "w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-50 rounded-full flex items-center justify-center mx-auto transition-all",
                                    dragActive ? "scale-110 from-blue-200 to-blue-100" : ""
                                )}>
                                    <UploadCloud size={40} className={clsx(
                                        "transition-colors",
                                        dragActive ? "text-blue-600" : "text-blue-400"
                                    )} />
                                </div>
                                <div>
                                    <p className="text-xl font-bold text-gray-800 mb-2">
                                        {dragActive ? "🎯 放開以上傳" : "點擊或拖曳照片到這裡"}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                        支援 JPG、PNG、WEBP 格式
                                    </p>
                                    <p className="text-xs text-gray-400 mt-1">
                                        最多一次上傳 <span className="font-bold text-blue-600">100 張</span>照片
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                    {fileError && (
                        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                            <span className="text-red-500 text-lg">⚠️</span>
                            <p className="text-red-600 text-sm font-medium flex-1">{fileError}</p>
                        </div>
                    )}

                    {/* Cloud Picker Buttons */}
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Google Drive Picker */}
                        <GoogleDrivePicker onSelect={handleGoogleDriveSelect}>
                            <button
                                type="button"
                                className="w-full py-4 border-2 border-dashed border-blue-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all flex items-center justify-center gap-3 text-sm text-gray-700 hover:text-blue-600 font-semibold group"
                            >
                                <Cloud size={20} className="group-hover:scale-110 transition-transform" />
                                <span>Google 雲端硬碟</span>
                            </button>
                        </GoogleDrivePicker>

                        {/* Google Photos Picker - 暫時隱藏，等待 API 問題解決 */}
                        {/* <GooglePhotosPicker onSelect={handleGoogleDriveSelect}>
                            <button
                                type="button"
                                className="w-full py-4 border-2 border-dashed border-green-200 rounded-xl hover:border-green-400 hover:bg-green-50 transition-all flex items-center justify-center gap-3 text-sm text-gray-700 hover:text-green-600 font-semibold group"
                            >
                                <span className="text-xl group-hover:scale-110 transition-transform">📸</span>
                                <span>Google 相簿</span>
                            </button>
                        </GooglePhotosPicker> */}
                    </div>

                    {/* Download Progress Indicator */}
                    {downloadProgress && (
                        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                                    <Loader2 size={16} className="animate-spin" />
                                    正在處理照片...
                                </span>
                                <span className="text-sm font-mono text-blue-600">
                                    {downloadProgress.total} 張
                                </span>
                            </div>
                            <div className="w-full bg-blue-200 rounded-full h-2.5 overflow-hidden shadow-inner">
                                <div
                                    className="bg-gradient-to-r from-blue-500 to-blue-600 h-full transition-all duration-500 ease-out rounded-full"
                                    style={{ width: '100%' }}
                                />
                            </div>
                            <p className="text-xs text-blue-600 mt-2 text-center">
                                正在壓縮並產生預覽...
                            </p>
                        </div>
                    )}
                </div>

                {/* 2. 作品名稱 */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">作品名稱 (選填)</label>
                    <input
                        {...register("title")}
                        className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-gray-800 outline-none transition text-sm bg-gray-50/30"
                        placeholder="輸入作品標題..."
                    />
                </div>

                {/* 3. 說明 */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">造型說明 (選填)</label>
                    <textarea
                        {...register("description")}
                        rows={3}
                        className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-gray-800 outline-none transition text-sm resize-none bg-gray-50/30"
                        placeholder="描述使用的技術或風格..."
                    />
                </div>

                {/* 4. 分類 */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5 text-left">作品分類</label>
                    <div className="flex gap-2">
                        <select
                            {...register("categoryName")}
                            className="flex-1 px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-gray-800 outline-none transition bg-white text-sm"
                        >
                            <option value="">請選擇分類...</option>
                            {categories.map((cat) => (
                                <option key={cat.id} value={cat.name}>{cat.name}</option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={async () => {
                                const newName = prompt("請輸入新分類名稱：");
                                if (newName && newName.trim()) {
                                    try {
                                        const q = collection(db, "categories");
                                        await addDoc(q, {
                                            name: newName.trim(),
                                            order: categories.length,
                                            tenantId: tenantId,
                                            createdAt: serverTimestamp()
                                        });
                                        setValue("categoryName", newName.trim());
                                    } catch (err) {
                                        console.error("Add category error:", err);
                                        alert("新增分類失敗");
                                    }
                                }
                            }}
                            className="px-3 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-gray-600 font-bold"
                            title="快速新增分類"
                        >
                            +
                        </button>
                    </div>
                    {errors.categoryName && <p className="text-red-500 text-[11px] mt-1 ml-1 font-medium">{errors.categoryName.message}</p>}
                </div>

                {/* 5. 標籤 */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">風格標籤 (選填)</label>
                    <div className="flex gap-2 mb-3">
                        <input
                            value={tagsInput}
                            onChange={(e) => setTagsInput(e.target.value)}
                            onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                            className="flex-1 px-4 py-2 border rounded-lg text-sm outline-none focus:border-gray-800 bg-gray-50/30"
                            placeholder="如：韓系、清新..."
                        />
                        <button
                            type="button"
                            onClick={addTag}
                            className="px-5 py-2 bg-gray-100 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                        >
                            新增
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2.5 min-h-[32px]">
                        {currentTags.map(tag => (
                            <span key={tag} className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-50 border border-gray-100 rounded-full text-[11px] text-gray-600 uppercase tracking-widest font-medium">
                                <Tag size={12} className="text-gray-400" />
                                {tag}
                                <X size={12} className="ml-1 cursor-pointer text-gray-400 hover:text-red-500 transition-colors" onClick={() => removeTag(tag)} />
                            </span>
                        ))}
                    </div>
                </div>

                {/* 6. 上傳按鈕 */}
                <button
                    type="submit"
                    disabled={uploading}
                    className="w-full bg-[#1A1A1A] hover:bg-gray-800 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-gray-200 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:shadow-none active:scale-[0.98]"
                >
                    {uploading ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            正在處理上傳作品...
                        </>
                    ) : (
                        `確認上傳新作 (${selectedFiles.length})`
                    )}
                </button>
            </form>
        </div>
    );
}

