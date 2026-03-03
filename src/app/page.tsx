import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Camera, ShieldCheck } from "lucide-react";
import ApplicationForm from "@/components/ApplicationForm";

export default async function LandingPage() {
    const user = await currentUser();

    if (user) {
        const role = user.publicMetadata?.role as string | undefined;
        const appAccess = user.publicMetadata?.appAccess as Record<string, string> | undefined;

        // 情況 1：超級管理員 → 顯示管理員專屬歡迎頁（不屬於任何單一相館）
        if (role === 'super_admin') {
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

        // 情況 2：相片館店長（store_admin + appAccess.photo_slug）→ 跳轉專屬相館
        const photoSlug = appAccess?.photo_slug;
        if (photoSlug) {
            redirect(`/${photoSlug}`);
        }

        const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || '用戶';
        const userEmail = user.emailAddresses[0]?.emailAddress || '';


        return (
            <div className="min-h-screen bg-black/90 text-white flex flex-col items-center justify-center p-6 gap-8">
                {/* 品牌 Logo */}
                <div className="flex flex-col items-center gap-4">
                    <div className="bg-white/10 p-3 rounded-full backdrop-blur-sm border border-white/20">
                        <Camera className="w-10 h-10 text-white" />
                    </div>
                    <div className="text-center">
                        <h1 className="text-3xl font-bold tracking-tight">口袋相片</h1>
                        <p className="text-gray-400 text-sm mt-1">您好，{displayName}！請填寫以下資料申請您的專屬相館</p>
                    </div>
                </div>

                {/* 申請表單 */}
                <ApplicationForm userEmail={userEmail} userName={displayName} />

                {/* 裝飾性背景 */}
                <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-white/5 rounded-full blur-3xl opacity-50 mix-blend-screen"></div>
                </div>
            </div>
        );
    }

    // 情況 3：未登入 → 顯示正常登入/註冊按鈕
    return (
        <div className="min-h-screen bg-black/90 text-white flex flex-col items-center justify-center p-4">
            {/* 品牌 Logo 與標題 */}
            <div className="flex flex-col items-center space-y-6 mb-12 animate-fade-in-up">
                <div className="bg-white/10 p-4 rounded-full backdrop-blur-sm border border-white/20">
                    <Camera className="w-16 h-16 text-white" />
                </div>
                <div className="text-center space-y-2">
                    <h1 className="text-5xl font-bold tracking-tight">口袋相片</h1>
                    <p className="text-xl text-gray-400 font-light">你的專屬專業相冊平台，與客戶零距離</p>
                </div>
            </div>

            {/* 登入與註冊按鈕（只在未登入時顯示）*/}
            <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
                <SignInButton mode="modal">
                    <button className="w-full px-8 py-4 bg-white text-black rounded-lg font-semibold text-lg hover:bg-gray-200 transition-all duration-200">
                        登入管理
                    </button>
                </SignInButton>
                <SignUpButton mode="modal">
                    <button className="w-full px-8 py-4 bg-transparent border border-white/30 rounded-lg font-semibold text-lg text-white hover:bg-white/10 transition-all duration-200">
                        建立相冊
                    </button>
                </SignUpButton>
            </div>

            {/* 裝飾性背景 */}
            <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-white/5 rounded-full blur-3xl opacity-50 mix-blend-screen"></div>
            </div>
        </div>
    );
}

