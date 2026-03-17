import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export default clerkMiddleware(async (auth, req) => {
    const url = new URL(req.url);

    // 等待認證物件
    const { userId, sessionClaims } = await auth();

    // 如果使用者已登入
    if (userId) {
        // 從 sessionClaims 取出角色與租戶。
        // 🚨 注意：這需要在 Clerk Dashboard 中設定 Custom Session Token 才能順利拿到 publicMetadata。
        // 例如：{ "publicMetadata": "{{user.public_metadata}}" }
        const metadata = sessionClaims?.publicMetadata as Record<string, unknown> | undefined;
        const role = metadata?.role as string | undefined;
        // 從新 SaaS 架構的 appAccess.photo_slug 讀取，相容舊版 tenantSlug
        const appAccess = metadata?.appAccess as Record<string, string> | undefined;
        const tenantSlug = appAccess?.photo_slug ?? (metadata?.tenantSlug as string | undefined);

        // 若使用者進入首頁，自動導向他的店鋪
        if (url.pathname === '/') {
            if (tenantSlug) {
                return NextResponse.redirect(new URL(`/${tenantSlug}`, req.url));
            }
        }

        // 防越權機制：取得 /[slug] 並比對
        const match = url.pathname.match(/^\/([^\/]+)/);
        if (match) {
            const pathSlug = match[1];
            // 排除系統路由與 API
            if (!['api', '_next', 'favicon.ico', 'sign-in', 'sign-up'].includes(pathSlug)) {
                // 如果身分是 store_admin，且網址上的 slug 不是他所屬的店鋪，強制退回他的店鋪
                if (role === 'store_admin' && tenantSlug && pathSlug !== tenantSlug) {
                    return NextResponse.redirect(new URL(`/${tenantSlug}`, req.url));
                }
            }
        }
    }

    return NextResponse.next();
});

export const config = {
    matcher: [
        // 略過 Next.js 內部架構與靜態檔案
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        // 確保包含 API 路由
        '/(api|trpc)(.*)',
    ],
};
