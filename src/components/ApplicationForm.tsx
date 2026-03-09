'use client';

import { useState, useTransition } from 'react';
import { Camera, Send, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface ApplicationFormProps {
    userEmail: string;
    userName: string;
}

export default function ApplicationForm({ userEmail, userName }: ApplicationFormProps) {
    const [isPending, startTransition] = useTransition();
    const [storeName, setStoreName] = useState('');
    const [slug, setSlug] = useState('');
    const [contactEmail, setContactEmail] = useState(userEmail);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

    // 自動根據店名生成 slug 建議
    const handleStoreNameChange = (val: string) => {
        setStoreName(val);
        if (!slug) {
            const suggested = val
                .toLowerCase()
                .replace(/\s+/g, '-')
                .replace(/[^a-z0-9-]/g, '')
                .slice(0, 30);
            setSlug(suggested);
        }
    };

    // 限制 slug 格式
    const handleSlugChange = (val: string) => {
        const cleaned = val.toLowerCase().replace(/[^a-z0-9-]/g, '');
        setSlug(cleaned);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!storeName.trim() || !slug.trim() || !contactEmail.trim()) return;

        startTransition(async () => {
            try {
                const res = await fetch('/api/apply', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ storeName, slug, contactEmail }),
                });
                const data = await res.json();
                if (data.success) {
                    setResult({
                        success: true,
                        message: data.message || `您的相館「${storeName}」已自動開通！`,
                    });
                    // 2 秒後自動跳轉到新開通的相館
                    setTimeout(() => {
                        window.location.href = `/${slug}`;
                    }, 2000);
                } else {
                    setResult({ success: false, message: data.error || '送出失敗，請稍後重試。' });
                }
            } catch {
                setResult({ success: false, message: '網路錯誤，請稍後再試。' });
            }
        });
    };

    // 申請成功的畫面
    if (result?.success) {
        return (
            <div className="flex flex-col items-center gap-4 bg-white/10 backdrop-blur-sm border border-emerald-500/30 rounded-2xl px-8 py-10 text-center max-w-md w-full">
                <CheckCircle2 className="w-12 h-12 text-emerald-400" />
                <p className="text-white text-lg font-bold">🎉 相館已開通！</p>
                <p className="text-gray-300 text-sm leading-relaxed">{result.message}</p>
                <p className="text-gray-400 text-xs mt-2">正在跳轉到您的相館...</p>
            </div>
        );
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="w-full max-w-md space-y-5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl px-8 py-8"
        >
            <div className="flex items-center gap-3 mb-2">
                <div className="bg-white/10 p-2 rounded-lg">
                    <Camera className="w-5 h-5 text-white" />
                </div>
                <div>
                    <p className="text-white font-bold">申請開通您的相館</p>
                    <p className="text-gray-400 text-xs">填寫以下資料，等待管理員審核</p>
                </div>
            </div>

            {/* 錯誤提示 */}
            {result && !result.success && (
                <div className="flex items-start gap-2 bg-rose-500/20 border border-rose-500/30 rounded-xl px-4 py-3">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <p className="text-rose-300 text-sm">{result.message}</p>
                </div>
            )}

            {/* 相館名稱 */}
            <div className="space-y-1.5">
                <label className="text-sm text-gray-300 font-medium">
                    相館名稱 <span className="text-rose-400">*</span>
                </label>
                <input
                    type="text"
                    value={storeName}
                    onChange={e => handleStoreNameChange(e.target.value)}
                    placeholder="例如：口袋相片 pocket-photo"
                    required
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white/30 text-sm transition-all"
                />
            </div>

            {/* 網址代號 */}
            <div className="space-y-1.5">
                <label className="text-sm text-gray-300 font-medium">
                    網址代號 (Slug) <span className="text-rose-400">*</span>
                </label>
                <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-sm shrink-0">網址將為：/</span>
                    <input
                        type="text"
                        value={slug}
                        onChange={e => handleSlugChange(e.target.value)}
                        placeholder="pocket-photo"
                        required
                        className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white/30 text-sm font-mono transition-all"
                    />
                </div>
                <p className="text-gray-500 text-xs">只能使用小寫英文字母、數字、連字號（-）</p>
            </div>

            {/* 聯絡 Email（從 Clerk 自動帶入，無法更改） */}
            <div className="space-y-1.5">
                <label className="text-sm text-gray-300 font-medium">
                    聯絡 Email <span className="text-rose-400">*</span>
                </label>
                <input
                    type="email"
                    value={contactEmail}
                    readOnly
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-gray-400 text-sm cursor-not-allowed transition-all"
                />
                <p className="text-gray-500 text-xs">Email 由您的登入帳號自動帶入，無法修改</p>
            </div>

            {/* 送出按鈕 */}
            <button
                type="submit"
                disabled={isPending || !storeName || !slug || !contactEmail}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-white text-black rounded-xl font-bold text-sm hover:bg-gray-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
                {isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> 送出中...</>
                ) : (
                    <><Send className="w-4 h-4" /> 送出開通申請</>
                )}
            </button>
        </form>
    );
}
