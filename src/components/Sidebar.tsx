"use client";

import { Category } from "@/lib/schema";
import { clsx } from "clsx";
import { Share2, MessageCircle, Copy, Check } from "lucide-react";
import { siteConfig } from "@/lib/config";
import { useState } from "react";

interface SidebarProps {
    categories: Category[];
    selectedCategoryName: string;
    onSelectCategory: (name: string) => void;
}

export default function Sidebar({
    categories,
    selectedCategoryName,
    onSelectCategory,
}: SidebarProps) {
    const [copied, setCopied] = useState(false);

    const handleShare = () => {
        const url = window.location.href;
        navigator.clipboard.writeText(url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const handleContact = () => {
        window.open(siteConfig.lineAtUrl, "_blank");
    };

    return (
        <>
            {/* 電腦版側邊欄 (lg 以上) */}
            <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-[100px] flex-col items-center py-12 border-r border-gray-300 bg-[#F8F7F3] z-50 shadow-[4px_0_15px_rgba(0,0,0,0.03)] focus-within:z-50">
                <div className="mb-12 cursor-pointer" onClick={() => onSelectCategory("all")}>
                    <h1 className="vertical-serif text-2xl font-bold tracking-widest text-[#1A1A1A]">
                        KELLY PHOTO
                    </h1>
                </div>

                <nav className="flex flex-col gap-8 flex-1 overflow-y-auto no-scrollbar py-8 w-full items-center">
                    <button
                        onClick={() => onSelectCategory("all")}
                        className={clsx(
                            "vertical-serif text-sm transition-all duration-300 w-10 py-10 rounded-sm flex items-center justify-center",
                            selectedCategoryName === "all"
                                ? "bg-[#1A1A1A] text-white font-bold shadow-md"
                                : "text-gray-400 hover:text-gray-600 hover:bg-gray-100/50"
                        )}
                    >
                        全部作品 / ALL
                    </button>

                    {categories.map((category) => (
                        <button
                            key={category.id}
                            onClick={() => onSelectCategory(category.name)}
                            className={clsx(
                                "vertical-serif text-sm transition-all duration-300 w-10 py-10 rounded-sm flex items-center justify-center",
                                selectedCategoryName === category.name
                                    ? "bg-[#1A1A1A] text-white font-bold shadow-md"
                                    : "text-gray-400 border-transparent hover:text-gray-600 hover:bg-gray-100/50"
                            )}
                        >
                            {category.name}
                        </button>
                    ))}
                </nav>

                <div className="mt-auto flex flex-col gap-6 pb-4">
                    <button
                        onClick={handleShare}
                        className="flex flex-col items-center group relative"
                        title="分享相本"
                    >
                        <div className={clsx(
                            "p-3 rounded-full transition-all duration-300",
                            copied ? "bg-green-100 text-green-600" : "bg-white text-gray-400 group-hover:bg-gray-100 group-hover:text-gray-600"
                        )}>
                            {copied ? <Check size={20} /> : <Share2 size={20} />}
                        </div>
                        <span className="text-[10px] mt-1 text-gray-400 tracking-tighter uppercase font-sans">
                            {copied ? "已複製" : "分享"}
                        </span>
                    </button>

                    <button
                        onClick={handleContact}
                        className="flex flex-col items-center group"
                        title="預約造型"
                    >
                        <div className="p-3 bg-[#06C755] text-white rounded-full transition-all duration-300 hover:scale-110 shadow-lg shadow-green-100">
                            <MessageCircle size={20} fill="currentColor" />
                        </div>
                        <span className="text-[10px] mt-1 text-gray-400 tracking-tighter uppercase font-sans">
                            預約
                        </span>
                    </button>
                </div>
            </aside>

            {/* 行動版橫拉標籤列 (lg 以下) */}
            <nav className="lg:hidden fixed top-16 left-0 right-0 h-14 bg-[#F8F7F3]/95 backdrop-blur-md border-b border-gray-100 z-30 flex items-center overflow-x-auto no-scrollbar px-6 gap-2">
                <button
                    onClick={() => onSelectCategory("all")}
                    className={clsx(
                        "whitespace-nowrap px-4 py-1.5 text-xs tracking-widest transition-all rounded-full border",
                        selectedCategoryName === "all"
                            ? "bg-[#1A1A1A] text-white border-[#1A1A1A]"
                            : "bg-white text-gray-400 border-gray-100"
                    )}
                >
                    ALL 全部
                </button>
                {categories.map((category) => (
                    <button
                        key={category.id}
                        onClick={() => onSelectCategory(category.name)}
                        className={clsx(
                            "whitespace-nowrap px-4 py-1.5 text-xs tracking-widest transition-all rounded-full border",
                            selectedCategoryName === category.name
                                ? "bg-[#1A1A1A] text-white border-[#1A1A1A]"
                                : "bg-white text-gray-400 border-gray-100"
                        )}
                    >
                        {category.name}
                    </button>
                ))}

                {/* 分享與聯絡功能 (行動版尾端) */}
                <div className="flex gap-2 ml-4 relative">
                    <button
                        onClick={handleShare}
                        className={clsx(
                            "flex items-center gap-1.5 px-4 py-1.5 text-xs tracking-widest transition-all rounded-full border shadow-sm",
                            copied ? "bg-green-500 text-white border-green-500" : "bg-white text-gray-600 border-gray-200"
                        )}
                    >
                        {copied ? <Check size={14} /> : <Share2 size={14} />}
                        <span>{copied ? "已複製" : "分享"}</span>
                    </button>
                    <button
                        onClick={handleContact}
                        className="flex items-center gap-1.5 px-4 py-1.5 text-xs tracking-widest transition-all rounded-full border bg-[#06C755] text-white border-[#06C755] shadow-sm ml-1"
                    >
                        <MessageCircle size={14} fill="currentColor" />
                        <span>預約</span>
                    </button>
                </div>

                {/* 增加右側留白確保滑到底部美觀 */}
                <div className="min-w-[24px]" />
            </nav>
        </>
    );
}
