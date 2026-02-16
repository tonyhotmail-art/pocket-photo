"use client";

import { PortfolioItem, Category } from "@/lib/schema";
import { X, ChevronLeft, ChevronRight, Trash2, Loader2, Share2, Link as LinkIcon, Copy, MessageCircle } from "lucide-react";
import { useEffect, useState, useCallback, useRef } from "react";
import { clsx } from "clsx";
import { authenticatedFetch } from "@/lib/api-client";

interface LightboxProps {
    item: PortfolioItem | null;
    items: PortfolioItem[];
    onClose: () => void;
    isAdmin?: boolean;
    onCategoryClick?: (categoryName: string) => void;
    onTagClick?: (tagName: string) => void;
    onLoadMore?: () => void;
    hasMore?: boolean;
    onReachEnd?: () => void;
    categories?: Category[];
    onItemUpdate?: (updatedItem: PortfolioItem) => void;
}

export default function Lightbox({
    item: initialItem,
    items,
    onClose,
    isAdmin,
    onCategoryClick,
    onTagClick,
    onLoadMore,
    hasMore,
    onReachEnd,
    categories = [],
    onItemUpdate
}: LightboxProps) {
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [direction, setDirection] = useState<"left" | "right" | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const touchStartX = useRef<number | null>(null);
    const lastWheelTime = useRef<number>(0);
    const initialItemId = useRef<string | null>(null);
    const [showShareMenu, setShowShareMenu] = useState(false);
    const [isCopied, setIsCopied] = useState(false);

    // 當開啟時，尋找初始項目的索引
    useEffect(() => {
        if (initialItem && initialItem.id) {
            // 只在 initialItem 改變時才重新搜尋索引
            if (initialItem.id !== initialItemId.current) {
                const index = items.findIndex(i => i.id === initialItem.id);
                setCurrentIndex(index);
                setDirection(null);
                initialItemId.current = initialItem.id;
                setShowShareMenu(false); // 切換圖片時關閉分享選單
            }
        } else {
            setCurrentIndex(-1);
            initialItemId.current = null;
            setShowShareMenu(false);
        }
    }, [initialItem]);


    const activeItem = currentIndex >= 0 ? items[currentIndex] : null;

    const handleDelete = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!activeItem?.id || isDeleting) return;

        if (!confirm("確定要刪除這張照片嗎?此操作將同時從雲端空間移除檔案,且無法復原。")) {
            return;
        }

        setIsDeleting(true);
        try {
            const res = await authenticatedFetch(`/api/works?id=${activeItem.id}`, {
                method: "DELETE",
            });

            if (!res.ok) throw new Error("刪除失敗");

            // 記錄成功訊息到 console (不使用 alert 避免阻塞)
            console.log("✅ 照片已成功刪除:", activeItem.title);

            // 刪除成功後的處理
            if (items.length <= 1) {
                // 如果是最後一張,直接關閉燈箱
                onClose();
            } else {
                // 計算刪除後應該顯示的索引
                // 如果刪除的是最後一張,往前移一位
                // 否則保持當前索引(因為陣列會自動縮短,當前索引會指向下一張)
                const newIndex = currentIndex >= items.length - 1
                    ? Math.max(0, currentIndex - 1)
                    : currentIndex;

                // 設定新的索引
                setCurrentIndex(newIndex);
                setDirection(null); // 不要有滑動動畫,避免混亂
            }
        } catch (error) {
            console.error("Delete error:", error);
            alert("刪除失敗,請稍後再試。");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleCategoryUpdate = async (category: Category) => {
        if (!activeItem?.id || isUpdating || activeItem.categoryName === category.name) return;

        if (!confirm(`確定要將此作品移動到 [${category.name}] 分類嗎？`)) {
            return;
        }

        setIsUpdating(true);
        try {
            const res = await authenticatedFetch("/api/works", {
                method: "PATCH",
                body: JSON.stringify({
                    id: activeItem.id,
                    categoryName: category.name
                })
            });

            const result = await res.json();

            if (!result.success) {
                throw new Error(result.error || "更新失敗");
            }

            console.log("✅ 分類已更新:", category.name);

            // 更新父層狀態
            if (onItemUpdate) {
                onItemUpdate({
                    ...activeItem,
                    categoryName: category.name
                });
            }

        } catch (error) {
            console.error("Update category error:", error);
            alert("更新分類失敗,請稍後再試。");
        } finally {
            setIsUpdating(false);
        }
    };

    const handlePrev = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation();
        setDirection("left");
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        } else {
            setCurrentIndex(items.length - 1);
        }
    }, [currentIndex, items.length]);

    const handleNext = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation();
        setDirection("right");

        // 如果快看完（剩 5 張），觸發續載
        if (currentIndex >= items.length - 5 && hasMore) {
            onLoadMore?.();
        }

        if (currentIndex < items.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else if (hasMore) {
            // 到達末端但還有更多數據，觸發加載
            onLoadMore?.();
        } else {
            // 真正抵達全域末端，通知父層組件處理（例如切換分類）
            if (onReachEnd) {
                onReachEnd();
            } else {
                // 預設行為：循環回第一張
                setCurrentIndex(0);
            }
        }
    }, [currentIndex, items.length, hasMore, onLoadMore, onReachEnd]);

    // 鍵盤支援
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowLeft") handlePrev();
            if (e.key === "ArrowRight") handleNext();
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handlePrev, handleNext, onClose]);

    // 觸控滑動支援
    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (!touchStartX.current) return;
        const deltaX = e.changedTouches[0].clientX - touchStartX.current;
        if (deltaX > 50) handlePrev();
        else if (deltaX < -50) handleNext();
        touchStartX.current = null;
    };

    // 滾輪切換支援
    const handleWheel = (e: React.WheelEvent) => {
        // 防止切換過快 (debounce)
        const now = Date.now();
        if (now - lastWheelTime.current < 500) return;

        if (Math.abs(e.deltaY) > 30) {
            if (e.deltaY > 0) {
                handleNext();
            } else {
                handlePrev();
            }
            lastWheelTime.current = now;
        }
    };

    if (!activeItem) return null;

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-xl transition-all duration-500 overflow-hidden px-4 py-8"
            onClick={onClose}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onWheel={handleWheel}
        >
            {/* 左右導覽按鈕 */}
            <button
                onClick={handlePrev}
                className="absolute left-2 md:left-8 top-1/2 -translate-y-1/2 z-[80] p-2 md:p-3 text-white bg-black/20 hover:bg-black/40 rounded-full transition-all border border-white/5 backdrop-blur-sm"
            >
                <ChevronLeft className="w-8 h-8 md:w-16 md:h-16" strokeWidth={1} />
            </button>
            <button
                onClick={handleNext}
                className="absolute right-2 md:right-8 top-1/2 -translate-y-1/2 z-[80] p-2 md:p-3 text-white bg-black/20 hover:bg-black/40 rounded-full transition-all border border-white/5 backdrop-blur-sm"
            >
                <ChevronRight className="w-8 h-8 md:w-16 md:h-16" strokeWidth={1} />
            </button>

            {/* 核心卡片容器 */}
            <div
                className="bg-black w-full max-w-7xl h-[90vh] rounded-[1.5rem] md:rounded-[2rem] shadow-2xl overflow-hidden relative animate-in zoom-in-95 fade-in duration-500 ease-out border border-white/10"
                onClick={(e) => e.stopPropagation()}
            >
                {/* 圖片區域 (全版) */}
                <div className="absolute inset-0 z-0 flex items-center justify-center bg-black group overflow-hidden">
                    {/* 透明保護遮罩層 */}
                    <div
                        className="absolute inset-0 z-10 cursor-default"
                        onContextMenu={(e) => e.preventDefault()}
                    />
                    <img
                        key={activeItem.id}
                        src={activeItem.imageUrl}
                        alt={activeItem.title}
                        draggable="false"
                        onContextMenu={(e) => e.preventDefault()}
                        onDragStart={(e) => e.preventDefault()}
                        className={clsx(
                            "h-full w-full object-contain select-none pointer-events-none touch-none duration-500 ease-out",
                            direction === "right" ? "animate-in fade-in slide-in-from-right-8" :
                                direction === "left" ? "animate-in fade-in slide-in-from-left-8" :
                                    "animate-in fade-in scale-95"
                        )}
                        style={{ WebkitTouchCallout: "none" }}
                    />
                </div>

                {/* 頂部控制列 (頁碼 + 刪除 + 關閉) */}
                <div className="absolute top-0 left-0 w-full p-4 md:p-6 flex justify-between items-start z-[90] pointer-events-none">
                    {/* 左側：頁碼指引 */}
                    <div className="text-[10px] tracking-widest text-white/80 font-serif bg-black/40 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10 shadow-sm pointer-events-auto">
                        {currentIndex + 1} / {items.length}
                    </div>

                    {/* 右側：管理員功能與關閉 */}
                    <div className="flex items-center gap-3 pointer-events-auto">
                        {isAdmin && (
                            <button
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="text-white/80 hover:text-red-400 p-2.5 rounded-full transition-all bg-black/40 backdrop-blur-md hover:bg-black/60 shadow-sm border border-white/10 pointer-events-auto"
                                title="管理員：刪除此作品"
                            >
                                {isDeleting ? (
                                    <Loader2 className="animate-spin" size={20} />
                                ) : (
                                    <Trash2 size={20} strokeWidth={1.5} />
                                )}
                            </button>
                        )}

                        {/* 分享按鈕 */}
                        <div className="relative pointer-events-auto">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
                                        navigator.share({
                                            title: activeItem.title || "Kelly Photo 作品集",
                                            text: activeItem.description || "來看看這張精彩的照片！",
                                            url: `${window.location.origin}${window.location.pathname}?id=${activeItem.id}`
                                        }).catch(console.error);
                                    } else {
                                        setShowShareMenu(!showShareMenu);
                                    }
                                }}
                                className="text-white/80 hover:text-white p-4 rounded-full transition-all bg-black/40 backdrop-blur-md hover:bg-black/60 shadow-sm border border-white/10"
                                aria-label="分享"
                            >
                                <Share2 size={24} strokeWidth={1.5} />
                            </button>

                            {/* 電腦版分享選單 */}
                            {showShareMenu && (
                                <div
                                    className="absolute right-0 mt-3 w-56 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-2 z-[110] animate-in fade-in zoom-in-95 duration-200"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <button
                                        onClick={() => {
                                            const url = `${window.location.origin}${window.location.pathname}?id=${activeItem.id}`;
                                            if (navigator.clipboard) {
                                                navigator.clipboard.writeText(url);
                                                setIsCopied(true);
                                                setTimeout(() => setIsCopied(false), 2000);
                                            } else {
                                                alert("您的瀏覽器不支援自動複製，請手動複製網址：" + url);
                                            }
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                                    >
                                        {isCopied ? <X size={18} className="text-green-500" /> : <LinkIcon size={18} />}
                                        <span className="font-sans font-medium">{isCopied ? "連結已複製！" : "複製照片連結"}</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            const url = encodeURIComponent(`${window.location.origin}${window.location.pathname}?id=${activeItem.id}`);
                                            window.open(`https://line.me/R/msg/text/?${url}`, "_blank");
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                                    >
                                        <MessageCircle size={18} className="text-[#00B900]" />
                                        <span className="font-sans font-medium">分享至 LINE</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            const url = encodeURIComponent(`${window.location.origin}${window.location.pathname}?id=${activeItem.id}`);
                                            window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, "_blank");
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                                    >
                                        <div className="w-[18px] h-[18px] flex items-center justify-center bg-[#1877F2] rounded-full text-white text-[10px] font-bold">f</div>
                                        <span className="font-sans font-medium">分享至 Facebook</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={onClose}
                            className="text-white/80 hover:text-white p-4 rounded-full transition-all bg-black/40 backdrop-blur-md hover:bg-black/60 shadow-sm border border-white/10 z-[100] pointer-events-auto"
                            aria-label="關閉預覽"
                        >
                            <X size={24} strokeWidth={1.5} />
                        </button>
                    </div>
                </div>

                {/* 文字區域 (底部懸浮) */}
                <div
                    className="absolute bottom-0 left-0 w-full z-20 pointer-events-none"
                    onWheel={(e) => e.stopPropagation()}
                >
                    {/* 漸層背景 */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent z-0 h-[150%] translate-y-[-30%]" />

                    <div className="relative z-10 p-6 md:p-10 text-white flex flex-col items-start font-serif pointer-events-auto">
                        <button
                            onClick={() => {
                                onCategoryClick?.(activeItem.categoryName);
                                onClose();
                            }}
                            className="text-[10px] uppercase tracking-[0.4em] text-white/50 mb-3 hover:text-white transition-colors text-left"
                        >
                            {activeItem.categoryName}
                        </button>

                        {/* 管理員分類切換區 */}
                        {isAdmin && categories.length > 0 && (
                            <div className="mb-6 flex flex-wrap gap-3 animate-in fade-in slide-in-from-bottom-2 duration-700 delay-100">
                                <span className="text-xs md:text-sm text-white/60 uppercase tracking-widest py-2 mr-2 font-bold">
                                    更換分類:
                                </span>
                                {categories.map(cat => (
                                    <button
                                        key={cat.id || cat.name}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleCategoryUpdate(cat);
                                        }}
                                        disabled={isUpdating}
                                        className={clsx(
                                            "text-xs md:text-sm px-4 py-2 rounded-md border transition-all uppercase tracking-wider backdrop-blur-md shadow-lg",
                                            activeItem.categoryName === cat.name
                                                ? "bg-white text-black border-white cursor-default font-bold ring-2 ring-white/50"
                                                : "bg-black/40 text-white border-white/30 hover:bg-white/30 hover:text-white hover:border-white hover:scale-105 active:scale-95"
                                        )}
                                    >
                                        {cat.name}
                                    </button>
                                ))}
                            </div>
                        )}

                        {activeItem.title && (
                            <h2 className="text-2xl md:text-4xl font-serif tracking-widest text-white mb-4 font-bold drop-shadow-md">
                                {activeItem.title}
                            </h2>
                        )}

                        {activeItem.description && (
                            <p className="text-white/90 leading-loose font-serif text-sm md:text-base mb-8 max-w-3xl line-clamp-none drop-shadow-sm">
                                {activeItem.description}
                            </p>
                        )}

                        <div className="flex justify-between w-full items-end">
                            {activeItem.tags && activeItem.tags.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {activeItem.tags.map((tag) => (
                                        <button
                                            key={tag}
                                            onClick={() => {
                                                onTagClick?.(tag);
                                                onClose();
                                            }}
                                            className="text-[9px] border border-white/20 px-2 py-0.5 text-white/60 uppercase tracking-[0.2em] hover:border-white hover:text-white transition-all rounded-sm backdrop-blur-sm"
                                        >
                                            #{tag}
                                        </button>
                                    ))}
                                </div>
                            ) : <div />}

                            {/* 手機版滑動提示 (簡化) */}
                            <div className="md:hidden">
                                <p className="text-[9px] text-white/30 tracking-[0.2em] uppercase">
                                    SWIPE / 左 右
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
