"use client";

import { useState } from "react";
import { useAuth } from "./AuthContext";
import { X, LogIn, Phone, User, Loader2, ShieldCheck, Mail } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, limit } from "firebase/firestore";

interface LoginModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

export default function LoginModal({ onClose, onSuccess }: LoginModalProps) {
    const { loginWithGoogle, setManuallyAuthorized } = useAuth();
    const [loginMode, setLoginMode] = useState<"choice" | "google" | "custom">("choice");
    const [account, setAccount] = useState("");
    const [phone, setPhone] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 處理自定義帳號/手機登入邏輯
    const handleCustomLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedAccount = account.trim();
        const trimmedPhone = phone.trim();

        if (!trimmedAccount || !trimmedPhone) {
            setError("請填寫完整資訊");
            return;
        }

        // 手機格式驗證
        const phoneRegex = /^09\d{8}$/;
        if (!phoneRegex.test(trimmedPhone)) {
            setError("手機號碼格式錯誤。請輸入 10 碼數字，並以 09 開頭");
            return;
        }

        setLoading(true);
        setError(null);
        try {
            // 在 Firestore 中比對管理員資格
            // 1. 先寬鬆查詢：只查手機號碼
            const q = query(
                collection(db, "admins"),
                where("phone", "==", trimmedPhone)
            );
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                setError("找不到此手機號碼。請確認您已先使用 Google 登入並在後台「管理員名單」中建立資料。");
            } else {
                // ... (原本的成功/名稱檢查邏輯) ...
                // 2. 在結果中尋找符合的名稱
                const validAdmin = snapshot.docs.find(doc => {
                    const data = doc.data();
                    // 確保類型正確且名稱相符
                    return data.type === "custom" && data.accountName === trimmedAccount;
                });

                if (validAdmin) {
                    // 登入成功
                    setManuallyAuthorized(true);
                    setTimeout(() => {
                        onSuccess();
                    }, 500);
                } else {
                    // 3. 如果手機對了但名稱不對，提示系統中的名稱 (偵錯用)
                    const firstMatch = snapshot.docs[0].data();
                    if (firstMatch.type !== "custom") {
                        setError("此手機號碼綁定的是 Google 帳號，請改用 Google 登入。");
                    } else {
                        setError(`名稱不符。您輸入「${trimmedAccount}」，但系統記錄為「${firstMatch.accountName}」。請檢查是否有錯字或選字不同。`);
                    }
                }
            }
        } catch (err) {
            console.error("Custom login error:", err);
            setError("伺服器連線失敗");
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError(null);
        try {
            await loginWithGoogle();
            onSuccess();
        } catch (err: any) {
            console.error("Google login error:", err);
            setError("Google 登入失敗");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            {/* 背景遮罩 */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />

            {/* 登入視窗 */}
            <div className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-300">
                <div className="p-8 md:p-10">
                    <button
                        onClick={onClose}
                        className="absolute top-6 right-6 p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-900"
                    >
                        <X size={20} />
                    </button>

                    <div className="mb-8 mt-2 text-center">
                        <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-800 shadow-sm border border-gray-100">
                            <ShieldCheck size={32} strokeWidth={1.5} />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900">管理員驗證</h2>
                        <p className="text-sm text-gray-400 mt-2">請登入以開啟管理權限</p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl flex items-center gap-2">
                            <X size={14} className="flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    {loginMode === "choice" && (
                        <div className="space-y-4">
                            <button
                                onClick={() => setLoginMode("google")}
                                className="w-full flex items-center justify-center gap-3 py-4 border-2 border-gray-100 rounded-2xl hover:bg-gray-50 transition-all font-medium text-gray-700 active:scale-95"
                            >
                                <Mail className="text-red-500" size={20} />
                                使用 Google 帳號登入
                            </button>
                            <button
                                onClick={() => setLoginMode("custom")}
                                className="w-full flex items-center justify-center gap-3 py-4 bg-gray-900 text-white rounded-2xl hover:bg-black transition-all font-medium shadow-lg shadow-gray-200 active:scale-95"
                            >
                                <User size={20} />
                                使用 帳號/手機 登入
                            </button>
                        </div>
                    )}

                    {loginMode === "google" && (
                        <div className="text-center space-y-6">
                            <div className="p-4 bg-gray-50 rounded-2xl text-xs text-gray-500 leading-relaxed">
                                您即將使用 Google 帳號快速驗證管理員身份。<br />
                                系統將自動檢查您的 UID 權限。
                            </div>
                            <button
                                onClick={handleGoogleLogin}
                                disabled={loading}
                                className="w-full py-4 bg-[#1A1A1A] text-white rounded-2xl hover:bg-black transition-all font-bold flex items-center justify-center gap-2 shadow-xl shadow-gray-200"
                            >
                                {loading ? <Loader2 className="animate-spin" size={20} /> : "立刻進行 Google 驗證"}
                            </button>
                            <button onClick={() => setLoginMode("choice")} className="text-sm text-gray-400 hover:text-gray-900 transition-colors">
                                返回選擇登入方式
                            </button>
                        </div>
                    )}

                    {loginMode === "custom" && (
                        <form onSubmit={handleCustomLogin} className="space-y-5">
                            <div className="space-y-4">
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input
                                        type="text"
                                        placeholder="管理員名稱 (可輸入中文)"
                                        value={account}
                                        onChange={(e) => setAccount(e.target.value)}
                                        className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-gray-800 outline-none transition"
                                    />
                                </div>
                                <div className="relative">
                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input
                                        type="text"
                                        placeholder="管理員手機號碼"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-gray-800 outline-none transition"
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-4 bg-gray-900 text-white rounded-2xl hover:bg-black transition-all font-bold flex items-center justify-center gap-2 shadow-xl shadow-gray-200"
                            >
                                {loading ? <Loader2 className="animate-spin" size={20} /> : "驗證並登入"}
                            </button>
                            <div className="text-center">
                                <button type="button" onClick={() => setLoginMode("choice")} className="text-sm text-gray-400 hover:text-gray-900 transition-colors">
                                    返回選擇登入方式
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
