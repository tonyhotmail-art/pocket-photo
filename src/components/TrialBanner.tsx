"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { useParams } from "next/navigation";
import { Clock, Sparkles, MessageCircle, X } from "lucide-react";

interface TenantPlan {
    plan?: string; // trial / paid
    trialStartDate?: string; // "2026-03-08"
    trialDays?: number; // 30
}

/**
 * 計算試用剩餘天數
 */
function getRemainingDays(startDate: string, totalDays: number): number {
    const start = new Date(startDate);
    const now = new Date();
    const elapsed = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, totalDays - elapsed);
}

/**
 * TrialBanner - 顯示於管理後台
 * - 試用中：頂部提示條 + 「立即開通正式版」按鈕
 * - 到期：全畫面遮罩，鎖住後台，引導 LINE@ 聯繫
 * - 已付費：不顯示任何東西
 */
export default function TrialBanner({ platformLineUrl }: { platformLineUrl?: string }) {
    const { slug } = useParams() as { slug: string };
    const [tenantPlan, setTenantPlan] = useState<TenantPlan | null>(null);
    const [loading, setLoading] = useState(true);
    const [dismissed, setDismissed] = useState(false);

    // 讀取 tenants/{slug} 的 plan 資訊
    useEffect(() => {
        const docRef = doc(db, "tenants", slug);
        const unsubscribe = onSnapshot(docRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                setTenantPlan({
                    plan: data.plan,
                    trialStartDate: data.trialStartDate,
                    trialDays: data.trialDays,
                });
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, [slug]);

    if (loading || !tenantPlan) return null;

    // 已付費 → 不顯示
    if (tenantPlan.plan === "paid") return null;

    // 非試用方案（可能是舊相館沒有 plan 欄位）→ 不顯示
    if (tenantPlan.plan !== "trial") return null;

    const remaining = getRemainingDays(
        tenantPlan.trialStartDate || new Date().toISOString(),
        tenantPlan.trialDays || 30
    );
    const isExpired = remaining <= 0;

    // LINE@ 連結（傳入的平台 LINE@ 或預設空）
    const lineUrl = platformLineUrl || "";

    // ====== 到期遮罩 ======
    if (isExpired) {
        return (
            <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-md flex items-center justify-center p-6">
                <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-10 text-center space-y-6 animate-in fade-in zoom-in duration-500">
                    <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto border-2 border-amber-200">
                        <Clock className="w-10 h-10 text-amber-500" />
                    </div>

                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">試用期已結束</h2>
                        <p className="text-gray-500 text-sm leading-relaxed">
                            感謝您使用口袋相片！您的 {tenantPlan.trialDays || 30} 天試用期已到期。
                            <br />
                            <span className="text-gray-400">您的照片仍安全保存，不會被刪除。</span>
                        </p>
                    </div>

                    {lineUrl ? (
                        <a
                            href={lineUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-3 px-8 py-4 bg-[#00B900] text-white rounded-2xl font-bold text-base hover:bg-[#009900] transition-all shadow-lg shadow-green-500/20 hover:shadow-xl hover:shadow-green-500/30 hover:-translate-y-0.5 w-full justify-center"
                        >
                            <MessageCircle className="w-5 h-5" />
                            聯繫我們開通正式版
                        </a>
                    ) : (
                        <p className="text-sm text-gray-400">
                            請聯繫平台管理員開通正式版
                        </p>
                    )}

                    <p className="text-xs text-gray-400">
                        您的相館瀏覽頁面仍可正常訪問，訪客不受影響。
                    </p>
                </div>
            </div>
        );
    }

    // ====== 試用中提示條 ======
    if (dismissed) return null;

    return (
        <div className="bg-gradient-to-r from-blue-600 to-violet-600 text-white px-4 py-2.5 flex items-center justify-between gap-4 text-sm rounded-xl mb-4 shadow-lg shadow-blue-500/20 animate-in fade-in slide-in-from-top-2 duration-500">
            <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span className="font-bold">Beta 試用版</span>
                <span className="text-white/80">·</span>
                <span className="text-white/80">
                    剩餘 <span className="font-bold text-white">{remaining}</span> 天
                </span>
            </div>

            <div className="flex items-center gap-2">
                {lineUrl ? (
                    <a
                        href={lineUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-white text-blue-700 rounded-lg font-bold text-xs hover:bg-blue-50 transition-all hover:scale-105"
                    >
                        <Sparkles className="w-3 h-3" />
                        立即開通正式版
                    </a>
                ) : (
                    <span className="text-xs text-white/60">聯繫管理員開通正式版</span>
                )}
                <button
                    onClick={() => setDismissed(true)}
                    className="p-1 hover:bg-white/20 rounded-full transition-colors"
                    title="暫時關閉提示"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
}
