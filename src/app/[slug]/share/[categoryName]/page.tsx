"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, where, limit } from "firebase/firestore";
import { PortfolioItem } from "@/lib/schema";
import MainGallery from "@/components/MainGallery";
import Lightbox from "@/components/Lightbox";
import { Loader2, Image as ImageIcon, Share2 } from "lucide-react";
import { useSystemSettings } from "@/components/SystemSettings";

export default function ShareCategoryPage() {
    const params = useParams() as { slug: string; categoryName: string };
    const tenantSlug = params.slug;
    const targetCategory = decodeURIComponent(params.categoryName);

    const [items, setItems] = useState<PortfolioItem[]>([]);
    const [selectedItem, setSelectedItem] = useState<PortfolioItem | null>(null);
    const [loading, setLoading] = useState(true);
    const [displayLimit, setDisplayLimit] = useState(20);
    const [hasMore, setHasMore] = useState(false);
    const observerTarget = useRef<HTMLDivElement>(null);

    const { settings: siteSettings } = useSystemSettings();

    // 動態更新網頁標題
    useEffect(() => {
        if (siteSettings && siteSettings.siteName) {
            document.title = `${targetCategory} | ${siteSettings.siteName}`;
        } else {
            document.title = `${targetCategory} | 口袋相片`;
        }
    }, [siteSettings?.siteName, targetCategory]);

    useEffect(() => {
        if (!tenantSlug || !targetCategory) return;

        setLoading(true);
        const q = query(
            collection(db, "portfolio_items"),
            where("tenantId", "==", tenantSlug),
            where("categoryName", "==", targetCategory),
            orderBy("categoryOrder", "asc"),
            orderBy("createdAt", "desc"),
            limit(displayLimit + 1)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            let allItems = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as PortfolioItem[];

            // 避免 __回收區__ 內容
            allItems = allItems.filter(item => item.categoryName !== "__回收區__");

            if (allItems.length > displayLimit) {
                setHasMore(true);
                setItems(allItems.slice(0, displayLimit));
            } else {
                setHasMore(false);
                setItems(allItems);
            }
            setLoading(false);
        }, (error) => {
            console.error("Firestore 讀取錯誤:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [tenantSlug, targetCategory, displayLimit]);

    useEffect(() => {
        if (selectedItem) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
        return () => {
            document.body.style.overflow = "unset";
        };
    }, [selectedItem]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore && !loading) {
                    setDisplayLimit(prev => prev + 20);
                }
            },
            { threshold: 0.1, rootMargin: "200px" }
        );

        if (observerTarget.current) {
            observer.observe(observerTarget.current);
        }
        return () => observer.disconnect();
    }, [hasMore, loading]);

    const [isSharing, setIsSharing] = useState(false);

    const handleShare = async () => {
        if (isSharing) return;

        const url = `${window.location.origin}${window.location.pathname}`;

        if (navigator.share) {
            try {
                setIsSharing(true);
                await navigator.share({
                    title: `${targetCategory} - ${siteSettings?.siteName || "口袋相片"}`,
                    url: url
                });
            } catch (error: any) {
                // 忽略使用者取消分享的錯誤 (AbortError)
                if (error.name !== 'AbortError') {
                    console.error("分享失敗:", error);
                }
            } finally {
                // 確保狀態重置
                setTimeout(() => setIsSharing(false), 500);
            }
        } else if (navigator.clipboard) {
            navigator.clipboard.writeText(url);
            alert("分類網址已複製到剪貼簿");
        } else {
            alert("您的瀏覽器不支援自動複製，請手動複製網址：" + url);
        }
    };

    return (
        <main className="min-h-screen bg-[#F8F7F3] text-[#1A1A1A] font-serif">
            {/* Mobile Top Bar */}
            <div className="fixed top-0 left-0 right-0 h-16 bg-[#F8F7F3]/80 backdrop-blur-md border-b border-gray-100 z-30 flex items-center justify-between px-6">
                <h1 className="text-xl font-bold tracking-tighter truncate max-w-[70%] text-center mx-auto">
                    {targetCategory}
                    <span className="text-sm font-normal text-gray-500 ml-2 block sm:inline">
                        ({siteSettings?.siteName || "Pocket Photo"})
                    </span>
                </h1>
                {siteSettings?.allowSharing && (
                    <button
                        onClick={handleShare}
                        className="absolute right-4 w-9 h-9 flex items-center justify-center bg-white text-[#555555] shadow-sm border border-gray-200 rounded-full hover:scale-105 transition-transform"
                        title="分享此分類"
                    >
                        <Share2 className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                )}
            </div>

            {/* 分享按鈕 Desktop (置於右上角) */}
            <div className="hidden lg:flex fixed top-8 right-8 z-40">
                {siteSettings?.allowSharing && (
                    <button
                        onClick={handleShare}
                        className="flex items-center gap-2 px-4 h-11 bg-white text-[#555555] shadow-xl rounded-full hover:scale-105 transition-transform border border-gray-200"
                        title="分享此分類"
                    >
                        <Share2 className="w-4 h-4" strokeWidth={1.5} />
                        <span className="text-sm font-bold">分享本頁</span>
                    </button>
                )}
            </div>

            <div className="relative pt-24 lg:pt-32 px-4 sm:px-8">
                {/* 標題區 */}
                <div className="mb-10 text-center">
                    <h2 className="text-3xl font-bold tracking-widest">{targetCategory}</h2>
                    <div className="w-12 h-0.5 bg-gray-300 mx-auto mt-4"></div>
                </div>

                {loading && items.length === 0 ? (
                    <div className="h-[50vh] flex items-center justify-center">
                        <Loader2 className="animate-spin text-gray-300" size={32} />
                    </div>
                ) : (
                    <>
                        <MainGallery
                            items={items}
                            onItemClick={setSelectedItem}
                            onCategoryClick={() => { }} // 關閉點擊跳轉分類功能
                            onTagClick={() => { }} // 關閉點擊跳轉標籤功能
                            showTimeline={siteSettings?.showTimeline}
                        />
                        <div ref={observerTarget} className="h-20 flex items-center justify-center">
                            {hasMore && loading && (
                                <Loader2 className="animate-spin text-gray-200" size={24} />
                            )}
                        </div>
                    </>
                )}

                {!loading && items.length === 0 && (
                    <div className="h-[50vh] flex flex-col items-center justify-center text-gray-400">
                        <ImageIcon size={48} strokeWidth={1} className="mb-4 opacity-20" />
                        <p className="tracking-widest text-sm">此分類尚無作品展示</p>
                    </div>
                )}

                <footer className="fixed bottom-0 left-0 right-0 z-30 px-6 md:px-12 py-3 border-t border-gray-200/60 bg-[#F8F7F3]/80 backdrop-blur-md flex flex-row justify-between items-center">
                    <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold tracking-tight">Pocket Photo 口袋相片</h4>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] text-gray-400 leading-tight">口袋城市，程式隨選即用</p>
                        <p className="text-[9px] text-gray-300 tracking-tight">
                            © {new Date().getFullYear()} Pocket App City
                        </p>
                    </div>
                </footer>
                {/* 固定頁底的佔位空間 */}
                <div className="h-14" />
            </div>

            <Lightbox
                item={selectedItem}
                items={items}
                isAdmin={false} // 強制不是管理員 (即使原登入者是管理員，分享頁也不應有管理功能)
                onClose={() => setSelectedItem(null)}
                onCategoryClick={() => { }} // 禁止 Lightbox 中切換分類
                onTagClick={() => { }}      // 禁止 Lightbox 中切換標籤
                onLoadMore={() => {
                    if (hasMore && !loading) {
                        setDisplayLimit(prev => prev + 20);
                    }
                }}
                hasMore={hasMore}
                onReachEnd={() => { }} // 分享頁不自動跳下一分類
            />
        </main>
    );
}
