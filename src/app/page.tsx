import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Camera, ShieldCheck, ImagePlus, LogIn, RefreshCw } from "lucide-react";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import ApplicationForm from "@/components/ApplicationForm";
import NoPermissionActions from "@/components/NoPermissionActions";
import InstallPWAButton from "@/components/InstallPWAButton";
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

        // 情況 1：Clerk Token 上有相館代號 → 優先跳轉（不論身分是否為管理員）
        const photoSlug = appAccess?.photo_slug;
        if (photoSlug) {
            redirect(`/${photoSlug}`);
        }

        // 情況 1b（雙重保險）：Clerk Token 延遲未更新，改去 Firebase tenants 集合比對 Email
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
                console.error("[LandingPage] Firebase tenants 比對失敗:", err);
            }
        }

        // 情況 2：系統管理員 (system_admin) 但「沒有專屬相館」 → 顯示管理員專屬說明頁，但提供跳轉選項
        if (role === 'system_admin' && !isApplyFlow) {
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
                        <p className="text-white font-bold text-lg">您是系統管理員</p>
                        <p className="text-gray-400 text-sm">
                            您的帳號具備最高管理權限。您可以前往 <span className="text-violet-400 font-mono">Pocket Admin</span> 進行全系統管理，或在此建立測試相館。
                        </p>
                    </div>
                    
                    <div className="flex flex-col gap-3 w-full max-w-xs">
                        <a 
                            href="https://pocket-admin.vercel.app" 
                            target="_blank"
                            className="flex items-center justify-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-bold transition-all"
                        >
                            前往 Pocket Admin 後台
                        </a>
                        <a 
                            href="/?apply=true"
                            className="flex items-center justify-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium border border-white/10 transition-all"
                        >
                            <ImagePlus className="w-4 h-4" />
                            建立/測試申請相館
                        </a>
                    </div>

                    <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-white/5 rounded-full blur-3xl opacity-50 mix-blend-screen"></div>
                    </div>
                </div>
            );
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
        <div className="min-h-screen bg-[#020402] text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* 背景紋理與整體光暈 */}
            <div
                className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{
                    backgroundImage: `url(https://d2xsxph8kpxj0f.cloudfront.net/310519663413754587/TgZsh9WDBCkcE3sdpSsW6u/city-texture-CTBAdxTKeX7PeqYHCzPvx9.webp)`,
                    backgroundSize: "400px 400px",
                }}
            />

            <div className="relative w-full max-w-[1100px] bg-[#060A08] border border-[#c8a84b]/30 rounded-[2rem] p-8 md:p-12 lg:p-16 flex flex-col lg:flex-row items-center gap-12 lg:gap-20 shadow-[0_0_50px_rgba(200,168,75,0.05)] z-10 my-8">
                {/* 裝飾性背景光暈 */}
                <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-[#c8a84b]/5 blur-[120px] rounded-full pointer-events-none" />

                {/* 左側：手機 Mockup 區塊 */}
                <div className="relative w-full lg:w-[45%] flex flex-col justify-center items-center py-4">
                    <div className="absolute inset-0 bg-[#c8a84b]/15 blur-[60px] rounded-full transform scale-90 pointer-events-none"></div>
                    <div className="relative z-10 w-full max-w-[280px] aspect-[1/2.15] rounded-[2.5rem] border-[3px] border-[#222222] ring-1 ring-[#c8a84b]/40 overflow-hidden bg-[#0A0A0A] shadow-[0_0_50px_rgba(0,0,0,0.8)]">
                        <img
                            src="https://d2xsxph8kpxj0f.cloudfront.net/310519663413754587/TgZsh9WDBCkcE3sdpSsW6u/pocket-photo-card-26YmXqTeHDX34eBioU4h6v.webp"
                            alt="Pocket Photo App"
                            className="w-full h-full absolute inset-0 object-cover object-center opacity-95 scale-[1.35]"
                        />
                        <div className="absolute top-0 inset-x-0 h-6 flex justify-center pt-2 pointer-events-none">
                            <div className="w-24 h-5 bg-[#222222] rounded-full shadow-sm"></div>
                        </div>
                    </div>

                    {/* 一鍵安裝 PWA 按鈕，移至手機圖示下方 */}
                    <div className="w-full max-w-[280px] mt-6 relative z-10">
                        <InstallPWAButton />
                    </div>
                </div>

                {/* 右側：文字與按鈕區塊 */}
                <div className="flex-1 flex flex-col justify-center items-start relative z-10 w-full">
                    <div className="flex items-center gap-4 mb-2">
                        <h1
                            className="text-4xl lg:text-5xl font-semibold tracking-wide drop-shadow-md text-[#e8d9b0]"
                            style={{ fontFamily: "'Noto Serif TC', serif" }}
                        >
                            口袋相片
                        </h1>
                        <span className="border border-[#c8a84b]/50 text-[#c8a84b] px-3 py-1 rounded-md text-xs font-bold tracking-widest bg-[#c8a84b]/10 shadow-[0_0_10px_rgba(200,168,75,0.2)]">
                            BETA
                        </span>
                    </div>

                    <p
                        className="text-[#c8a84b] tracking-[0.2em] text-lg lg:text-xl mb-6 lg:mb-8 font-light"
                        style={{ fontFamily: "'Cormorant Garamond', serif" }}
                    >
                        Pocket Photo
                    </p>

                    <p
                        className="leading-loose text-base lg:text-lg mb-8 max-w-xl text-[#a0aab0]"
                        style={{ fontFamily: "'Noto Sans TC', sans-serif" }}
                    >
                        專業相片管理與分享平台，輕鬆整理、展示您的精彩瞬間。支援高畫質上傳、智慧分類與私密相簿功能。
                    </p>

                    <ul className="space-y-4 mb-10 lg:mb-12">
                        {["高畫質相片儲存", "智慧相簿分類", "一鍵分享連結", "私密相簿保護"].map((feat) => (
                            <li
                                key={feat}
                                className="flex items-center gap-4 text-base tracking-wide text-[#ccced0]"
                                style={{ fontFamily: "'Noto Sans TC', sans-serif" }}
                            >
                                <span
                                    className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-[#c8a84b] shadow-[0_0_8px_rgba(200,168,75,0.8)]"
                                />
                                {feat}
                            </li>
                        ))}
                    </ul>

                    {/* 登入與註冊入口 */}
                    <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md lg:max-w-full">
                        <SignUpButton mode="modal" fallbackRedirectUrl="/?apply=true" signInFallbackRedirectUrl="/?apply=true">
                            <button className="flex-1 px-6 py-4 rounded-xl text-base font-bold tracking-widest transition-all duration-300 transform hover:-translate-y-1 bg-gradient-to-r from-[#c8a84b] to-[#d4b968] text-[#1a1a1a] shadow-[0_4px_20px_rgba(200,168,75,0.3)] hover:shadow-[0_8px_30px_rgba(200,168,75,0.5)] border border-[#e8d9b0]/50 hover:border-[#e8d9b0] hover:brightness-110 flex justify-center items-center gap-2">
                                <ImagePlus className="w-5 h-5" />
                                申請相本
                            </button>
                        </SignUpButton>

                        <SignInButton mode="modal">
                            <button className="flex-1 px-6 py-4 rounded-xl text-base font-bold tracking-widest transition-all duration-300 transform hover:-translate-y-1 bg-[#111111]/50 backdrop-blur-md border border-[#c8a84b]/50 text-[#c8a84b] hover:bg-[#c8a84b]/10 flex justify-center items-center gap-2">
                                <LogIn className="w-5 h-5" />
                                登入管理
                            </button>
                        </SignInButton>
                    </div>
                </div>
            </div>
            <p className="mt-8 text-gray-500 text-sm xl:text-base text-center relative z-10 font-light tracking-wide">
                申請後，系統管理員將審核您的申請並開通您的專屬相館
            </p>
        </div>
    );
}
