"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { auth as firebaseAuth } from "@/lib/firebase";
import { signInWithCustomToken, signOut as firebaseSignOut, onAuthStateChanged } from "firebase/auth";
import { UserRole } from "@/lib/role-hierarchy";
import { syncAdminRoleAction } from "@/actions/admin";

interface AuthContextType {
    userRole: UserRole | null;
    userTenantSlug: string | null;
    userTenantId: string | null; // 新增：真正的身分證號 (TenantId)
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
    const [userTenantId, setUserTenantId] = useState<string | null>(null);
    const [firebaseReady, setFirebaseReady] = useState(false);
    const [roleChecked, setRoleChecked] = useState(false);
    const firebaseSyncRef = useRef<string | null>(null);

    const isStaffRole = userRole === "system_admin" || userRole === "store_admin";

    // 從 Slug 查詢真正的 TenantId (身分證)
    const fetchTenantId = useCallback(async (slug: string) => {
        try {
            const { collection, query, where, getDocs } = await import("firebase/firestore");
            const { db } = await import("@/lib/firebase");
            const q = query(collection(db, "tenants"), where("slug", "==", slug));
            const snap = await getDocs(q);
            if (!snap.empty) {
                const id = snap.docs[0].data().tenantId;
                setUserTenantId(id);
                console.log(`[AuthContext] ✅ 租戶識別成功：${slug} -> ${id}`);
            } else {
                setUserTenantId(slug); // 回退機制
                console.log(`[AuthContext] ⚠️ 找不到租戶登記，回退使用 Slug：${slug}`);
            }
        } catch (err) {
            console.error("[AuthContext] 查詢租戶資訊失敗:", err);
            setUserTenantId(slug);
        }
    }, []);

    const syncRoleToClerk = useCallback(async () => {
        try {
            // 呼叫 Server Action 同步權限
            const res = await syncAdminRoleAction();
            if (res.success) {
                console.log("[AuthContext] ✅ 權限同步完成");
            } else {
                console.log("[AuthContext] 權限同步結果:", res);
            }
        } catch (err) {
            console.error("[AuthContext] Clerk Metadata 同步失敗:", err);
        }
    }, []);

    const checkAdminStatus = useCallback(async (
        userId: string,
        email: string | null | undefined,
        publicMetadata: Record<string, unknown>
    ): Promise<UserRole | null> => {
        // 🚀 優先權 1：直接讀取 Clerk Metadata (最快且最可靠的身分來源)
        const pmRole = publicMetadata?.role as string | undefined;
        if (pmRole === 'system_admin' || pmRole === 'admin') {
            console.log("[AuthContext] 👑 偵測到系統管理員身分 (來自 Metadata)");
            return 'system_admin';
        }

        try {
            // 🚀 優先權 2：進行角色同步與二次確認
            const res = await syncAdminRoleAction();
            if (res.success) {
                if (pmRole === 'store_admin') return 'store_admin';
                // 如果後台同步成功，預設至少是 store_admin (視 Metadata 而定)
                return pmRole as UserRole || 'store_admin';
            } else {
                console.warn("[AuthContext] ⚠️ 角色同步 API 回傳失敗，回退至 Metadata 判斷");
                return (pmRole as UserRole) || 'customer';
            }
        } catch (error) {
            console.error("[AuthContext] ❌ 角色同步發生錯誤:", error);
            return (pmRole as UserRole) || 'customer';
        }
    }, []);

    const syncFirebaseAuth = useCallback(async (clerkUserId: string) => {
        if (firebaseSyncRef.current === clerkUserId) return;
        firebaseSyncRef.current = clerkUserId;
        try {
            const res = await fetch("/api/auth/firebase-token", { method: "POST" });
            if (!res.ok) {
                setFirebaseReady(true);
                return;
            }
            const { token } = await res.json();
            await signInWithCustomToken(firebaseAuth, token);
            setFirebaseReady(true);
        } catch (error) {
            setFirebaseReady(true);
        }
    }, []);

    useEffect(() => {
        if (!isLoaded) return;

        if (user) {
            const email = user.emailAddresses[0]?.emailAddress;
            const metadata = (user.publicMetadata ?? {}) as Record<string, unknown>;
            const appAccess = metadata.appAccess as Record<string, string> | undefined;
            const slug = appAccess?.photo_slug ?? (metadata.tenantSlug as string) ?? null;

            setUserTenantSlug(slug);

            // 啟動連鎖同步：Firebase -> Role -> TenantId
            setRoleChecked(false);
            setFirebaseReady(false);

            syncFirebaseAuth(user.id).then(async () => {
                // Firebase 已登入成功，此時才有權限讀取 Firestore
                if (slug) await fetchTenantId(slug);
                
                // 接續同步管理員角色到 Clerk
                const role = await checkAdminStatus(user.id, email, metadata);
                setUserRole(role);
                setRoleChecked(true);
            });
        } else {
            setUserRole(null);
            setUserTenantSlug(null);
            setUserTenantId(null);
            setFirebaseReady(true);
            setRoleChecked(true);
            firebaseSyncRef.current = null;
            firebaseSignOut(firebaseAuth).catch(() => {});
        }
    }, [user, isLoaded, checkAdminStatus, syncFirebaseAuth, fetchTenantId]);

    const logout = async () => {
        try {
            await signOut();
            await firebaseSignOut(firebaseAuth);
            setUserRole(null);
            setUserTenantSlug(null);
            setUserTenantId(null);
            firebaseSyncRef.current = null;
        } catch (error) {
            console.error("登出失敗:", error);
        }
    };

    return (
        <AuthContext.Provider value={{
            userRole,
            userTenantSlug,
            userTenantId,
            isStaffRole,
            isAuthenticated: !!user,
            loading: !isLoaded || (!!user && (!firebaseReady || !roleChecked)),
            firebaseReady,
            logout,
            clerkUserId: user?.id ?? null,
            userEmail: user?.emailAddresses[0]?.emailAddress ?? null,
            userName: user?.fullName ?? user?.firstName ?? null,
            userPhotoUrl: user?.imageUrl ?? null,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
