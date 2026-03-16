"use client";

import { useState, useEffect, useCallback } from "react";
import NextImage from "next/image";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, getCountFromServer, orderBy } from "firebase/firestore";
import { PortfolioItem, Category } from "@/lib/schema";
import { accessConfig } from "@/lib/config";
import { Loader2, Trash2, Search, Image as ImageIcon, Maximize2, RotateCcw, AlertTriangle, ChevronDown } from "lucide-react";
import clsx from "clsx";
import Lightbox from "./Lightbox";
import { useParams } from "next/navigation";

// 回收區保留天數
const RECYCLE_DAYS = 30;
// 回收區專用分類名稱（與後端一致）
const RECYCLE_CATEGORY = "__回收區__";

// ─── 計算剩餘天數 ─────────────────────────────────────────
function calcDaysLeft(deletedAt: string | undefined): number {
    if (!deletedAt) return RECYCLE_DAYS;
    const diff = Date.now() - new Date(deletedAt).getTime();
    return Math.max(0, RECYCLE_DAYS - Math.floor(diff / (1000 * 60 * 60 * 24)));
}

// ─── 回收區面板（獨立組件，按需展開載入）────────────────────
function RecycleBin({ tenantId, onRestored }: { tenantId: string, onRestored: () => void }) {
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<(PortfolioItem & { daysLeft?: number })[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [autoClearedCount, setAutoClearedCount] = useState(0);
    const [working, setWorking] = useState(false);

    const load = useCallback(async () => {
        if (!tenantId) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/recycle?tenantSlug=${tenantId}`);
            const data = await res.json();
            if (data.success) {
                setItems(data.items);
                setAutoClearedCount(data.autoCleared || 0);
            }
        } catch (e) {
            console.error("[RecycleBin] 讀取失敗:", e);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleOpen = () => {
        if (!open) load();
        setOpen(v => !v);
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const selectAll = () => {
        if (selectedIds.size === items.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(items.map(i => i.id!)));
        }
    };

    // 復原
    const handleRestore = async () => {
        if (selectedIds.size === 0 || !tenantId) return;
        setWorking(true);
        try {
            await fetch(`/api/recycle?tenantSlug=${tenantId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: Array.from(selectedIds) }),
            });
            setSelectedIds(new Set());
            await load();
            onRestored();
        } catch (e) {
            alert("復原失敗，請稍後再試");
        } finally {
            setWorking(false);
        }
    };

    // 永久刪除
    const handlePermanentDelete = async () => {
        if (selectedIds.size === 0 || !tenantId) return;
        if (!confirm(`確定要永久刪除選取的 ${selectedIds.size} 張照片嗎？此操作無法還原，圖片檔案也會一併刪除。`)) return;
        setWorking(true);
        try {
            const idList = Array.from(selectedIds).join(",");
            await fetch(`/api/recycle?ids=${idList}&tenantSlug=${tenantId}`, { method: "DELETE" });
            setSelectedIds(new Set());
            await load();
        } catch (e) {
            alert("永久刪除失敗，請稍後再試");
        } finally {
            setWorking(false);
        }
    };

    return (
        <div className="border border-dashed border-red-200 rounded-2xl overflow-hidden">
            {/* 摺疊標題列 */}
            <button
                onClick={handleOpen}
                className="w-full flex items-center justify-between px-6 py-4 bg-red-50/50 hover:bg-red-50 transition-colors group"
            >
                <div className="flex items-center gap-3">
                    <Trash2 size={16} className="text-red-400" />
                    <span className="text-sm font-bold text-red-500 tracking-wide">資源回收區</span>
                    {!open && items.length === 0 && (
                        <span className="text-[10px] text-red-300">（點擊展開）</span>
                    )}
                    {!open && items.length > 0 && (
                        <span className="text-[10px] bg-red-100 text-red-400 px-2 py-0.5 rounded-full">
                            {items.length} 張待處理
                        </span>
                    )}
                </div>
                <ChevronDown
                    size={16}
                    className={clsx("text-red-400 transition-transform duration-200", open && "rotate-180")}
                />
            </button>

            {/* 展開內容 */}
            {open && (
                <div className="p-6 space-y-4">
                    {/* 自動清除通知 */}
                    {autoClearedCount > 0 && (
                        <div className="flex items-center gap-2 px-4 py-2.5 bg-orange-50 border border-orange-100 rounded-xl text-xs text-orange-600">
                            <AlertTriangle size={14} />
                            已自動永久刪除 {autoClearedCount} 張超過 30 天的照片
                        </div>
                    )}

                    {/* 說明 */}
                    <p className="text-xs text-gray-400 leading-relaxed">
                        此處的照片已從作品集隱藏，僅管理員可見。<br />
                        • 30 天後將自動永久刪除（圖片檔案一併清除）<br />
                        • 可在此復原或提前永久刪除
                    </p>

                    {loading ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="animate-spin text-red-300" size={24} />
                        </div>
                    ) : items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-300">
                            <Trash2 size={36} strokeWidth={1} className="mb-3 opacity-40" />
                            <p className="text-xs tracking-widest">回收區是空的</p>
                        </div>
                    ) : (
                        <>
                            {/* 工具列 */}
                            <div className="flex items-center gap-3 flex-wrap">
                                <button
                                    onClick={selectAll}
                                    className={clsx(
                                        "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold border transition-all",
                                        selectedIds.size === items.length
                                            ? "bg-gray-800 text-white border-gray-800"
                                            : "bg-white text-gray-600 border-gray-200 hover:border-gray-800"
                                    )}
                                >
                                    <div className={clsx(
                                        "w-3.5 h-3.5 rounded border flex items-center justify-center",
                                        selectedIds.size === items.length ? "bg-white border-white" : "border-gray-300"
                                    )}>
                                        {selectedIds.size === items.length && (
                                            <div className="w-2 h-2 bg-gray-800 rounded-sm" />
                                        )}
                                    </div>
                                    全選
                                </button>

                                {selectedIds.size > 0 && (
                                    <>
                                        <button
                                            onClick={handleRestore}
                                            disabled={working}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-white border border-gray-200 text-gray-700 hover:border-gray-800 hover:text-gray-900 transition-all disabled:opacity-50"
                                        >
                                            <RotateCcw size={12} />
                                            復原 {selectedIds.size} 張
                                        </button>
                                        <button
                                            onClick={handlePermanentDelete}
                                            disabled={working}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-red-500 text-white hover:bg-red-600 transition-all disabled:opacity-50"
                                        >
                                            <Trash2 size={12} />
                                            永久刪除 {selectedIds.size} 張
                                        </button>
                                    </>
                                )}
                            </div>

                            {/* 照片格線 */}
                            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                                {items.map((item) => {
                                    const isSelected = selectedIds.has(item.id!);
                                    const daysLeft = item.daysLeft ?? calcDaysLeft(item.deletedAt);
                                    const isUrgent = daysLeft <= 3;
                                    return (
                                        <div
                                            key={item.id}
                                            onClick={() => item.id && toggleSelect(item.id)}
                                            className={clsx(
                                                "bg-white border rounded-xl overflow-hidden group cursor-pointer transition-all relative",
                                                isSelected ? "border-red-400 ring-1 ring-red-400" : "border-gray-100 hover:shadow-md"
                                            )}
                                        >
                                            {/* 選取圓鈕 */}
                                            <div className={clsx(
                                                "absolute top-2 left-2 z-10 w-5 h-5 rounded-full border-2 flex items-center justify-center shadow-sm",
                                                isSelected
                                                    ? "bg-red-500 border-red-500"
                                                    : "bg-white/90 border-gray-300 opacity-0 group-hover:opacity-100"
                                            )}>
                                                {isSelected && (
                                                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                )}
                                            </div>

                                            {/* 剩餘天數角標 */}
                                            <div className={clsx(
                                                "absolute top-2 right-2 z-10 px-1.5 py-0.5 rounded text-[9px] font-bold",
                                                isUrgent
                                                    ? "bg-red-500 text-white"
                                                    : "bg-black/50 text-white"
                                            )}>
                                                剩 {daysLeft} 天
                                            </div>

                                            {/* 縮圖 */}
                                            <div className="aspect-square relative overflow-hidden bg-gray-50">
                                                <NextImage
                                                    src={item.imageUrl}
                                                    alt={item.title || "回收照片"}
                                                    fill
                                                    sizes="(max-width: 768px) 50vw, 25vw"
                                                    className="object-contain opacity-70 group-hover:opacity-100 transition-opacity"
                                                />
                                            </div>

                                            {/* 文字 */}
                                            <div className="p-3">
                                                <p className="text-xs font-semibold text-gray-600 line-clamp-1">
                                                    {item.title || "未命名作品"}
                                                </p>
                                                <p className="text-[10px] text-gray-400 mt-0.5">
                                                    {item.categoryName !== RECYCLE_CATEGORY ? item.categoryName : "原分類未知"}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── 主組件 WorkManager ────────────────────────────────────
export default function WorkManager({ tenantId }: { tenantId: string }) {
    const [items, setItems] = useState<PortfolioItem[]>([]);
    const [selectedItem, setSelectedItem] = useState<PortfolioItem | null>(null);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [isBatchRecycling, setIsBatchRecycling] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // 分頁
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [hasPrevPage, setHasPrevPage] = useState(false);
    const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});

    useEffect(() => {
        const handleUpdate = () => {
            loadPage(1);
            loadCategoryCounts();
        };
        window.addEventListener("portfolio-updated", handleUpdate);
        return () => window.removeEventListener("portfolio-updated", handleUpdate);
    }, []);

    useEffect(() => {
        loadPage(1);
        loadCategoryCounts();
    }, [selectedCategory, pageSize]);

    useEffect(() => {
        setSelectedIds(new Set());
    }, [currentPage]);

    const loadPage = async (page: number) => {
        if (!tenantId) return;
        setLoading(true);
        try {
            const response = await fetch(
                `/api/works/paginate?page=${page}&pageSize=${pageSize}&category=${selectedCategory}&tenantSlug=${tenantId}`
            );
            if (!response.ok) throw new Error("Failed to fetch");
            const result = await response.json();
            if (!result.success) { if (page !== 1) loadPage(1); return; }
            const data = result.data;
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
        if (!tenantId) return;
        try {
            const catsQ = query(
                collection(db, "categories"),
                where("tenantId", "==", tenantId),
                orderBy("order", "asc")
            );
            const catsSnapshot = await getDocs(catsQ);
            const allCats = catsSnapshot.docs.map(doc => ({
                id: doc.id, ...doc.data()
            })) as Category[];

            // 不顯示回收區分類在分頁標籤列
            setCategories(allCats.filter(c => c.name !== RECYCLE_CATEGORY));

            const counts: Record<string, number> = {};
            const totalQ = query(
                collection(db, "portfolio_items"),
                where("tenantId", "==", tenantId),
                where("categoryName", "!=", RECYCLE_CATEGORY) // 不計入回收中的照片
            );
            const totalCount = await getCountFromServer(totalQ);
            counts['all'] = totalCount.data().count;

            for (const cat of allCats.filter(c => c.name !== RECYCLE_CATEGORY)) {
                const catQ = query(
                    collection(db, "portfolio_items"),
                    where("tenantId", "==", tenantId),
                    where("categoryName", "==", cat.name)
                );
                const catCount = await getCountFromServer(catQ);
                counts[cat.name] = catCount.data().count;
            }
            setCategoryCounts(counts);
        } catch (error) {
            console.error("Failed to load category counts:", error);
        }
    };

    // 軟刪除（單筆 → 移入回收區）
    const handleMoveToRecycle = async (id: string) => {
        if (!tenantId) return;
        if (!confirm("確定要將這件作品移入回收區嗎？30 天內可復原，30 天後將自動永久刪除。")) return;
        setDeletingId(id);
        try {
            const res = await fetch(`/api/recycle?tenantSlug=${tenantId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: [id] }),
            });
            if (!res.ok) throw new Error("移入回收區失敗");
            loadPage(currentPage);
            loadCategoryCounts();
        } catch (e) {
            alert("操作失敗，請稍後再試。");
        } finally {
            setDeletingId(null);
        }
    };

    // 批次軟刪除
    const handleBatchRecycle = async () => {
        if (selectedIds.size === 0 || !tenantId) return;
        if (!confirm(`確定要將選取的 ${selectedIds.size} 件作品移入回收區嗎？30 天內可復原。`)) return;
        setIsBatchRecycling(true);
        try {
            const res = await fetch(`/api/recycle?tenantSlug=${tenantId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: Array.from(selectedIds) }),
            });
            if (!res.ok) throw new Error("批次移入回收區失敗");
            setSelectedIds(new Set());
            loadPage(1);
            loadCategoryCounts();
        } catch (e) {
            alert("部分項目操作失敗，請稍後再試。");
        } finally {
            setIsBatchRecycling(false);
        }
    };

    // 批次永久刪除
    const handleBatchPermanentDelete = async () => {
        if (selectedIds.size === 0 || !tenantId) return;
        if (!confirm(`確定要永久刪除選取的 ${selectedIds.size} 件作品嗎？此操作無法復原！`)) return;
        setIsBatchRecycling(true); // 共用 loading 狀態
        try {
            const idList = Array.from(selectedIds).join(",");
            const res = await fetch(`/api/recycle?ids=${idList}&tenantSlug=${tenantId}`, { method: "DELETE" });
            if (!res.ok) throw new Error("批次永久刪除失敗");
            setSelectedIds(new Set());
            loadPage(1);
            loadCategoryCounts();
        } catch (e) {
            alert("部分項目操作失敗，請稍後再試。");
        } finally {
            setIsBatchRecycling(false);
        }
    };

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        newSet.has(id) ? newSet.delete(id) : newSet.add(id);
        setSelectedIds(newSet);
    };

    const handleSelectAll = (items: PortfolioItem[]) => {
        if (selectedIds.size === items.length && items.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(items.map(item => item.id!)));
        }
    };

    const filteredItems = searchTerm
        ? items.filter(item =>
            item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()))
        )
        : items;

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-gray-300" size={32} /></div>;

    const isAllSelected = filteredItems.length > 0 && selectedIds.size === filteredItems.length;

    const currentCategoryCount = selectedCategory === "all"
        ? categoryCounts['all']
        : categoryCounts[selectedCategory];
    const totalPages = currentCategoryCount ? Math.ceil(currentCategoryCount / pageSize) : 0;

    const getPageNumbers = () => {
        const pages: (number | string)[] = [];
        const maxVisible = 7;
        if (totalPages <= maxVisible) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            if (currentPage <= 4) {
                for (let i = 1; i <= 5; i++) pages.push(i);
                pages.push('...'); pages.push(totalPages);
            } else if (currentPage >= totalPages - 3) {
                pages.push(1); pages.push('...');
                for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
            } else {
                pages.push(1); pages.push('...');
                for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
                pages.push('...'); pages.push(totalPages);
            }
        }
        return pages;
    };

    return (
        <div className="w-full space-y-6 pb-20">
            {/* 分類標籤列（不含回收區） */}
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
                        key={cat.id || cat.name}
                        onClick={() => setSelectedCategory(cat.name)}
                        className={clsx(
                            "px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                            selectedCategory === cat.name
                                ? "bg-gray-800 text-white shadow-md"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        )}
                    >
                        {cat.name} {categoryCounts[cat.name] !== undefined && `(${categoryCounts[cat.name]})`}
                    </button>
                ))}
            </div>

            {/* 工具列：每頁數、全選、搜尋 */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm text-gray-600 font-medium">每頁顯示：</span>
                    {[20, 50, 100].map(size => (
                        <button
                            key={size}
                            onClick={() => setPageSize(size)}
                            className={clsx(
                                "px-3 py-1.5 rounded-md text-sm font-semibold transition-all",
                                pageSize === size ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            )}
                        >
                            {size}
                        </button>
                    ))}
                    <span className="text-sm text-gray-400 ml-2">第 {currentPage} 頁</span>

                    <div className="h-6 w-px bg-gray-200 mx-2 hidden md:block" />

                    {/* 全選 + 旁邊的回收垃圾桶 */}
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

                    {/* 全選旁的按鈕：只有選取 > 0 才顯示 */}
                    {selectedIds.size > 0 && (
                        <div className="flex items-center gap-2">
                            {/* 移入回收區 */}
                            <button
                                onClick={handleBatchRecycle}
                                disabled={isBatchRecycling}
                                className="flex items-center justify-center w-8 h-8 rounded-md bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-all disabled:opacity-50"
                                title="移入回收區"
                            >
                                {isBatchRecycling
                                    ? <Loader2 size={16} className="animate-spin" />
                                    : <Trash2 size={16} />}
                            </button>
                            {/* 永久刪除 */}
                            <button
                                onClick={handleBatchPermanentDelete}
                                disabled={isBatchRecycling}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold bg-red-50 text-red-500 border border-red-200 hover:bg-red-100 transition-all disabled:opacity-50"
                                title="永久刪除"
                            >
                                {isBatchRecycling
                                    ? <Loader2 size={15} className="animate-spin" />
                                    : <Trash2 size={15} />}
                                直接刪除
                            </button>
                        </div>
                    )}
                </div>

                {/* 搜尋框 */}
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="text"
                        placeholder="搜尋標題、內容或標籤..."
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-gray-800 outline-none transition"
                    />
                </div>
            </div>

            {/* 作品網格 */}
            {filteredItems.length === 0 ? (
                <div className="bg-gray-50/50 rounded-2xl py-20 flex flex-col items-center justify-center text-gray-400 border border-dashed border-gray-200">
                    <ImageIcon size={48} strokeWidth={1} className="mb-4 opacity-20" />
                    <p className="text-sm tracking-widest">找不到符合條件的作品</p>
                </div>
            ) : (
                <div className="relative">
                    {/* 右側時間軸拉桿 (Scrubber) */}
                    {(() => {
                        const monthsList: string[] = [];
                        filteredItems.forEach(item => {
                            const dateObj = item.photoDate ? new Date(item.photoDate) : null;
                            const dateStr = dateObj ? `${dateObj.getFullYear()}.${dateObj.getMonth() + 1}` : '未知';
                            if (!monthsList.includes(dateStr)) monthsList.push(dateStr);
                        });

                        if (monthsList.length <= 1) return null;

                        return (
                            <div className="fixed right-2 top-1/2 -translate-y-1/2 z-40 bg-white/80 backdrop-blur-sm border border-gray-100 rounded-full py-4 px-1 flex flex-col items-center gap-1 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:opacity-100 lg:opacity-100">
                                {monthsList.map(m => (
                                    <button
                                        key={m}
                                        onClick={() => {
                                            const el = document.getElementById(`date-header-${m}`);
                                            el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                        }}
                                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-900 hover:text-white transition-all text-[10px] font-bold text-gray-400"
                                        title={m.replace('.', '年') + '月'}
                                    >
                                        {m.split('.')[1]}
                                        <div className="hidden absolute right-10 bg-gray-900 text-white px-2 py-1 rounded text-[10px] whitespace-nowrap group-hover/btn:block">
                                            {m}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        );
                    })()}

                    <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 pb-20">
                        {(() => {
                            let lastDateStr = '';
                            return filteredItems.map((item, index) => {
                                const isSelected = item.id ? selectedIds.has(item.id) : false;

                                // 1. 取得顯示日期 (優先用 photoDate，次之用 createdAt)
                                const dateObj = item.photoDate ? new Date(item.photoDate) : null;
                                const currentDateStr = dateObj ? `${dateObj.getFullYear()} 年 ${dateObj.getMonth() + 1} 月` : '未知日期';
                                const dateId = dateObj ? `${dateObj.getFullYear()}.${dateObj.getMonth() + 1}` : '未知';

                                // 2. 判斷是否需要顯示日期刻度 (Header)
                                const showHeader = currentDateStr !== lastDateStr;
                                if (showHeader) lastDateStr = currentDateStr;

                                return (
                                    <div key={item.id} className="contents">
                                        {showHeader && (
                                            <div
                                                id={`date-header-${dateId}`}
                                                className="col-span-full mt-8 mb-2 flex items-center gap-4 scroll-mt-24"
                                            >
                                                <div className="bg-gray-900 text-white text-[10px] font-black px-3 py-1 rounded-full tracking-tighter uppercase shadow-sm">
                                                    {currentDateStr}
                                                </div>
                                                <div className="flex-1 h-px bg-gray-100"></div>
                                            </div>
                                        )}
                                        <div
                                            className={clsx(
                                                "bg-white border rounded-xl overflow-hidden group hover:shadow-md transition-all flex flex-col relative",
                                                isSelected ? "border-gray-800 ring-1 ring-gray-800" : "border-gray-100"
                                            )}
                                            onClick={() => item.id && toggleSelection(item.id)}
                                        >
                                            {/* 選取圓鈕 */}
                                            <div className={clsx(
                                                "absolute top-3 left-3 z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer shadow-sm",
                                                isSelected
                                                    ? "bg-blue-600 border-blue-600 scale-110"
                                                    : "bg-white/90 border-gray-300 opacity-0 group-hover:opacity-100"
                                            )}>
                                                {isSelected && (
                                                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                )}
                                            </div>

                                            {/* 縮圖 */}
                                            <div className="aspect-square relative overflow-hidden bg-gray-50">
                                                <NextImage
                                                    src={item.imageUrl}
                                                    alt={item.title || "Portfolio Image"}
                                                    fill
                                                    sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
                                                    className="object-contain transition-transform duration-500 group-hover:scale-105"
                                                />
                                                <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/60 backdrop-blur-md text-white text-[9px] uppercase tracking-widest rounded-sm">
                                                    {item.categoryName}
                                                </div>
                                            </div>

                                            {/* 文字 */}
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
                                                    <div className="flex items-center gap-1">
                                                        {/* 預覽 */}
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setSelectedItem(item); }}
                                                            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                            title="預覽照片"
                                                        >
                                                            <Maximize2 size={18} strokeWidth={2.5} />
                                                        </button>
                                                        {/* 移入回收區 */}
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); item.id && handleMoveToRecycle(item.id); }}
                                                            disabled={deletingId === item.id}
                                                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                            title="移入回收區"
                                                        >
                                                            {deletingId === item.id
                                                                ? <Loader2 size={18} strokeWidth={2.5} className="animate-spin" />
                                                                : <Trash2 size={18} strokeWidth={2.5} />}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            });
                        })()}
                    </div>
                </div>
            )}

            {/* 分頁 */}
            {
                totalPages > 1 && (
                    <div className="flex justify-center items-center gap-2 mt-8 flex-wrap">
                        <button
                            onClick={() => loadPage(currentPage - 1)}
                            disabled={currentPage === 1 || loading}
                            className={clsx("px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                                currentPage === 1 || loading ? "bg-gray-100 text-gray-300 cursor-not-allowed" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            )}
                        >←</button>
                        {getPageNumbers().map((page, index) => (
                            page === '...' ? (
                                <span key={`e-${index}`} className="px-2 text-gray-400">...</span>
                            ) : (
                                <button
                                    key={page}
                                    onClick={() => loadPage(page as number)}
                                    disabled={loading}
                                    className={clsx("px-4 py-2 rounded-lg text-sm font-semibold transition-all min-w-[40px]",
                                        currentPage === page ? "bg-gray-800 text-white shadow-md" : "bg-gray-100 text-gray-700 hover:bg-gray-200",
                                        loading && "opacity-50 cursor-not-allowed"
                                    )}
                                >{page}</button>
                            )
                        ))}
                        <button
                            onClick={() => loadPage(currentPage + 1)}
                            disabled={currentPage >= totalPages || loading}
                            className={clsx("px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                                currentPage >= totalPages || loading ? "bg-gray-100 text-gray-300 cursor-not-allowed" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            )}
                        >→</button>
                    </div>
                )
            }

            {/* ─── 回收區面板（摺疊，按需展開）──── */}
            <RecycleBin tenantId={tenantId} onRestored={() => { loadPage(1); loadCategoryCounts(); }} />

            {/* 底部浮動操作列（選取時顯示） */}
            {
                selectedIds.size > 0 && (
                    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-3 md:px-6 py-2 md:py-3 rounded-full shadow-2xl z-50 flex items-center gap-2 md:gap-6 animate-in slide-in-from-bottom-6 fade-in duration-300 max-w-[90vw]">
                        <span className="text-xs md:text-sm font-medium whitespace-nowrap">已選 {selectedIds.size} 項</span>
                        <div className="hidden md:block h-4 w-px bg-gray-700" />
                        <button
                            onClick={handleBatchRecycle}
                            disabled={isBatchRecycling}
                            className="flex items-center gap-1 md:gap-2 text-red-300 hover:text-red-200 transition-colors text-xs md:text-sm font-bold"
                        >
                            {isBatchRecycling
                                ? <Loader2 size={14} className="md:w-4 md:h-4 animate-spin" />
                                : <Trash2 size={14} className="md:w-4 md:h-4" />}
                            <span className="hidden sm:inline">移入回收區</span>
                            <span className="sm:hidden">移入</span>
                        </button>
                        <button onClick={() => setSelectedIds(new Set())} className="text-gray-500 hover:text-gray-300">
                            <div className="w-4 h-4 md:w-5 md:h-5 rounded-full border border-gray-500 flex items-center justify-center text-[10px]">✕</div>
                        </button>
                    </div>
                )
            }

            {/* Lightbox */}
            {
                selectedItem && (
                    <Lightbox
                        item={selectedItem}
                        items={filteredItems}
                        isAdmin={true}
                        onClose={() => setSelectedItem(null)}
                        onItemUpdate={(updatedItem) => {
                            setItems(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));
                            setSelectedItem(updatedItem);
                        }}
                        categories={categories}
                    />
                )
            }
        </div >
    );
}
