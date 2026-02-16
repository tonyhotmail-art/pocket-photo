"use client";

import { useState, useEffect, useRef } from "react";
import { PortfolioItem } from "@/lib/schema";
import { clsx } from "clsx";

interface MainGalleryProps {
    items: PortfolioItem[];
    onItemClick: (item: PortfolioItem) => void;
    onCategoryClick?: (categoryName: string) => void;
    onTagClick?: (tagName: string) => void;
}

export default function MainGallery({ items, onItemClick, onCategoryClick, onTagClick }: MainGalleryProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [hoveredId, setHoveredId] = useState<string | null>(null);

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

        const currentItems = containerRef.current?.querySelectorAll(".fluid-reveal");
        currentItems?.forEach((item) => observer.observe(item));

        return () => observer.disconnect();
    }, [items]);

    return (
        <div className="px-6 md:px-12 py-12 lg:py-20" ref={containerRef}>
            <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 2xl:columns-5 gap-6 space-y-6">
                {items.map((item, index) => {
                    const delay = (index % 3) * 0.1;

                    return (
                        <div
                            key={item.id}
                            className="fluid-reveal relative break-inside-avoid mb-8"
                            style={{ transitionDelay: `${delay}s` }}
                        >
                            {/* 外層容器：負責位移與陰影 */}
                            <div
                                className="group relative cursor-pointer rounded-sm"
                                onClick={() => onItemClick(item)}
                                onMouseEnter={() => setHoveredId(item.id || null)}
                                onMouseLeave={() => setHoveredId(null)}
                                style={{
                                    transform: hoveredId === item.id ? 'translateY(-12px) scale(1.02)' : 'translateY(0) scale(1)',
                                    boxShadow: hoveredId === item.id ? '0 30px 60px -15px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.1)',
                                    transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                                    zIndex: hoveredId === item.id ? 50 : 10,
                                }}
                            >
                                {/* 內層容器：負責圖片遮罩 */}
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
                                            transform: hoveredId === item.id ? 'scale(1.1)' : 'scale(1)',
                                            transition: 'transform 0.7s ease-out'
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="mt-4 flex flex-col items-start font-serif">
                                {/* 品類/名稱組合展示 */}
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
                })}
            </div>
        </div>
    );
}
