"use client";

import { useState, useEffect } from "react";
import NextImage from "next/image";
import { db } from "@/lib/firebase";
import {
    collection,
    query,
    onSnapshot,
    addDoc,
    deleteDoc,
    doc,
    serverTimestamp,
    orderBy
} from "firebase/firestore";
import { Trash2, UserPlus, Mail, Phone, Shield, Loader2, X, Check } from "lucide-react";
import { clsx } from "clsx";

interface AdminRecord {
    id: string;
    type: "google" | "custom";
    email?: string;
    accountName?: string;
    photoURL?: string;
    phone?: string;
    uid?: string;
    createdAt?: { seconds: number; nanoseconds: number };
}

export default function AdminManagement() {
    const [admins, setAdmins] = useState<AdminRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);

    // Form states
    const [type, setType] = useState<"google" | "custom">("google");
    const [email, setEmail] = useState("");
    const [accountName, setAccountName] = useState("");
    const [phone, setPhone] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const q = query(collection(db, "admins"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as AdminRecord[];
            setAdmins(list);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleAddAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const data: Partial<AdminRecord> & { role?: string } = {
                type,
                role: 'system_admin', // 明確賦予最高管理員角色，配合主副 ID 架構
                createdAt: serverTimestamp() as any, // serverTimestamp 在寫入時需轉型以符合 Partial
            };

            if (type === "google") {
                if (!email) throw new Error("請輸入 Email");
                data.email = email.toLowerCase().trim();
                data.accountName = accountName.trim(); // 儲存手動輸入的名稱
            } else {
                if (!accountName || !phone) throw new Error("請填寫完整帳號與手機");

                // 手機格式驗證 (09xxxxxxxx)
                const phoneRegex = /^09\d{8}$/;
                if (!phoneRegex.test(phone.trim())) {
                    throw new Error("手機號碼格式錯誤。請輸入 10 碼數字，並以 09 開頭 (例如：0912345678)");
                }

                data.accountName = accountName.trim();
                data.phone = phone.trim();
            }

            await addDoc(collection(db, "admins"), data);

            // Reset form
            setEmail("");
            setAccountName("");
            setPhone("");
            setIsAdding(false);
        } catch (error) {
            const message = error instanceof Error ? error.message : "新增失敗";
            alert(message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`確定要移除管理員「${name}」的權限嗎？`)) return;
        try {
            await deleteDoc(doc(db, "admins", id));
        } catch (error) {
            alert("刪除失敗");
        }
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-900 text-white rounded-xl">
                        <Shield size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">管理員名單維護</h3>
                        <p className="text-xs text-gray-400 mt-0.5">控制能進入此後台的人員名單</p>
                    </div>
                </div>
                {/* [暫時隱藏] 新增管理員功能 — 未來有需要再開放
                <button
                    onClick={() => setIsAdding(!isAdding)}
                    className={clsx(
                        "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all",
                        isAdding ? "bg-gray-100 text-gray-500" : "bg-gray-900 text-white hover:bg-black shadow-md shadow-gray-200"
                    )}
                >
                    {isAdding ? <X size={16} /> : <UserPlus size={16} />}
                    {isAdding ? "取消新增" : "新增管理員"}
                </button>
                */}
            </div>

            {/* 新增表單區塊 */}
            {isAdding && (
                <div className="p-6 bg-gray-50/50 border-b border-gray-100 animate-in slide-in-from-top-4 duration-300">
                    <form onSubmit={handleAddAdmin} className="max-w-xl space-y-4">
                        <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-xl mb-4">
                            <button
                                type="button"
                                onClick={() => setType("google")}
                                className={clsx(
                                    "py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2",
                                    type === "google" ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600"
                                )}
                            >
                                <Mail size={14} /> Google 帳號
                            </button>
                            <button
                                type="button"
                                onClick={() => setType("custom")}
                                className={clsx(
                                    "py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2",
                                    type === "custom" ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600"
                                )}
                            >
                                <Phone size={14} /> 帳號/手機
                            </button>
                        </div>

                        {type === "google" ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest ml-1">Google 電子郵件 (Email)</label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="example@gmail.com"
                                        className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl focus:ring-2 focus:ring-gray-800 outline-none transition text-sm"
                                        required
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest ml-1">管理者名稱 (可選)</label>
                                    <input
                                        type="text"
                                        value={accountName}
                                        onChange={(e) => setAccountName(e.target.value)}
                                        placeholder="例如：Kelly"
                                        className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl focus:ring-2 focus:ring-gray-800 outline-none transition text-sm"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest ml-1">管理者名稱 (中文可)</label>
                                    <input
                                        type="text"
                                        value={accountName}
                                        onChange={(e) => setAccountName(e.target.value)}
                                        placeholder="例如：Kelly"
                                        className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl focus:ring-2 focus:ring-gray-800 outline-none transition text-sm"
                                        required
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest ml-1">手機號碼</label>
                                    <input
                                        type="text"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        placeholder="0912345678"
                                        className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl focus:ring-2 focus:ring-gray-800 outline-none transition text-sm"
                                        required
                                    />
                                </div>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-black transition-all flex items-center justify-center gap-2"
                        >
                            {submitting ? <Loader2 className="animate-spin" size={18} /> : <><Check size={18} /> 確認授權</>}
                        </button>
                    </form>
                </div>
            )}

            {/* 名單列表區塊 */}
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-gray-50/50 text-[10px] uppercase tracking-[0.2em] text-gray-400 font-bold">
                            <th className="px-6 py-4">類型</th>
                            <th className="px-6 py-4">識別資訊</th>
                            <th className="px-6 py-4">加入時間</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {loading ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center">
                                    <Loader2 className="animate-spin text-gray-200 mx-auto" size={32} />
                                </td>
                            </tr>
                        ) : admins.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-gray-400 text-sm">
                                    目前尚無手動授權的管理員 (預設管理員除外)
                                </td>
                            </tr>
                        ) : (
                            admins.map((admin) => (
                                <tr key={admin.id} className="hover:bg-gray-50/30 transition-colors group">
                                    <td className="px-6 py-4">
                                        {admin.type === "google" ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                                                <Mail size={10} /> Google
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                                                <Phone size={10} /> Custom
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium text-gray-700">
                                        {admin.type === "google" ? (
                                            <div className="flex items-center gap-3">
                                                {/* Google 頭像 */}
                                                <div className="flex-shrink-0">
                                                    {admin.photoURL ? (
                                                        <NextImage
                                                            src={admin.photoURL}
                                                            alt=""
                                                            width={40}
                                                            height={40}
                                                            className="rounded-full border-2 border-white shadow-sm object-cover"
                                                            referrerPolicy="no-referrer"
                                                            unoptimized={admin.type === "google"}
                                                        />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500 border border-red-100">
                                                            <Mail size={16} />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex flex-col">
                                                    {/* 優先顯示 Google 名稱，若無則顯示 Email */}
                                                    <span className="font-bold">{admin.accountName || admin.email}</span>
                                                    {/* 若有名稱，則將 Email 縮小顯示在下方 */}
                                                    {admin.accountName && (
                                                        <span className="text-[10px] text-gray-400 mt-0.5">{admin.email}</span>
                                                    )}
                                                    {admin.uid && (
                                                        <span className="text-[10px] text-gray-300 font-mono mt-0.5">
                                                            UID: {admin.uid.substring(0, 8)}...
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col">
                                                <span>{admin.accountName}</span>
                                                <span className="text-[10px] text-gray-400 mt-0.5">{admin.phone}</span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-[11px] text-gray-400">
                                        <div className="flex items-center gap-1.5 text-[10px] text-gray-400 mt-1 cursor-default">
                                            <span>加入於 {(admin.createdAt as any)?.toDate?.()?.toLocaleDateString() || (admin.createdAt as any)?.toDate?.()?.toLocaleDateString() || "近期"}</span>
                                        </div>
                                    </td>
                                    {/* [暫時隱藏] 刪除管理員功能 — 未來有需要再開放
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleDelete(admin.id, admin.email || admin.accountName || "管理員")}
                                            className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                            title="移除權限"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                    */}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="p-4 bg-gray-50/30 border-t border-gray-50">
                <p className="text-[10px] text-gray-400 text-center">
                    註：預設最高管理員不在列表中，且無法被移除。
                </p>
            </div>
        </div>
    );
}
