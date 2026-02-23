"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { PortfolioItem } from "@/lib/schema";
import { clsx } from "clsx";

interface MainGalleryProps {
    items: PortfolioItem[];
    onItemClick: (item: PortfolioItem) => void;
    onCategoryClick?: (categoryName: string) => void;
    onTagClick?: (tagName: string) => void;
    showTimeline?: boolean;
}

// 取得照片顯示日期（優先 EXIF，否則用上傳時間）
function getItemDate(item: PortfolioItem): Date {
    if (item.photoDate) return new Date(item.photoDate);
    const raw = item.createdAt as any;
    if (raw?.toDate) return raw.toDate();
    if (raw?.seconds) return new Date(raw.seconds * 1000);
    return new Date();
}

function formatGroupTitle(date: Date): string {
    return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

// ─── PhotoCard 定義在外部，避免 hoveredId 狀態變化時被重新掛載 ───
interface PhotoCardProps {
    item: PortfolioItem;
    index: number;
    hoveredId: string | null;
    onHover: (id: string | null) => void;
    onItemClick: (item: PortfolioItem) => void;
    onCategoryClick?: (categoryName: string) => void;
    onTagClick?: (tagName: string) => void;
}

function PhotoCard({ item, index, hoveredId, onHover, onItemClick, onCategoryClick, onTagClick }: PhotoCardProps) {
    const delay = (index % 3) * 0.1;
    const isHovered = hoveredId === item.id;

    return (
        <div
            className="fluid-reveal relative break-inside-avoid mb-8"
            style={{ transitionDelay: `${delay}s` }}
        >
            <div
                className="group relative cursor-pointer rounded-sm"
                onClick={() => onItemClick(item)}
                onMouseEnter={() => onHover(item.id || null)}
                onMouseLeave={() => onHover(null)}
                style={{
                    transform: isHovered ? 'translateY(-12px) scale(1.02)' : 'translateY(0) scale(1)',
                    boxShadow: isHovered ? '0 30px 60px -15px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.1)',
                    transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                    zIndex: isHovered ? 50 : 10,
                }}
            >
                <div className="overflow-hidden bg-gray-100 rounded-sm w-full h-full">
                    <img
                        src={item.imageUrl}
                        alt={item.title || "Portfolio image"}
                        draggable="false"
                        onContextMenu={(e) => e.preventDefault()}
                        onDragStart={(e) => e.preventDefault()}
                        className="w-full h-auto object-cover select-none pointer-events-none"
                        style={{
                            WebkitTouchCallout: "none",
                            transform: isHovered ? 'scale(1.1)' : 'scale(1)',
                            transition: 'transform 0.7s ease-out'
                        }}
                    />
                </div>
            </div>

            <div className="mt-4 flex flex-col items-start font-serif">
                <div className="flex flex-wrap items-baseline gap-x-3 mb-1">
                    <button
                        onClick={() => onCategoryClick?.(item.categoryName)}
                        className="text-[10px] uppercase tracking-[0.3em] text-gray-400 hover:text-[#1A1A1A] transition-colors"
                    >
                        {item.categoryName}
                    </button>
                    {item.title && (
                        <h3
                            className="text-lg font-bold tracking-wider text-[#1A1A1A] cursor-pointer hover:opacity-70 transition-opacity"
                            onClick={() => onItemClick(item)}
                        >
                            {item.title}
                        </h3>
                    )}
                </div>

                {item.description && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-3 leading-relaxed opacity-80">
                        {item.description}
                    </p>
                )}

                {item.tags && item.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                        {item.tags.map((tag) => (
                            <button
                                key={tag}
                                onClick={() => onTagClick?.(tag)}
                                className="text-[9px] border border-gray-100 px-2 py-0.5 text-gray-400 uppercase tracking-widest hover:border-gray-800 hover:text-gray-800 transition-all rounded-sm"
                            >
                                #{tag}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── 主組件 ───
export default function MainGallery({ items, onItemClick, onCategoryClick, onTagClick, showTimeline = false }: MainGalleryProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    const [activeYear, setActiveYear] = useState<number | null>(null);
    const groupRefs = useRef<Record<string, HTMLDivElement | null>>({});

    // 觀察進入畫面的分組，更新右側導覽軸的高亮年份
    useEffect(() => {
        if (!showTimeline) return;
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const year = parseInt(entry.target.getAttribute("data-year") || "0", 10);
                        if (year) setActiveYear(year);
                    }
                });
            },
            { threshold: 0.2 }
        );
        Object.values(groupRefs.current).forEach((el) => el && observer.observe(el));
        return () => observer.disconnect();
    }, [showTimeline, items]);

    // 滑入動畫觀察（需同時依賴 items 和 showTimeline，因為切換模式會重建 DOM）
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("is-visible");
                    }
                });
            },
            { threshold: 0.02, rootMargin: "0px 0px -20px 0px" }
        );

        // 確保在 React 繪製後能截取到所有新建的卡片
        const timer = setTimeout(() => {
            const currentItems = containerRef.current?.querySelectorAll(".fluid-reveal");
            currentItems?.forEach((item) => observer.observe(item));
        }, 50);

        return () => {
            clearTimeout(timer);
            observer.disconnect();
        };
    }, [items, showTimeline]);

    // 按照月份分組照片
    const groupedItems = useMemo(() => {
        if (!showTimeline) return null;
        const groups: { key: string; label: string; year: number; items: PortfolioItem[] }[] = [];
        const groupMap = new Map<string, PortfolioItem[]>();
        const sorted = [...items].sort((a, b) => getItemDate(b).getTime() - getItemDate(a).getTime());
        sorted.forEach((item) => {
            const date = getItemDate(item);
            const key = `${date.getFullYear()}-${date.getMonth()}`;
            if (!groupMap.has(key)) {
                groupMap.set(key, []);
                groups.push({ key, label: formatGroupTitle(date), year: date.getFullYear(), items: groupMap.get(key)! });
            }
            groupMap.get(key)!.push(item);
        });
        return groups;
    }, [items, showTimeline]);

    // 所有年份清單（右側導覽）
    const years = useMemo(() => {
        if (!groupedItems) return [];
        const set = new Set(groupedItems.map((g) => g.year));
        return Array.from(set).sort((a, b) => b - a);
    }, [groupedItems]);

    const scrollToYear = (year: number) => {
        const key = Object.keys(groupRefs.current).find((k) => k.startsWith(`${year}-`));
        if (key && groupRefs.current[key]) {
            groupRefs.current[key]!.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        setActiveYear(year);
    };

    return (
        <div className="px-6 md:px-12 py-12 lg:py-20 relative" ref={containerRef}>

            {/* ── 時間軸模式 ── */}
            {showTimeline && groupedItems ? (
                <>
                    {/* 右側年份導覽軸 */}
                    <div className="fixed right-4 md:right-6 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2 items-end">
                        {years.map((year) => (
                            <button
                                key={year}
                                onClick={() => scrollToYear(year)}
                                className={clsx(
                                    "text-[10px] font-bold tracking-widest transition-all duration-300 px-2 py-1 rounded-full",
                                    activeYear === year
                                        ? "text-[#1A1A1A] bg-white shadow-md scale-110"
                                        : "text-gray-300 hover:text-gray-500"
                                )}
                            >
                                {year}
                            </button>
                        ))}
                    </div>

                    {/* 依月份分組展示 */}
                    {groupedItems.map((group) => (
                        <div
                            key={group.key}
                            ref={(el) => { groupRefs.current[group.key] = el; }}
                            data-year={group.year}
                            className="mb-16"
                        >
                            <div className="flex items-center gap-4 mb-8">
                                <h2 className="text-sm font-bold text-[#1A1A1A] tracking-[0.2em] uppercase">
                                    {group.label}
                                </h2>
                                <div className="flex-1 h-px bg-gray-100" />
                                <span className="text-[10px] text-gray-400">{group.items.length} 張</span>
                            </div>
                            <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 2xl:columns-5 gap-6 space-y-6">
                                {group.items.map((item, index) => (
                                    <PhotoCard
                                        key={item.id}
                                        item={item}
                                        index={index}
                                        hoveredId={hoveredId}
                                        onHover={setHoveredId}
                                        onItemClick={onItemClick}
                                        onCategoryClick={onCategoryClick}
                                        onTagClick={onTagClick}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </>
            ) : (
                /* ── 一般平鋪模式 ── */
                <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 2xl:columns-5 gap-6 space-y-6">
                    {items.map((item, index) => (
                        <PhotoCard
                            key={item.id}
                            item={item}
                            index={index}
                            hoveredId={hoveredId}
                            onHover={setHoveredId}
                            onItemClick={onItemClick}
                            onCategoryClick={onCategoryClick}
                            onTagClick={onTagClick}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
