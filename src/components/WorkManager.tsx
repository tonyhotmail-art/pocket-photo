"use client";

import { useState, useEffect } from "react";
import NextImage from "next/image";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, where, getDocs, limit, startAfter, getCountFromServer, QueryConstraint, doc, getDoc, deleteDoc } from "firebase/firestore";
import { PortfolioItem } from "@/lib/schema";
import { Loader2, Trash2, Search, Filter, Image as ImageIcon, ExternalLink } from "lucide-react";
import clsx from "clsx";

import Lightbox from "./Lightbox";

export default function WorkManager() {
    const [items, setItems] = useState<PortfolioItem[]>([]);
    const [selectedItem, setSelectedItem] = useState<PortfolioItem | null>(null);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [isBatchDeleting, setIsBatchDeleting] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [categories, setCategories] = useState<string[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // 分頁相關狀態
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [hasPrevPage, setHasPrevPage] = useState(false);
    const [pageHistory, setPageHistory] = useState<any[]>([]); // 儲存每一頁的第一個文件
    const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});

    // 監聽外部更新事件 (例如從 AutoForm 上傳成功後)
    useEffect(() => {
        const handleUpdate = () => {
            console.log("[WorkManager] Received update event, refreshing...");
            loadPage(1); // 回到第一頁
            loadCategoryCounts(); // 更新分類計數
        };
        window.addEventListener("portfolio-updated", handleUpdate);
        return () => window.removeEventListener("portfolio-updated", handleUpdate);
    }, []);

    useEffect(() => {
        loadPage(1);
        loadCategoryCounts(); // 載入分類數量
    }, [selectedCategory, pageSize]);

    // 切換頁面時清空選取
    useEffect(() => {
        setSelectedIds(new Set());
    }, [currentPage]);

    const loadPage = async (page: number) => {
        setLoading(true);
        try {
            // 呼叫後端 API 處理分頁邏輯
            const response = await fetch(
                `/api/works/paginate?page=${page}&pageSize=${pageSize}&category=${selectedCategory}`
            );

            if (!response.ok) {
                throw new Error("Failed to fetch page");
            }

            const data = await response.json();

            if (data.error) {
                console.error("Pagination error:", data.error);
                loadPage(1);
                return;
            }

            setItems(data.items);
            setHasNextPage(data.hasNextPage);
            setHasPrevPage(data.hasPrevPage);
            setCurrentPage(data.currentPage);
        } catch (error) {
            console.error("Failed to fetch items:", error);
        } finally {
            setLoading(false);
        }
    };

    const loadCategoryCounts = async () => {
        try {
            // 載入所有分類
            const allQ = query(collection(db, "portfolio_items"));
            const allSnapshot = await getDocs(allQ);
            const allCats = Array.from(new Set(
                allSnapshot.docs.map(doc => doc.data().categoryName as string)
            ));
            setCategories(allCats);

            // 計算每個分類的數量
            const counts: Record<string, number> = {};

            // 計算總數
            const totalQ = query(collection(db, "portfolio_items"));
            const totalCount = await getCountFromServer(totalQ);
            counts['all'] = totalCount.data().count;

            // 計算每個分類的數量
            for (const cat of allCats) {
                const catQ = query(
                    collection(db, "portfolio_items"),
                    where("categoryName", "==", cat)
                );
                const catCount = await getCountFromServer(catQ);
                counts[cat] = catCount.data().count;
            }

            setCategoryCounts(counts);
        } catch (error) {
            console.error("Failed to load category counts:", error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("確定要刪除這件作品嗎？此操作無法復原，圖片檔案也會一併刪除。")) return;

        setDeletingId(id);
        try {
            const res = await fetch(`/api/works?id=${id}`, {
                method: "DELETE",
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "刪除失敗");
            }
            // 不需要手動更新 state，因為 onSnapshot 會自動更新
            if (selectedIds.has(id)) {
                const newSet = new Set(selectedIds);
                newSet.delete(id);
                loadPage(currentPage); // 刪除後更新當前頁面
            }
            loadCategoryCounts(); // 刪除後更新頂部計數
        } catch (error) {
            console.error("Delete error:", error);
            alert("刪除失敗，請稍後再試。");
        } finally {
            setDeletingId(null);
        }
    };

    const handleBatchDelete = async () => {
        if (selectedIds.size === 0) return;

        const count = selectedIds.size;
        if (!confirm(`確定要刪除選取的 ${count} 件作品嗎？此操作無法復原，圖片檔案也會一併刪除。`)) return;

        try {
            const idList = Array.from(selectedIds);
            const res = await fetch(`/api/works?ids=${idList.join(",")}`, {
                method: "DELETE"
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "批次刪除失敗");
            }

            alert(`成功刪除 ${selectedIds.size} 件作品！`);
            setSelectedIds(new Set());
            loadPage(1); // 批次刪除後回到第一頁刷新
            loadCategoryCounts(); // 更新頂部計數
        } catch (error) {
            console.error("Batch delete error:", error);
            alert("部分項目刪除失敗，請檢查網路後再試。");
        } finally {
            setIsBatchDeleting(false);
        }
    };

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const handleSelectAll = (items: PortfolioItem[]) => {
        if (selectedIds.size === items.length && items.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(items.map(item => item.id!)));
        }
    };

    // 搜尋過濾（在當前頁內搜尋）
    const filteredItems = searchTerm
        ? items.filter(item => {
            const matchesSearch = item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));
            return matchesSearch;
        })
        : items;

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-gray-300" size={32} /></div>;

    const isAllSelected = filteredItems.length > 0 && selectedIds.size === filteredItems.length;

    // 計算總頁數
    const currentCategoryCount = selectedCategory === "all"
        ? categoryCounts['all']
        : categoryCounts[selectedCategory];
    const totalPages = currentCategoryCount ? Math.ceil(currentCategoryCount / pageSize) : 0;

    // 生成頁碼按鈕
    const getPageNumbers = () => {
        const pages: (number | string)[] = [];
        const maxVisible = 7;

        if (totalPages <= maxVisible) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            if (currentPage <= 4) {
                for (let i = 1; i <= 5; i++) pages.push(i);
                pages.push('...');
                pages.push(totalPages);
            } else if (currentPage >= totalPages - 3) {
                pages.push(1);
                pages.push('...');
                for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
            } else {
                pages.push(1);
                pages.push('...');
                for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
                pages.push('...');
                pages.push(totalPages);
            }
        }
        return pages;
    };

    return (
        <div className="w-full space-y-6 pb-20">
            {/* 第一行：相本標籤按鈕 */}
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={() => setSelectedCategory("all")}
                    className={clsx(
                        "px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                        selectedCategory === "all"
                            ? "bg-gray-800 text-white shadow-md"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    )}
                >
                    全部 {categoryCounts['all'] !== undefined && `(${categoryCounts['all']})`}
                </button>
                {categories.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={clsx(
                            "px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                            selectedCategory === cat
                                ? "bg-gray-800 text-white shadow-md"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        )}
                    >
                        {cat} {categoryCounts[cat] !== undefined && `(${categoryCounts[cat]})`}
                    </button>
                ))}
            </div>

            {/* 第二行：每頁顯示數量 + 搜尋 */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 font-medium">每頁顯示：</span>
                    {[20, 50, 100].map(size => (
                        <button
                            key={size}
                            onClick={() => setPageSize(size)}
                            className={clsx(
                                "px-3 py-1.5 rounded-md text-sm font-semibold transition-all",
                                pageSize === size
                                    ? "bg-blue-600 text-white"
                                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            )}
                        >
                            {size}
                        </button>
                    ))}
                    <span className="text-sm text-gray-400 ml-2">
                        第 {currentPage} 頁
                    </span>

                    {/* 全選按鈕 */}
                    <div className="h-6 w-px bg-gray-200 mx-2 hidden md:block" />
                    <button
                        onClick={() => handleSelectAll(filteredItems)}
                        className={clsx(
                            "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold transition-all border",
                            isAllSelected
                                ? "bg-gray-800 text-white border-gray-800"
                                : "bg-white text-gray-600 border-gray-200 hover:border-gray-800"
                        )}
                    >
                        <div className={clsx(
                            "w-4 h-4 rounded border flex items-center justify-center transition-all",
                            isAllSelected ? "bg-white border-white" : "border-gray-300"
                        )}>
                            {isAllSelected && <div className="w-2 h-2 bg-gray-800 rounded-sm" />}
                        </div>
                        {isAllSelected ? "取消全選" : "全選當前頁"}
                    </button>
                </div>

                {/* 搜尋框 */}
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="text"
                        placeholder="搜尋標題、內容或標籤..."
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-gray-800 outline-none transition"
                    />
                </div>
            </div>

            {/* 作品網格 */}
            {
                filteredItems.length === 0 ? (
                    <div className="bg-gray-50/50 rounded-2xl py-20 flex flex-col items-center justify-center text-gray-400 border border-dashed border-gray-200">
                        <ImageIcon size={48} strokeWidth={1} className="mb-4 opacity-20" />
                        <p className="text-sm tracking-widest">找不到符合條件的作品</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
                        {filteredItems.map((item) => {
                            const isSelected = item.id ? selectedIds.has(item.id) : false;
                            return (
                                <div
                                    key={item.id}
                                    className={clsx(
                                        "bg-white border rounded-xl overflow-hidden group hover:shadow-md transition-all flex flex-col relative",
                                        isSelected ? "border-gray-800 ring-1 ring-gray-800" : "border-gray-100"
                                    )}
                                    onClick={() => item.id && toggleSelection(item.id)}
                                >
                                    {/* 多選 Checkbox (覆蓋層) */}
                                    <div className={clsx(
                                        "absolute top-3 left-3 z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer shadow-sm",
                                        isSelected
                                            ? "bg-blue-600 border-blue-600 scale-110"
                                            : "bg-white/90 border-gray-300 opacity-0 group-hover:opacity-100 hover:border-gray-800"
                                    )}>
                                        {isSelected && (
                                            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </div>

                                    {/* 照片預覽：改為完整模式 (Contain) 以避免人像裁切 */}
                                    <div className="aspect-square relative overflow-hidden bg-gray-50">
                                        <NextImage
                                            src={item.imageUrl}
                                            alt={item.title || "Portfolio Image"}
                                            fill
                                            sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
                                            className="object-contain transition-transform duration-500 group-hover:scale-105"
                                        />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 pointer-events-none">
                                            {/* 遮罩，讓點擊優先觸發 selection */}
                                        </div>
                                        <div className="absolute top-3 right-3 z-20" onClick={(e) => e.stopPropagation()}>
                                            <div className="absolute top-3 right-3 z-20" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedItem(item);
                                                    }}
                                                    className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/40 transition-colors flex items-center justify-center cursor-pointer hover:scale-110 active:scale-95"
                                                    title="放大預覽"
                                                >
                                                    <ExternalLink size={16} />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/60 backdrop-blur-md text-white text-[9px] uppercase tracking-widest rounded-sm">
                                            {item.categoryName}
                                        </div>
                                    </div>

                                    {/* 文字資訊 */}
                                    <div className="p-4 flex-1 flex flex-col">
                                        <h3 className="font-bold text-gray-800 text-sm line-clamp-1 mb-1">
                                            {item.title || "未命名作品"}
                                        </h3>
                                        <p className="text-gray-400 text-[11px] line-clamp-2 leading-relaxed flex-1">
                                            {item.description || "暫無說明"}
                                        </p>

                                        <div className="mt-4 flex items-center justify-between border-t border-gray-50 pt-3" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex flex-wrap gap-1">
                                                {item.tags.slice(0, 2).map(tag => (
                                                    <span key={tag} className="text-[9px] text-gray-400">#{tag}</span>
                                                ))}
                                                {item.tags.length > 2 && <span className="text-[9px] text-gray-300">...</span>}
                                            </div>

                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation(); // 防止觸發卡片選取
                                                    item.id && handleDelete(item.id);
                                                }}
                                                disabled={deletingId === item.id}
                                                className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                            >
                                                {deletingId === item.id ? (
                                                    <Loader2 size={16} className="animate-spin" />
                                                ) : (
                                                    <Trash2 size={16} />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )
            }

            {/* 分頁導航 */}
            {
                totalPages > 1 && (
                    <div className="flex justify-center items-center gap-2 mt-8 flex-wrap">
                        {/* 上一頁 */}
                        <button
                            onClick={() => loadPage(currentPage - 1)}
                            disabled={currentPage === 1 || loading}
                            className={clsx(
                                "px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                                currentPage === 1 || loading
                                    ? "bg-gray-100 text-gray-300 cursor-not-allowed"
                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            )}
                        >
                            ←
                        </button>

                        {/* 頁碼按鈕 */}
                        {getPageNumbers().map((page, index) => (
                            page === '...' ? (
                                <span key={`ellipsis-${index}`} className="px-2 text-gray-400">...</span>
                            ) : (
                                <button
                                    key={page}
                                    onClick={() => loadPage(page as number)}
                                    disabled={loading}
                                    className={clsx(
                                        "px-4 py-2 rounded-lg text-sm font-semibold transition-all min-w-[40px]",
                                        currentPage === page
                                            ? "bg-gray-800 text-white shadow-md"
                                            : "bg-gray-100 text-gray-700 hover:bg-gray-200",
                                        loading && "opacity-50 cursor-not-allowed"
                                    )}
                                >
                                    {page}
                                </button>
                            )
                        ))}

                        {/* 下一頁 */}
                        <button
                            onClick={() => loadPage(currentPage + 1)}
                            disabled={currentPage >= totalPages || loading}
                            className={clsx(
                                "px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                                currentPage >= totalPages || loading
                                    ? "bg-gray-100 text-gray-300 cursor-not-allowed"
                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            )}
                        >
                            →
                        </button>
                    </div>
                )
            }

            {/* 底部浮動操作列 */}
            {
                selectedIds.size > 0 && (
                    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-3 md:px-6 py-2 md:py-3 rounded-full shadow-2xl z-50 flex items-center gap-2 md:gap-6 animate-in slide-in-from-bottom-6 fade-in duration-300 max-w-[90vw]">
                        <span className="text-xs md:text-sm font-medium whitespace-nowrap">已選 {selectedIds.size} 項</span>
                        <div className="hidden md:block h-4 w-px bg-gray-700" />
                        <button
                            onClick={handleBatchDelete}
                            disabled={isBatchDeleting}
                            className="flex items-center gap-1 md:gap-2 text-red-300 hover:text-red-200 transition-colors text-xs md:text-sm font-bold"
                        >
                            {isBatchDeleting ? (
                                <Loader2 size={14} className="md:w-4 md:h-4 animate-spin" />
                            ) : (
                                <Trash2 size={14} className="md:w-4 md:h-4" />
                            )}
                            <span className="hidden sm:inline">刪除選取項目</span>
                            <span className="sm:hidden">刪除</span>
                        </button>
                        <button
                            onClick={() => setSelectedIds(new Set())}
                            className="text-gray-500 hover:text-gray-300"
                        >
                            <span className="sr-only">取消</span>
                            <div className="w-4 h-4 md:w-5 md:h-5 rounded-full border border-gray-500 flex items-center justify-center text-[10px]">✕</div>
                        </button>
                    </div>
                )
            }

            {/* Lightbox 預覽 */}
            {selectedItem && (
                <Lightbox
                    item={selectedItem}
                    items={filteredItems}
                    isAdmin={true}
                    onClose={() => setSelectedItem(null)}
                    onItemUpdate={(updatedItem) => {
                        setItems(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));
                        setSelectedItem(updatedItem);
                    }}
                // categories={categories} // TODO: 若需要在 Lightbox 內更改分類，需傳入完整的 Category 物件陣列
                />
            )}
        </div >
    );
}
