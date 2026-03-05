import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Camera, ShieldCheck, ImagePlus, LogIn, RefreshCw } from "lucide-react";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import ApplicationForm from "@/components/ApplicationForm";
import NoPermissionActions from "@/components/NoPermissionActions";
import { adminDb } from "@/lib/firebase-admin";

// ✅ ROOT RULE 規則 0：改用 auth() + clerkClient() 強制拉取最新 metadata
export default async function LandingPage({ searchParams }: { searchParams: Promise<{ apply?: string }> }) {
    const { userId } = await auth();
    const params = await searchParams;
    const isApplyFlow = params?.apply === 'true';

    if (userId) {
        // 強制向 Clerk 伺服器拉取最新使用者資料（不使用快取過的 currentUser）
        const client = await clerkClient();
        const user = await client.users.getUser(userId);

        const role = user.publicMetadata?.role as string | undefined;
        const appAccess = user.publicMetadata?.appAccess as Record<string, string> | undefined;
        const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || '用戶';
        const userEmail = user.emailAddresses[0]?.emailAddress || '';

        // 情況 1：系統管理員 (system_admin) → 顯示管理員專屬說明頁
        if (role === 'system_admin') {
            return (
                <div className="min-h-screen bg-black/90 text-white flex flex-col items-center justify-center p-6 gap-6">
                    <div className="flex flex-col items-center gap-4">
                        <div className="bg-white/10 p-3 rounded-full backdrop-blur-sm border border-white/20">
                            <Camera className="w-10 h-10 text-white" />
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight">口袋相片</h1>
                    </div>
                    <div className="flex flex-col items-center gap-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl px-8 py-6 text-center max-w-sm">
                        <ShieldCheck className="w-8 h-8 text-violet-400" />
                        <p className="text-white font-bold">您是系統管理員</p>
                        <p className="text-gray-400 text-sm">請前往 <span className="text-violet-400 font-mono">Pocket Admin</span> 後台管理所有相館。</p>
                    </div>
                    <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-white/5 rounded-full blur-3xl opacity-50 mix-blend-screen"></div>
                    </div>
                </div>
            );
        }

        // 情況 2：Clerk Token 上有相館代號 → 直接跳轉
        const photoSlug = appAccess?.photo_slug;
        if (photoSlug) {
            redirect(`/${photoSlug}`);
        }

        // 情況 2b（雙重保險）：Clerk Token 延遲未更新，改去 Firebase tenants 集合比對 Email
        // 這處理「剛被核准，但 Token 還沒刷新」的空窗期，防止使用者被誤導去填申請表單
        if (userEmail) {
            try {
                const tenantSnap = await adminDb.collection('tenants')
                    .where('ownerEmail', '==', userEmail.toLowerCase())
                    .limit(1)
                    .get();

                if (!tenantSnap.empty) {
                    // Firebase 確認此 Email 確實已有相館，顯示「更新中」友善提示
                    const foundSlug = tenantSnap.docs[0].id;
                    return (
                        <div className="min-h-screen bg-black/90 text-white flex flex-col items-center justify-center p-6 gap-8">
                            <div className="flex flex-col items-center gap-4">
                                <div className="bg-white/10 p-3 rounded-full backdrop-blur-sm border border-white/20">
                                    <Camera className="w-10 h-10 text-white" />
                                </div>
                                <div className="text-center">
                                    <h1 className="text-3xl font-bold tracking-tight">口袋相片</h1>
                                    <p className="text-gray-400 text-sm mt-1">您好，{displayName}！</p>
                                </div>
                            </div>
                            <div className="flex flex-col items-center gap-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl px-8 py-8 text-center max-w-sm">
                                <RefreshCw className="w-10 h-10 text-blue-400 animate-spin" />
                                <p className="text-white font-bold text-lg">您的相館已建立！</p>
                                <p className="text-gray-400 text-sm leading-relaxed">
                                    系統正在為您更新憑證，請按下方按鈕重新整理頁面，即可進入您的相館。
                                </p>
                                <p className="text-xs text-gray-600 font-mono">相館代號：{foundSlug}</p>
                            </div>
                            {/* 重新整理按鈕：讓瀏覽器重新發送請求以取得最新 Token */}
                            <a
                                href={`/${foundSlug}`}
                                className="flex items-center justify-center gap-2 px-8 py-4 bg-white text-black rounded-xl font-semibold text-lg hover:bg-gray-200 transition-all duration-200"
                            >
                                <RefreshCw className="w-5 h-5" />
                                進入我的相館
                            </a>
                            <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-white/5 rounded-full blur-3xl opacity-50 mix-blend-screen"></div>
                            </div>
                        </div>
                    );
                }
            } catch (err) {
                // Firebase 查詢失敗時靜默降級，不影響主流程
                console.error('[LandingPage] Firebase tenants 比對失敗:', err);
            }
        }

        // 情況 3a：從「申請相本」進來（?apply=true）→ 直接顯示申請表單
        if (isApplyFlow) {
            return (
                <div className="min-h-screen bg-black/90 text-white flex flex-col items-center justify-center p-6 gap-8">
                    <div className="flex flex-col items-center gap-4">
                        <div className="bg-white/10 p-3 rounded-full backdrop-blur-sm border border-white/20">
                            <Camera className="w-10 h-10 text-white" />
                        </div>
                        <div className="text-center">
                            <h1 className="text-3xl font-bold tracking-tight">口袋相片</h1>
                            <p className="text-gray-400 text-sm mt-1">您好，{displayName}！請填寫以下資料申請您的專屬相館</p>
                        </div>
                    </div>
                    <ApplicationForm userEmail={userEmail} userName={displayName} />
                    <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-white/5 rounded-full blur-3xl opacity-50 mix-blend-screen"></div>
                    </div>
                </div>
            );
        }

        // 情況 3b：真的沒有相館，顯示提示頁面
        return (
            <div className="min-h-screen bg-black/90 text-white flex flex-col items-center justify-center p-6 gap-8">
                <div className="flex flex-col items-center gap-4">
                    <div className="bg-white/10 p-3 rounded-full backdrop-blur-sm border border-white/20">
                        <Camera className="w-10 h-10 text-white" />
                    </div>
                    <div className="text-center">
                        <h1 className="text-3xl font-bold tracking-tight">口袋相片</h1>
                        <p className="text-gray-400 text-sm mt-1">您好，{displayName}！</p>
                    </div>
                </div>
                <div className="flex flex-col items-center gap-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl px-8 py-8 text-center max-w-sm">
                    <ShieldCheck className="w-10 h-10 text-yellow-400" />
                    <p className="text-white font-bold text-lg">您目前沒有相片管理權限</p>
                    <p className="text-gray-400 text-sm leading-relaxed">
                        您的帳號尚未綁定任何相館。您可以回到相片瀏覽頁面，或申請一個屬於自己的專屬相本。
                    </p>
                </div>
                <NoPermissionActions userEmail={userEmail} userName={displayName} />
                <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-white/5 rounded-full blur-3xl opacity-50 mix-blend-screen"></div>
                </div>
            </div>
        );
    }

    // 情況 4：未登入 → 顯示說明頁 + 兩個明確入口
    return (
        <div className="min-h-screen bg-black/90 text-white flex flex-col items-center justify-center p-4">
            <div className="flex flex-col items-center space-y-6 mb-12">
                <div className="bg-white/10 p-4 rounded-full backdrop-blur-sm border border-white/20">
                    <Camera className="w-16 h-16 text-white" />
                </div>
                <div className="text-center space-y-2">
                    <h1 className="text-5xl font-bold tracking-tight">口袋相片</h1>
                    <p className="text-xl text-gray-400 font-light">你的專屬專業相冊平台，與客戶零距離</p>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
                {/* 申請相本：登入後帶 ?apply=true 直接顯示表單 */}
                <SignUpButton mode="modal" fallbackRedirectUrl="/?apply=true" signInFallbackRedirectUrl="/?apply=true">
                    <button className="w-full flex items-center justify-center gap-2 px-8 py-4 bg-white text-black rounded-xl font-semibold text-lg hover:bg-gray-200 transition-all duration-200">
                        <ImagePlus className="w-5 h-5" />
                        申請相本
                    </button>
                </SignUpButton>

                {/* 已有帳號 → 登入管理（不帶 apply 參數） */}
                <SignInButton mode="modal">
                    <button className="w-full flex items-center justify-center gap-2 px-8 py-4 bg-transparent border border-white/30 rounded-xl font-semibold text-lg text-white hover:bg-white/10 transition-all duration-200">
                        <LogIn className="w-5 h-5" />
                        登入管理
                    </button>
                </SignInButton>
            </div>

            <p className="mt-6 text-gray-600 text-sm text-center">
                申請後，系統管理員將審核您的申請並開通您的專屬相館
            </p>

            <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-white/5 rounded-full blur-3xl opacity-50 mix-blend-screen"></div>
            </div>
        </div>
    );
}
