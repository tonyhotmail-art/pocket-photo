"use client";

import { useState, useEffect, useRef } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, where, limit } from "firebase/firestore";
import { Category, PortfolioItem } from "@/lib/schema";
import Sidebar from "@/components/Sidebar";
import MainGallery from "@/components/MainGallery";
import Lightbox from "@/components/Lightbox";
import AutoForm from "@/components/AutoForm";
import CategoryManager from "@/components/CategoryManager";
import WorkManager from "@/components/WorkManager";
import AdminManagement from "@/components/AdminManagement";
import LoginModal from "@/components/LoginModal";
import { useAuth } from "@/components/AuthContext";
import { Settings, Image as ImageIcon, Loader2, X, LogOut } from "lucide-react";
import { clsx } from "clsx";

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [selectedCategoryName, setSelectedCategoryName] = useState("all");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<PortfolioItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(20);
  const [hasMore, setHasMore] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number>(0);
  const isAtTop = useRef<boolean>(true);

  const { isAdmin, logout, user } = useAuth();

  // 消洗訊息過濾與自動開啟邏輯 (由下方移至此處以避免 TDZ 錯誤)
  const shouldOpenFirstItem = useRef(false);
  const autoNavStartIndex = useRef<number>(-1); // 記錄開始自動導覽的分類索引，防無限迴圈

  const handleAdminToggle = () => {
    if (isAdmin) {
      setShowAdmin(!showAdmin);
    } else {
      setShowLogin(true);
    }
  };

  // 讀取分類
  useEffect(() => {
    const q = query(
      collection(db, "categories"),
      where("visible", "==", true),
      orderBy("order", "asc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cats = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Category[];
      setCategories(cats);
    });
    return () => unsubscribe();
  }, []);

  // 讀取作品
  useEffect(() => {
    setLoading(true);
    let q = query(
      collection(db, "portfolio_items"),
      orderBy("categoryOrder", "asc"),
      orderBy("createdAt", "desc"),
      limit(displayLimit + 1)
    );

    if (selectedTag) {
      q = query(
        collection(db, "portfolio_items"),
        where("tags", "array-contains", selectedTag),
        orderBy("categoryOrder", "asc"),
        orderBy("createdAt", "desc"),
        limit(displayLimit + 1)
      );
    } else if (selectedCategoryName !== "all") {
      q = query(
        collection(db, "portfolio_items"),
        where("categoryName", "==", selectedCategoryName),
        orderBy("categoryOrder", "asc"),
        orderBy("createdAt", "desc"),
        limit(displayLimit + 1)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allItems = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PortfolioItem[];

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
  }, [selectedCategoryName, selectedTag, displayLimit]);

  useEffect(() => {
    setDisplayLimit(20);
  }, [selectedCategoryName, selectedTag]);

  const handleCategoryChange = (name: string) => {
    setSelectedCategoryName(name);
    setSelectedTag(null);
    autoNavStartIndex.current = -1;
    shouldOpenFirstItem.current = false;
  };

  useEffect(() => {
    if (showAdmin || selectedItem) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [showAdmin, selectedItem]);

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

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'AUTO_OPEN_FIRST_ITEM') {
        shouldOpenFirstItem.current = true;
        if (selectedCategoryName !== "all") {
          const idx = categories.findIndex(c => c.name === selectedCategoryName);
          if (idx !== -1) autoNavStartIndex.current = idx;
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [categories, selectedCategoryName]);

  useEffect(() => {
    if (shouldOpenFirstItem.current && !loading) {
      if (items.length > 0) {
        setSelectedItem(items[0]);
        shouldOpenFirstItem.current = false;
        autoNavStartIndex.current = -1;
      }
      else if (selectedCategoryName !== "all" && categories.length > 0) {
        const currentIndex = categories.findIndex(c => c.name === selectedCategoryName);
        if (currentIndex !== -1) {
          const nextIndex = (currentIndex + 1) % categories.length;
          if (nextIndex === autoNavStartIndex.current) {
            shouldOpenFirstItem.current = false;
            autoNavStartIndex.current = -1;
            return;
          }
          const nextCategory = categories[nextIndex];
          setSelectedCategoryName(nextCategory.name);
          setDisplayLimit(20);
        }
      }
    }
  }, [items, loading, categories, selectedCategoryName]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      touchStartY.current = e.touches[0].clientY;
      isAtTop.current = true;
    } else {
      isAtTop.current = false;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isAtTop.current || isRefreshing) return;
    const currentY = e.touches[0].clientY;
    const distance = currentY - touchStartY.current;
    if (distance > 0 && window.scrollY === 0) {
      const dampedDistance = Math.min(distance * 0.4, 80);
      setPullDistance(dampedDistance);
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance > 60 && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(40);
      setDisplayLimit(20);
      await new Promise(resolve => setTimeout(resolve, 800));
      setIsRefreshing(false);
      setPullDistance(0);
    } else {
      setPullDistance(0);
    }
  };

  const handleItemUpdate = (updatedItem: PortfolioItem) => {
    setItems(prevItems =>
      prevItems.map(item => item.id === updatedItem.id ? updatedItem : item)
    );
    if (selectedItem?.id === updatedItem.id) {
      setSelectedItem(updatedItem);
    }
  };

  return (
    <main
      className="min-h-screen bg-[#F8F7F3] text-[#1A1A1A] font-serif transition-transform duration-200"
      style={{ transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : 'none' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* 下拉圖示 */}
      {pullDistance > 10 && (
        <div
          className="fixed top-0 left-0 right-0 flex justify-center items-center pointer-events-none z-50 transition-opacity"
          style={{
            height: `${pullDistance}px`,
            opacity: Math.min(pullDistance / 40, 1),
            transform: `translateY(-${Math.max(0, 40 - pullDistance)}px)`
          }}
        >
          <div className={clsx(
            "bg-white shadow-lg rounded-full p-2 text-gray-400 transition-transform",
            isRefreshing ? "animate-spin" : ""
          )}
            style={{ transform: !isRefreshing ? `rotate(${pullDistance * 5}deg)` : 'none' }}
          >
            <Loader2 size={20} />
          </div>
        </div>
      )}

      {/* Mobile Top Bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#F8F7F3]/80 backdrop-blur-md border-b border-gray-100 z-30 flex items-center justify-center px-6">
        <h1 className="text-xl font-bold tracking-tighter">KELLY PHOTO</h1>
      </div>

      <Sidebar
        categories={categories}
        selectedCategoryName={selectedCategoryName}
        onSelectCategory={handleCategoryChange}
      />

      <div className="lg:pl-[100px] relative pt-32 lg:pt-0">
        {selectedTag && (
          <div className="pt-12 px-6 md:px-12 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center gap-3 text-gray-400 font-serif">
              <span className="text-xs uppercase tracking-[0.3em] font-bold">正在搜尋標籤</span>
              <div className="flex items-center bg-white border border-gray-100 px-3 py-1 rounded-full shadow-sm gap-2">
                <span className="text-sm font-bold text-[#1A1A1A]">#{selectedTag}</span>
                <button
                  onClick={() => setSelectedTag(null)}
                  className="p-0.5 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X size={14} className="text-gray-400 hover:text-red-500" />
                </button>
              </div>
            </div>
          </div>
        )}

        {loading && items.length === 0 ? (
          <div className="h-[80vh] flex items-center justify-center">
            <Loader2 className="animate-spin text-gray-300" size={32} />
          </div>
        ) : (
          <>
            <MainGallery
              items={items}
              onItemClick={setSelectedItem}
              onCategoryClick={handleCategoryChange}
              onTagClick={setSelectedTag}
            />
            <div ref={observerTarget} className="h-20 flex items-center justify-center">
              {hasMore && loading && (
                <Loader2 className="animate-spin text-gray-200" size={24} />
              )}
            </div>
          </>
        )}

        {!loading && items.length === 0 && (
          <div className="h-[60vh] flex flex-col items-center justify-center text-gray-400">
            <ImageIcon size={48} strokeWidth={1} className="mb-4 opacity-20" />
            <p className="tracking-widest text-sm">此分類或標籤尚無作品展示</p>
          </div>
        )}

        <footer className="py-20 px-6 md:px-12 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center md:items-end gap-8 opacity-50">
          <div className="text-center md:text-left">
            <h4 className="text-xl font-bold tracking-tighter">KELLY PHOTO</h4>
            <p className="text-xs uppercase tracking-widest mt-2">Makeup Artist Portfolio</p>
          </div>
          <p className="text-[10px] uppercase tracking-tighter">
            © {new Date().getFullYear()} DESIGNED BY TONY / ALL RIGHTS RESERVED
          </p>
        </footer>
      </div>

      <Lightbox
        item={selectedItem}
        items={items}
        isAdmin={isAdmin}
        onClose={() => setSelectedItem(null)}
        onCategoryClick={handleCategoryChange}
        onTagClick={setSelectedTag}
        onLoadMore={() => {
          if (hasMore && !loading) {
            setDisplayLimit(prev => prev + 20);
          }
        }}
        hasMore={hasMore}
        onReachEnd={() => {
          if (selectedCategoryName !== "all" && categories.length > 0) {
            const currentIndex = categories.findIndex(c => c.name === selectedCategoryName);
            if (currentIndex !== -1) {
              if (autoNavStartIndex.current === -1) {
                autoNavStartIndex.current = currentIndex;
              }
              const nextIndex = (currentIndex + 1) % categories.length;
              if (nextIndex === autoNavStartIndex.current) {
                autoNavStartIndex.current = -1;
                return;
              }
              const nextCategory = categories[nextIndex];
              setSelectedCategoryName(nextCategory.name);
              setDisplayLimit(20);
              window.postMessage({ type: 'AUTO_OPEN_FIRST_ITEM' }, '*');
            }
          }
        }}
        categories={categories}
        onItemUpdate={handleItemUpdate}
      />

      <button
        onClick={handleAdminToggle}
        className={clsx(
          "fixed bottom-8 right-8 p-3 shadow-xl rounded-full hover:scale-110 transition-transform z-50",
          isAdmin ? "bg-black text-white" : "bg-white text-[#1A1A1A]"
        )}
      >
        <Settings size={24} strokeWidth={1.5} />
      </button>

      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onSuccess={() => {
            setShowLogin(false);
            setShowAdmin(true);
          }}
        />
      )}

      {showAdmin && isAdmin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-0 md:p-4">
          <div className="bg-white w-full md:max-w-7xl h-full md:h-auto md:max-h-[95vh] md:rounded-2xl shadow-2xl relative flex flex-col overflow-hidden">
            <div className="p-5 md:p-6 border-b flex justify-between items-center bg-white z-10">
              <div className="flex items-center gap-4">
                <h2 className="text-xl md:text-2xl font-bold">後台管理控制面板</h2>
                {user && (
                  <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded text-gray-500 font-sans tracking-tight">
                    ADMIN: {user.email || user.displayName || "手動授權"}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    logout();
                    setShowAdmin(false);
                  }}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors flex items-center gap-2 text-sm"
                  title="登出管理員"
                >
                  <LogOut size={20} />
                  <span className="hidden md:inline">登出</span>
                </button>
                <button
                  onClick={() => setShowAdmin(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors font-sans"
                  aria-label="關閉管理介面"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <div
              className="p-4 md:p-6 overflow-y-auto flex-1 custom-scrollbar"
              onWheel={(e) => e.stopPropagation()}
            >
              <div className="space-y-12">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12">
                  <section className="lg:col-span-12 xl:col-span-5">
                    <CategoryManager />
                  </section>
                  <section className="lg:col-span-12 xl:col-span-7">
                    <AutoForm />
                  </section>
                </div>

                <hr className="border-gray-100" />
                <section>
                  <WorkManager />
                </section>

                <hr className="border-gray-100" />
                <section className="pb-8">
                  <AdminManagement />
                </section>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
