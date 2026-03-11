"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { auth as firebaseAuth } from "@/lib/firebase";
import { signInWithCustomToken, signOut as firebaseSignOut, onAuthStateChanged } from "firebase/auth";
import { UserRole } from "@/lib/role-hierarchy";

interface AuthContextType {
    userRole: UserRole | null;
    userTenantSlug: string | null;
    isStaffRole: boolean;
    isAuthenticated: boolean;
    loading: boolean;
    firebaseReady: boolean;
    logout: () => Promise<void>;
    clerkUserId: string | null;
    userEmail: string | null;
    userName: string | null;
    userPhotoUrl: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const { user, isLoaded } = useUser();
    const { signOut } = useClerk();
    const [userRole, setUserRole] = useState<UserRole | null>(null);
    const [userTenantSlug, setUserTenantSlug] = useState<string | null>(null);
    const [firebaseReady, setFirebaseReady] = useState(false);
    const [roleChecked, setRoleChecked] = useState(false);
    // 防止重複呼叫 firebase-token API
    const firebaseSyncRef = useRef<string | null>(null);

    const isStaffRole = userRole === "system_admin" || userRole === "store_admin";

    /**
     * 觸發後端 sync-role API，將管理員標記寫入 Clerk publicMetadata（補水管 A）
     */
    const syncRoleToClerk = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/sync-role", { method: "POST" });
            if (res.ok) {
                console.log("[AuthContext] ✅ Clerk Metadata 同步完成");
            }
        } catch (err) {
            console.error("[AuthContext] Clerk Metadata 同步失敗:", err);
        }
    }, []);

    /**
     * 透過後端 API 查驗管理員權限
     * 不再從客戶端直接查詢 Firestore admins 集合，避免非管理者觸發 permission-denied
     */
    const checkAdminStatus = useCallback(async (
        userId: string,
        email: string | null | undefined,
        publicMetadata: Record<string, unknown>
    ): Promise<UserRole | null> => {

        console.log("[AuthContext] 正在透過後端 API 嚴格驗證管理員權限...");

        try {
            const res = await fetch("/api/admin/sync-role", { method: "POST" });

            if (res.ok) {
                // 後端名冊查驗通過，從回傳的最新 Clerk metadata 讀取角色
                // 重新讀取 user 的 publicMetadata（sync-role 可能已更新）
                const pmRole = publicMetadata?.role as string;
                console.log(`[AuthContext] ✅ 後端名冊驗證通過！角色: ${pmRole || 'store_admin'}`);

                if (pmRole === 'system_admin' || pmRole === 'admin') return 'system_admin';
                return 'store_admin';
            } else {
                // 被後端打槍 (403)，名冊裡沒這個人
                console.log("[AuthContext] 此帳號非管理員，角色設為一般使用者");
                return 'customer';
            }
        } catch (error) {
            console.error("[AuthContext] 權限驗證失敗，安全降級為一般使用者:", error);
            return 'customer';
        }
    }, []);

    /**
     * Firebase 同步登入：Clerk 登入後取得 Custom Token 並登入 Firebase
     */
    const syncFirebaseAuth = useCallback(async (clerkUserId: string) => {
        if (firebaseSyncRef.current === clerkUserId) return;
        firebaseSyncRef.current = clerkUserId;

        try {
            console.log("[AuthContext] 🔥 呼叫 /api/auth/firebase-token 取得 Custom Token...");
            const res = await fetch("/api/auth/firebase-token", { method: "POST" });
            if (!res.ok) {
                console.error("[AuthContext] firebase-token API 回傳錯誤:", res.status);
                setFirebaseReady(true);
                return;
            }
            const { token } = await res.json();
            await signInWithCustomToken(firebaseAuth, token);
            console.log("[AuthContext] ✅ Firebase 同步登入成功");
            setFirebaseReady(true);
        } catch (error) {
            console.error("[AuthContext] 🚨 Firebase 同步登入失敗:", error);
            setFirebaseReady(true); // 失敗也設為 ready
        }
    }, []);

    // Clerk 使用者狀態變更時，重新確認管理員資格 + 同步 Firebase
    useEffect(() => {
        if (!isLoaded) return;

        if (user) {
            const email = user.emailAddresses[0]?.emailAddress;
            const metadata = (user.publicMetadata ?? {}) as Record<string, unknown>;

            // 從新 SaaS 架構的 appAccess.photo_slug 讀取，相容舊版 tenantSlug
            const appAccess = metadata.appAccess as Record<string, string> | undefined;
            const slug = appAccess?.photo_slug ?? (metadata.tenantSlug as string) ?? null;
            setUserTenantSlug(slug);

            // 如果使用者剛完成登入或同步，且人在首頁，直接將其跳轉回專屬相本管理頁面
            if (slug && window.location.pathname === '/') {
                console.log(`[AuthContext] 偵測到已有店鋪綁定 (${slug})，將從首頁自動跳轉...`);
                window.location.replace(`/${slug}`);
            }

            // 重要：先完成 Firebase 登入，再進行角色檢查
            // 確保兩者都完成後才解除 loading，避免在過渡期觸發 Firestore 查詢
            setRoleChecked(false);
            syncFirebaseAuth(user.id).then(() => {
                // Firebase 登入完成後才檢查管理員資格
                checkAdminStatus(user.id, email, metadata).then(role => {
                    setUserRole(role);
                    setRoleChecked(true);
                });
            });
        } else {
            setUserRole(null);
            setUserTenantSlug(null);
            setFirebaseReady(true);
            setRoleChecked(true);
            firebaseSyncRef.current = null;

            // Clerk 登出時，同步登出 Firebase
            firebaseSignOut(firebaseAuth).catch((err) => {
                console.error("[AuthContext] Firebase 登出失敗:", err);
            });
        }
    }, [user, isLoaded, checkAdminStatus, syncFirebaseAuth]);

    // 監聽 Firebase Auth 狀態變化（用於偵錯）
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(firebaseAuth, (fbUser) => {
            if (fbUser) {
                console.log("[AuthContext] 🔥 Firebase Auth 已登入:", fbUser.uid);
            } else {
                console.log("[AuthContext] 🔥 Firebase Auth 未登入");
            }
        });
        return () => unsubscribe();
    }, []);

    const logout = async () => {
        try {
            await signOut();
            await firebaseSignOut(firebaseAuth);
            setUserRole(null);
            setUserTenantSlug(null);
            firebaseSyncRef.current = null;
        } catch (error) {
            console.error("登出失敗:", error);
        }
    };

    const email = user?.emailAddresses[0]?.emailAddress ?? null;

    return (
        <AuthContext.Provider value={{
            userRole,
            userTenantSlug,
            isStaffRole,
            isAuthenticated: !!user,
            loading: !isLoaded || (!!user && (!firebaseReady || !roleChecked)),
            firebaseReady,
            logout,
            clerkUserId: user?.id ?? null,
            userEmail: email,
            userName: user?.fullName ?? user?.firstName ?? null,
            userPhotoUrl: user?.imageUrl ?? null,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

/**
 * useAuth Hook
 */
export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
