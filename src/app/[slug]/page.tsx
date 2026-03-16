"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import NextImage from "next/image";
import { SignInButton } from "@clerk/nextjs";
import UserCardDropdown from "@/components/UserCardDropdown";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, where, limit, getDoc, getDocs, doc } from "firebase/firestore";
import { Category, PortfolioItem } from "@/lib/schema";
import Sidebar from "@/components/Sidebar";
import MainGallery from "@/components/MainGallery";
import Lightbox from "@/components/Lightbox";
import AutoForm from "@/components/AutoForm";
import CategoryManager from "@/components/CategoryManager";
import WorkManager from "@/components/WorkManager";
import AdminManagement from "@/components/AdminManagement";
import { useAuth } from "@/components/AuthContext";
import { accessConfig } from "@/lib/config";
import { Settings, Image as ImageIcon, Loader2, X, LogOut, MessageCircle, Share2, SlidersHorizontal } from "lucide-react";
import { clsx } from "clsx";
import { useSearchParams, useParams } from "next/navigation";
import SystemSettings, { useSystemSettings } from "@/components/SystemSettings";
import CameraUploadButton from "@/components/CameraUploadButton";


function HomeContent() {
  const params = useParams();
  const slug = params?.slug as string;
  // 從 tenants 集合解析 slug → 真實 tenantId（不需登入）
  const [resolvedTenantId, setResolvedTenantId] = useState<string>(slug);

  useEffect(() => {
    /** @description 查詢 Firestore tenants 集合，將網址 slug 映射為永久身分證 tenantId */
    const resolveSlug = async () => {
      try {
        const q = query(collection(db, "tenants"), where("slug", "==", slug));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const realId = snap.docs[0].data().tenantId;
          setResolvedTenantId(realId);
          console.log(`[page] ✅ Slug 解析成功：${slug} → ${realId}`);
        } else {
          // NOTE: 查無對應文件時，維持 slug 本身（例如 kelly → kelly）
          console.log(`[page] ⚠️ 查無 slug 對應，維持原值：${slug}`);
        }
      } catch (err) {
        console.error("[page] Slug 解析失敗:", err);
      }
    };
    resolveSlug();
  }, [slug]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [selectedCategoryName, setSelectedCategoryName] = useState("all");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<PortfolioItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdmin, setShowAdmin] = useState(false);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(20);
  const [hasMore, setHasMore] = useState(false);
  const [isWorkManagerEnabled, setIsWorkManagerEnabled] = useState(false); // 延遲載入 WorkManager
  const observerTarget = useRef<HTMLDivElement>(null);

  const { isStaffRole, isAuthenticated, logout, userName, userPhotoUrl, loading: authLoading } = useAuth();
  const { settings: siteSettings } = useSystemSettings(); // 前台功能設定
  const searchParams = useSearchParams();
  const initialPhotoId = searchParams.get("id");
  const hasAutoOpened = useRef(false);

  // 當網址有 id 時，讀取該張照片
  useEffect(() => {
    if (initialPhotoId && !hasAutoOpened.current) {
      const fetchInitialItem = async () => {
        try {
          const docRef = doc(db, "portfolio_items", initialPhotoId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data() as PortfolioItem;
            // 權限檢查：若是待分類照片且使用者非管理員，則不開放開啟
            if (data.categoryName === "待分類照片" && !isStaffRole) {
              console.warn("存取受限：未分類照片僅限管理員查看");
              return;
            }
            setSelectedItem({ id: docSnap.id, ...data });
            hasAutoOpened.current = true;
          }
        } catch (error) {
          console.error("讀取初始照片失敗:", error);
        }
      };
      fetchInitialItem();
    }
  }, [initialPhotoId]);

  // 消洗訊息過濾與自動開啟邏輯 (由下方移至此處以避免 TDZ 錯誤)
  const shouldOpenFirstItem = useRef(false);
  const autoNavStartIndex = useRef<number>(-1); // 記錄開始自動導覽的分類索引，防無限迴圈

  // handleAdminToggle：已登入管理員直接開啟面板，
  // 未登入時由 <SignInButton> 元件負責觸發 Clerk 登入視窗
  const handleAdminToggle = () => {
    if (isStaffRole) {
      setShowAdmin(!showAdmin);
    }
    // NOTE: 未登入時的登入觸發由下方 JSX 的 <SignInButton> 包裝負責
  };

  // 讀取分類（等待認證完成後再查詢，避免 Firebase Auth 還沒同步就觸發 Firestore 規則檢查）
  useEffect(() => {
    if (authLoading) return;

    let q = query(
      collection(db, "categories"),
      where("visible", "==", true),
      where("tenantId", "==", resolvedTenantId),
      orderBy("order", "asc")
    );

    // 若非管理員，由後端主動排除待分類標籤
    if (!isStaffRole) {
      q = query(
        collection(db, "categories"),
        where("visible", "==", true),
        where("tenantId", "==", resolvedTenantId),
        where("name", "!=", "待分類照片"),
        orderBy("name"), // 必須在首位 (不等於查詢的欄位)
        orderBy("order", "asc")
      );
    }

    // 省略中間部分重構... 因為我們只要替換 accessConfig.tenantId

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cats = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Category[];
      // 過濾掉回收區分類，不顯示在側邊欄
      setCategories(cats.filter(cat => cat.name !== "__回收區__"));
    });
    return () => unsubscribe();
  }, [isStaffRole, authLoading, resolvedTenantId]);

  // 讀取作品（等待認證完成後再查詢）
  useEffect(() => {
    if (authLoading) return;

    setLoading(true);
    let q;

    if (selectedTag) {
      q = query(
        collection(db, "portfolio_items"),
        where("tenantId", "==", resolvedTenantId),
        where("tags", "array-contains", selectedTag),
        orderBy("categoryOrder", "asc"),
        orderBy("createdAt", "desc"),
        limit(displayLimit + 1)
      );
    } else if (selectedCategoryName !== "all") {
      q = query(
        collection(db, "portfolio_items"),
        where("tenantId", "==", resolvedTenantId),
        where("categoryName", "==", selectedCategoryName),
        orderBy("categoryOrder", "asc"),
        orderBy("createdAt", "desc"),
        limit(displayLimit + 1)
      );
    } else {
      // 全部作品 (all)
      if (isStaffRole) {
        q = query(
          collection(db, "portfolio_items"),
          where("tenantId", "==", resolvedTenantId),
          orderBy("categoryOrder", "asc"),
          orderBy("createdAt", "desc"),
          limit(displayLimit + 1)
        );
      } else {
        // 非管理員：由資料庫層級排除「待分類照片」
        q = query(
          collection(db, "portfolio_items"),
          where("tenantId", "==", resolvedTenantId),
          where("categoryName", "!=", "待分類照片"),
          orderBy("categoryName"), // 必須在首位
          orderBy("categoryOrder", "asc"),
          orderBy("createdAt", "desc"),
          limit(displayLimit + 1)
        );
      }
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let allItems = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PortfolioItem[];

      // 如果選擇的分類是全部，在客戶端將回收區的照片過濾掉
      if (selectedCategoryName === "all") {
        allItems = allItems.filter(item => item.categoryName !== "__回收區__");
      }

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
  }, [selectedCategoryName, selectedTag, displayLimit, isStaffRole, authLoading, resolvedTenantId]);

  // 動態更新網頁標題
  useEffect(() => {
    if (siteSettings && siteSettings.siteName) {
      document.title = `口袋相片 | ${siteSettings.siteName}`;
    }
  }, [siteSettings?.siteName]);

  // 移除獨立的 setDisplayLimit useEffect，改為在 handleCategoryChange 內合併處理
  /* 
  useEffect(() => {
    setDisplayLimit(20);
  }, [selectedCategoryName, selectedTag]); 
  */

  const handleCategoryChange = (name: string) => {
    setSelectedCategoryName(name);
    setSelectedTag(null);
    setDisplayLimit(20); // 直接在此重置分頁限額，避免觸發額外的 useEffect
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
      // 安全性檢查：只接受來自同一網域的訊息
      if (event.origin !== window.location.origin) return;

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
      className="min-h-screen bg-[#F8F7F3] text-[#1A1A1A] font-serif"
    >

      {/* Mobile Top Bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#F8F7F3]/80 backdrop-blur-md border-b border-gray-100 z-30 flex items-center justify-center px-6">
        <h1 className="text-xl font-bold tracking-tighter truncate max-w-[70%]">{siteSettings?.siteName || "Pocket Photo"}</h1>
        {siteSettings.allowSharing && (
          <button
            onClick={() => {
              const url = `${window.location.origin}${window.location.pathname}`;
              if (navigator.share) {
                navigator.share({
                  title: `Pocket Photo 口袋相片`,
                  url: url
                }).catch(console.error);
              } else if (navigator.clipboard) {
                navigator.clipboard.writeText(url);
                alert("網址已複製到剪貼簿");
              } else {
                alert("您的瀏覽器不支援自動複製，請手動複製網址：" + url);
              }
            }}
            className="absolute right-4 w-9 h-9 flex items-center justify-center bg-white text-[#555555] shadow-sm border border-gray-200 rounded-full hover:scale-105 transition-transform"
            title="分享整個作品集"
          >
            <Share2 className="w-4 h-4" strokeWidth={1.5} />
          </button>
        )}
      </div>

      {/* 分享按鈕 Desktop (置於右上角) */}
      <div className="hidden lg:flex fixed top-8 right-8 z-40">
        {siteSettings.allowSharing && (
          <button
            onClick={() => {
              const url = `${window.location.origin}${window.location.pathname}`;
              if (navigator.share) {
                navigator.share({
                  title: `Pocket Photo 口袋相片`,
                  url: url
                }).catch(console.error);
              } else if (navigator.clipboard) {
                navigator.clipboard.writeText(url);
                alert("網址已複製到剪貼簿");
              } else {
                alert("您的瀏覽器不支援自動複製，請手動複製網址：" + url);
              }
            }}
            className="w-11 h-11 bg-white text-[#555555] shadow-xl rounded-full hover:scale-110 transition-transform border border-gray-200 flex items-center justify-center"
            title="分享整個作品集"
          >
            <Share2 className="w-5 h-5" strokeWidth={1.5} />
          </button>
        )}
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
              showTimeline={siteSettings.showTimeline}
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

        <footer className="fixed bottom-0 left-0 right-0 lg:left-[100px] z-30 px-6 md:px-12 py-3 border-t border-gray-200/60 bg-[#F8F7F3]/80 backdrop-blur-md flex flex-row justify-between items-center">
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
        isAdmin={isStaffRole}
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
        allowSharing={siteSettings.allowSharing}
      />

      {/* 右下角功能按鈕組群 - 登入者圖示置頂 */}
      <div className="fixed bottom-6 right-6 md:bottom-8 md:right-8 flex flex-col gap-3 z-40 items-center">

        {/* 0. 管理員圖示（最上方）— 應要求暫時隱藏並替換位置
        {isStaffRole && (
          <UserCardDropdown size={44} afterSignOutUrl="/" />
        )}
        */}

        {/* 1. 相機拍照上傳（本機/管理員專用，放大處理） */}
        {isStaffRole && (
          <CameraUploadButton
            tenantId={resolvedTenantId}
            className="w-16 h-16 bg-black text-white border-2 border-white/20 shadow-2xl hover:bg-gray-900"
            iconProps={{ size: 28, strokeWidth: 2 }}
          />
        )}



        {/* 3. 聯繫 LINE@（僅在後台有設定時顯示） */}
        {siteSettings.lineUrl && (
          <a
            href={siteSettings.lineUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-11 h-11 bg-[#00B900] text-white shadow-xl rounded-full hover:scale-110 transition-transform flex items-center justify-center"
            title="聯繫 LINE@"
          >
            <MessageCircle className="w-5 h-5" strokeWidth={2} />
          </a>
        )}

        {/* 4. 管理員設定入口（最下方）— 管理員可見，未登入者可見登入按鈕 */}
        {isStaffRole ? (
          <button
            onClick={handleAdminToggle}
            className="w-11 h-11 shadow-xl rounded-full hover:scale-110 transition-transform flex items-center justify-center border bg-[#1A1A1A] text-white border-[#1A1A1A]"
            title="管理面板"
          >
            <Settings className="w-5 h-5" strokeWidth={1.5} />
          </button>
        ) : !isAuthenticated ? (
          <SignInButton mode="modal">
            <button
              className="w-11 h-11 shadow-xl rounded-full hover:scale-110 transition-transform flex items-center justify-center border bg-white text-[#888888] border-gray-200"
              title="管理員登入"
            >
              <Settings className="w-5 h-5" strokeWidth={1.5} />
            </button>
          </SignInButton>
        ) : null}
      </div>

      {showAdmin && isStaffRole && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4 touch-none overscroll-none">
          <div className="bg-white w-full h-[100dvh] md:h-auto md:max-h-[95vh] md:max-w-7xl md:rounded-2xl shadow-2xl relative flex flex-col overflow-hidden">

            {/* 管理面板 Header：深灰底色，日式極簡樣式 */}
            <div className="px-5 py-4 md:px-6 md:py-5 border-b border-[#2a2a2a] flex justify-between items-center bg-[#1A1A1A] z-10">
              <div className="flex items-center gap-3">
                <span className="text-[10px] tracking-[0.3em] uppercase text-[#888888] font-light">Admin</span>
                <span className="text-[#444444]">|</span>
                <h2 className="text-sm md:text-base font-medium text-white tracking-wide">後台管理</h2>
                {userName && (
                  /* 頭像可點擊，展開同款使用者選單（不需遮罩，因為已在 Modal 內） */
                  <UserCardDropdown size={28} afterSignOutUrl="/" noBackdrop />
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    logout();
                    setShowAdmin(false);
                  }}
                  className="flex items-center gap-1.5 text-xs text-[#888888] hover:text-white hover:bg-[#2a2a2a] px-3 py-2 rounded-lg transition-colors"
                  title="登出管理員"
                >
                  <LogOut size={14} />
                  <span className="hidden md:inline tracking-wide">登出</span>
                </button>
                <button
                  onClick={() => setShowAdmin(false)}
                  className="w-8 h-8 flex items-center justify-center text-[#666666] hover:text-white hover:bg-[#2a2a2a] rounded-lg transition-colors"
                  aria-label="關閉管理介面"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div
              className="p-4 md:p-6 overflow-y-auto flex-1 custom-scrollbar overscroll-contain touch-pan-y"
              onWheel={(e) => e.stopPropagation()}
            >
              <div className="space-y-12">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12">
                  <section className="lg:col-span-12 xl:col-span-5">
                    <CategoryManager tenantId={resolvedTenantId} />
                  </section>
                  <section className="lg:col-span-12 xl:col-span-7">
                    <AutoForm tenantId={resolvedTenantId} />
                  </section>
                </div>

                <hr className="border-gray-100" />
                <section>
                  <SystemSettings tenantId={resolvedTenantId} />
                </section>

                {/* 
                  [暫時停用] 管理員名單功能
                  停用原因：目前為單人管理相本模式，不需要管理員名單。
                  恢復時機：未來開放「多人共同管理同一相本」功能時，取消以下註解即可恢復。
                  安全考量：不渲染此元件可避免前端打包，防止透過瀏覽器開發者工具查看。
                <hr className="border-gray-100" />
                <section>
                  <AdminManagement />
                </section>
                */}

                <hr className="border-gray-100" />
                <section className="pb-12">
                  <div className="flex flex-col items-center gap-6">
                    {!isWorkManagerEnabled ? (
                      <div className="w-full py-20 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200 flex flex-col items-center justify-center group hover:bg-white hover:border-gray-300 transition-all duration-500">
                        <div className="p-4 bg-white shadow-xl shadow-gray-200/50 rounded-2xl mb-6 group-hover:scale-110 transition-transform duration-500">
                          <ImageIcon className="text-gray-400 group-hover:text-gray-900" size={32} />
                        </div>
                        <h4 className="text-lg font-bold text-gray-900 mb-2">批次管理作品</h4>
                        <p className="text-sm text-gray-400 mb-8 max-w-xs text-center leading-relaxed">
                          預設不載入大量照片以節省頻寬。點擊下方按鈕即可開始進行批次刪除與分類調整。
                        </p>
                        <button
                          onClick={() => setIsWorkManagerEnabled(true)}
                          className="px-10 py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-black transition-all shadow-xl shadow-gray-200 active:scale-95 flex items-center gap-3"
                        >
                          <Settings size={20} className="animate-pulse" />
                          進入批次管理面板
                        </button>
                      </div>
                    ) : (
                      <div className="w-full animate-in fade-in slide-in-from-bottom-8 duration-700">
                        <div className="flex items-center justify-between mb-8">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gray-900 rounded-2xl flex items-center justify-center text-white">
                              <ImageIcon size={24} />
                            </div>
                            <div>
                              <h3 className="text-xl font-bold text-gray-900">照片批次管理</h3>
                              <p className="text-sm text-gray-400">目前已加載作品清單</p>
                            </div>
                          </div>
                          <button
                            onClick={() => setIsWorkManagerEnabled(false)}
                            className="text-xs text-gray-400 hover:text-gray-900 transition-colors uppercase tracking-widest font-bold"
                          >
                            收合控制面板
                          </button>
                        </div>
                        <WorkManager tenantId={resolvedTenantId} />
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center bg-[#F8F7F3]">
        <Loader2 className="animate-spin text-gray-300" size={32} />
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
