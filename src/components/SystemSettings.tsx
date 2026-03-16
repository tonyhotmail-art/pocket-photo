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
export function useSystemSettings(propTenantId?: string | null) {
    const { slug } = useParams() as { slug: string };
    const tenantId = propTenantId || slug;
    
    const [settings, setSettings] = useState<SystemSettingsData>({
        tenantId: tenantId,
        ...DEFAULT_SETTINGS,
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!tenantId) return;
        const docRef = doc(db, "system_settings", tenantId);

        const unsubscribe = onSnapshot(docRef, (snap) => {
            if (snap.exists()) {
                setSettings({ ...DEFAULT_SETTINGS, ...snap.data(), tenantId } as SystemSettingsData);
            } else {
                setSettings({ tenantId, ...DEFAULT_SETTINGS });
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [tenantId]);

    return { settings, loading };
}

// 後台控制 UI 組件
export default function SystemSettings({ tenantId }: { tenantId: string }) {
    const { settings, loading } = useSystemSettings(tenantId);
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
            const docRef = doc(db, "system_settings", tenantId);
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
        },
        {
            key: "showTimeline" as const,
            icon: Clock,
            label: "時間軸顯示",
            description: "開啟後，在前台會依據拍攝日期自動加上年份與月份的標籤區隔",
        }
    ];

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-gray-200" /></div>;

    return (
        <div className="bg-white p-4 md:p-8 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-2 bg-gray-900 rounded-lg text-white">
                    <SlidersHorizontal size={20} />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-gray-900">網站展示設定</h2>
                    <p className="text-xs text-gray-400 mt-0.5">自訂您的專屬相館展示細節</p>
                </div>
            </div>

            <div className="space-y-10">
                {/* 網站名稱 */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-8">
                    <div className="md:col-span-4">
                        <h4 className="text-sm font-bold text-gray-900">作品集名稱</h4>
                        <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                            這將顯示在瀏覽器分頁與行動版標題
                        </p>
                    </div>
                    <div className="md:col-span-8">
                        <div className="relative">
                            <input
                                value={localSiteName}
                                onChange={e => setLocalSiteName(e.target.value)}
                                onBlur={() => localSiteName !== settings.siteName && updateValue("siteName", localSiteName)}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-black/5 focus:border-black outline-none transition-all"
                                placeholder="例如：Kelly Photography"
                            />
                            {saving && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <Loader2 className="animate-spin text-gray-300" size={16} />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* LINE@ 連結 */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-8 border-t border-gray-50 pt-10">
                    <div className="md:col-span-4">
                        <h4 className="text-sm font-bold text-gray-900">LINE@ 聯繫連結</h4>
                        <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                            輸入您的 LINE 官方帳號連結，前台將出現聯繫按鈕
                        </p>
                    </div>
                    <div className="md:col-span-8">
                        <input
                            value={localLineUrl}
                            onChange={e => setLocalLineUrl(e.target.value)}
                            onBlur={() => localLineUrl !== settings.lineUrl && updateValue("lineUrl", localLineUrl)}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-black/5 focus:border-black outline-none transition-all"
                            placeholder="https://line.me/R/ti/p/..."
                        />
                    </div>
                </div>

                {/* 開關類設定 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                    {controls.map(ctrl => (
                        <div
                            key={ctrl.key}
                            className="flex items-start gap-4 p-5 bg-gray-50/50 rounded-2xl border border-gray-100 hover:bg-gray-50 transition-colors"
                        >
                            <div className="p-2.5 bg-white rounded-xl shadow-sm border border-gray-100">
                                <ctrl.icon className="text-gray-600" size={18} />
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                    <h4 className="text-sm font-bold text-gray-900">{ctrl.label}</h4>
                                    <button
                                        onClick={() => updateToggle(ctrl.key, !settings[ctrl.key])}
                                        className={clsx(
                                            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors outline-none",
                                            settings[ctrl.key] ? "bg-black" : "bg-gray-200"
                                        )}
                                    >
                                        <span
                                            className={clsx(
                                                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                                                settings[ctrl.key] ? "translate-x-6" : "translate-x-1"
                                            )}
                                        />
                                    </button>
                                </div>
                                <p className="text-[11px] text-gray-400 leading-relaxed">
                                    {ctrl.description}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
