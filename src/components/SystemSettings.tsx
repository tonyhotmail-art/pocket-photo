"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { accessConfig } from "@/lib/config";
import { Share2, Clock, Loader2, SlidersHorizontal } from "lucide-react";
import { clsx } from "clsx";
import { useParams } from "next/navigation";

// 系統設定的資料結構
export interface SystemSettingsData {
    tenantId: string;
    siteName?: string;
    lineUrl?: string;
    allowSharing: boolean;
    showTimeline: boolean;
    updatedAt?: any;
}

// 預設值
const DEFAULT_SETTINGS: Omit<SystemSettingsData, "tenantId"> = {
    siteName: "Pocket Photo",
    lineUrl: "",
    allowSharing: true,
    showTimeline: false,
};

// 暴露 hook，讓前台也能讀取設定
export function useSystemSettings() {
    const { slug } = useParams() as { slug: string };
    const [settings, setSettings] = useState<SystemSettingsData>({
        tenantId: slug,
        ...DEFAULT_SETTINGS,
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const tenantId = slug;
        const docRef = doc(db, "system_settings", tenantId);

        const unsubscribe = onSnapshot(docRef, (snap) => {
            if (snap.exists()) {
                setSettings({ ...DEFAULT_SETTINGS, ...snap.data(), tenantId } as SystemSettingsData);
            } else {
                // 文件不存在時使用預設值
                setSettings({ tenantId, ...DEFAULT_SETTINGS });
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    return { settings, loading };
}

// 後台控制 UI 組件
export default function SystemSettings() {
    const { slug } = useParams() as { slug: string };
    const { settings, loading } = useSystemSettings();
    const [saving, setSaving] = useState(false);
    const [localSiteName, setLocalSiteName] = useState("");
    const [localLineUrl, setLocalLineUrl] = useState("");

    // 當數據從後端同步時更新本地狀態
    useEffect(() => {
        if (settings.siteName) {
            setLocalSiteName(settings.siteName);
        }
        setLocalLineUrl(settings.lineUrl || "");
    }, [settings.siteName, settings.lineUrl]);

    const updateValue = async (key: keyof Omit<SystemSettingsData, "tenantId" | "updatedAt">, value: any) => {
        setSaving(true);
        try {
            const docRef = doc(db, "system_settings", slug);
            await setDoc(docRef, {
                ...settings,
                [key]: value,
                updatedAt: serverTimestamp(),
            }, { merge: true });
        } catch (error) {
            console.error("[SystemSettings] 儲存失敗:", error);
            alert("設定儲存失敗，請重試");
        } finally {
            setTimeout(() => setSaving(false), 300);
        }
    };

    const updateToggle = async (key: keyof Omit<SystemSettingsData, "tenantId" | "updatedAt">, value: boolean) => {
        await updateValue(key, value);
    };

    const controls = [
        {
            key: "allowSharing" as const,
            icon: Share2,
            label: "分享功能",
            description: "開啟時，訪客可看到分享按鈕，將作品集或單張照片的連結分享出去",
            value: settings.allowSharing,
        },
        {
            key: "showTimeline" as const,
            icon: Clock,
            label: "時間刻度",
            description: "開啟時，畫廊照片將依拍攝日期分組顯示，並在右側顯示年份導覽軸",
            value: settings.showTimeline,
        },
    ];

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* 標題列 */}
            <div className="p-6 border-b border-gray-50 flex items-center gap-3 bg-gray-50/30">
                <div className="p-2 bg-gray-900 text-white rounded-xl">
                    <SlidersHorizontal size={20} />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-gray-900">相本資訊與功能</h3>
                    <p className="text-xs text-gray-400 mt-0.5">自定義您的相本名稱與瀏覽體驗</p>
                </div>
            </div>

            {/* 本地資訊設定 */}
            <div className="px-6 py-6 border-b border-gray-50 bg-white">
                <div className="flex items-center justify-between mb-3">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest">相本名稱 / Album Name</label>
                    <span className={clsx(
                        "text-[10px] font-mono",
                        localSiteName.length >= 25 ? "text-red-500 font-bold" : "text-gray-300"
                    )}>
                        {localSiteName.length}/30
                    </span>
                </div>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={localSiteName}
                        maxLength={30}
                        onChange={(e) => setLocalSiteName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                const trimmed = localSiteName.trim().substring(0, 30);
                                if (trimmed !== settings.siteName) updateValue("siteName", trimmed);
                            }
                        }}
                        placeholder="請輸入相本名稱"
                        className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/5 focus:border-gray-900 transition-all font-serif"
                    />
                    <button
                        onClick={() => {
                            const trimmed = localSiteName.trim().substring(0, 30);
                            if (trimmed !== settings.siteName) updateValue("siteName", trimmed);
                        }}
                        disabled={saving || localSiteName.trim() === settings.siteName}
                        className={clsx(
                            "px-5 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap",
                            localSiteName.trim() !== settings.siteName
                                ? "bg-gray-900 text-white hover:bg-black active:scale-95 shadow-md"
                                : "bg-gray-100 text-gray-300 cursor-not-allowed"
                        )}
                    >
                        {saving ? "儲存中..." : "更新"}
                    </button>
                </div>
                <p className="mt-2 text-[10px] text-gray-400 leading-relaxed">
                    💡 建議控制在 15 字以內以獲得最佳側邊欄垂直排版效果。上限為 30 字。
                </p>
            </div>

            {/* LINE@ 帳號設定 */}
            <div className="px-6 py-6 border-b border-gray-50 bg-white">
                <div className="flex items-center justify-between mb-3">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest">LINE@ 帳號連結</label>
                </div>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={localLineUrl}
                        onChange={(e) => setLocalLineUrl(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                const trimmed = localLineUrl.trim();
                                if (trimmed !== (settings.lineUrl || "")) updateValue("lineUrl", trimmed);
                            }
                        }}
                        placeholder="例如：https://lin.ee/xxxxxxx"
                        className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/5 focus:border-gray-900 transition-all font-mono"
                    />
                    <button
                        onClick={() => {
                            const trimmed = localLineUrl.trim();
                            if (trimmed !== (settings.lineUrl || "")) updateValue("lineUrl", trimmed);
                        }}
                        disabled={saving || localLineUrl.trim() === (settings.lineUrl || "")}
                        className={clsx(
                            "px-5 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap",
                            localLineUrl.trim() !== (settings.lineUrl || "")
                                ? "bg-[#00B900] text-white hover:bg-[#009900] active:scale-95 shadow-md"
                                : "bg-gray-100 text-gray-300 cursor-not-allowed"
                        )}
                    >
                        {saving ? "儲存中..." : "更新"}
                    </button>
                </div>
                <p className="mt-2 text-[10px] text-gray-400 leading-relaxed">
                    💬 設定 LINE@ 連結後，前台會顯示綠色對話按鈕。留空則不顯示。
                </p>
            </div>

            {/* 控制項列表 */}
            <div className="divide-y divide-gray-50">
                {controls.map(({ key, icon: Icon, label, description, value }) => (
                    <div key={key} className="p-6 flex items-start justify-between gap-6">
                        <div className="flex items-start gap-4">
                            <div className={clsx(
                                "mt-0.5 p-2 rounded-xl transition-colors",
                                value ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-400"
                            )}>
                                <Icon size={18} />
                            </div>
                            <div>
                                <p className="font-bold text-gray-900 text-sm">{label}</p>
                                <p className="text-xs text-gray-400 mt-1 leading-relaxed max-w-xs">{description}</p>
                            </div>
                        </div>

                        {/* 開關按鈕 */}
                        <button
                            onClick={() => !saving && !loading && updateToggle(key, !value)}
                            disabled={saving || loading}
                            className={clsx(
                                "relative flex-shrink-0 w-14 h-7 rounded-full transition-all duration-300",
                                value ? "bg-gray-900" : "bg-gray-200",
                                (saving || loading) ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:opacity-90"
                            )}
                            title={value ? "點擊關閉" : "點擊開啟"}
                        >
                            <span className={clsx(
                                "absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-sm transition-all duration-300 flex items-center justify-center",
                                value ? "left-[30px]" : "left-0.5"
                            )}>
                                {saving && <Loader2 size={12} className="animate-spin text-gray-400" />}
                            </span>
                        </button>
                    </div>
                ))}
            </div>

            {/* 狀態提示 */}
            <div className="px-6 py-4 bg-gray-50/30 border-t border-gray-50">
                <p className="text-[10px] text-gray-400 text-center">
                    {saving ? "正在儲存設定..." : "設定即時同步至資料庫，無需手動儲存"}
                </p>
            </div>
        </div>
    );
}
