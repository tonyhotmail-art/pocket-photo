"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

interface AuthContextType {
    isAdmin: boolean;
    isAuthenticated: boolean;
    loading: boolean;
    logout: () => Promise<void>;
    clerkUserId: string | null;
    userEmail: string | null;
    userName: string | null;
    userPhotoUrl: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * 超級管理員硬編碼清單（與 Server 端一致）
 */
const SUPER_ADMINS = [
    "tony.hotmail@gmail.com",
    "tony7777777@gmail.com"
];

/**
 * AuthProvider — 雙水管 (Dual-Pipe) 架構
 *
 * 水管 A（Clerk Metadata）：讀取 user.publicMetadata.role === 'admin'
 *   → 不需網路請求，最快
 * 水管 B（Firestore）：查詢 admins 集合
 *   → 確認後自動呼叫 /api/admin/sync-role 補水管 A
 *
 * 兩管皆接受 OR 邏輯：任一管通則認定為管理員
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
    const { user, isLoaded } = useUser();
    const { signOut } = useClerk();
    const [isAdmin, setIsAdmin] = useState(false);

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
     * 水管 B：查詢 Firestore admins 集合
     */
    const checkFirestorePipe = useCallback(async (
        userId: string,
        email: string | null | undefined
    ): Promise<boolean> => {
        try {
            // 比對 clerkUserId
            const snapById = await getDocs(
                query(collection(db, "admins"), where("clerkUserId", "==", userId))
            );
            if (!snapById.empty) return true;

            if (email) {
                // 比對 Email
                const snapByEmail = await getDocs(
                    query(
                        collection(db, "admins"),
                        where("email", "==", email.toLowerCase())
                    )
                );
                if (!snapByEmail.empty) return true;

                // 超級管理員清單
                if (SUPER_ADMINS.includes(email.toLowerCase())) return true;
            }
            return false;
        } catch (error) {
            console.error("[AuthContext] Firestore 查詢失敗:", error);
            return false;
        }
    }, []);

    /**
     * 雙水管判斷主邏輯
     */
    const checkAdminStatus = useCallback(async (
        userId: string,
        email: string | null | undefined,
        publicMetadata: Record<string, unknown>
    ) => {
        // 水管 A：直接讀取 Clerk publicMetadata（O(1)，無網路請求）
        const clerkPipeResult = publicMetadata?.role === "admin";
        if (clerkPipeResult) {
            console.log("[AuthContext] 🔑 水管A（Clerk Metadata）通過");
            return true;
        }

        // 水管 B：Firestore 查詢
        console.log("[AuthContext] 水管A 未標記，嘗試水管B（Firestore）...");
        const firestorePipeResult = await checkFirestorePipe(userId, email);
        if (firestorePipeResult) {
            console.log("[AuthContext] 🔑 水管B（Firestore）通過，觸發同步補水管A...");
            // 非同步補水管 A，不阻塞登入流程
            syncRoleToClerk();
            return true;
        }

        console.log("[AuthContext] 兩條水管均未通過");
        return false;
    }, [checkFirestorePipe, syncRoleToClerk]);

    // Clerk 使用者狀態變更時，重新確認管理員資格
    useEffect(() => {
        if (!isLoaded) return;

        if (user) {
            const email = user.emailAddresses[0]?.emailAddress;
            const metadata = (user.publicMetadata ?? {}) as Record<string, unknown>;
            checkAdminStatus(user.id, email, metadata).then(setIsAdmin);
        } else {
            setIsAdmin(false);
        }
    }, [user, isLoaded, checkAdminStatus]);

    const logout = async () => {
        try {
            await signOut();
            setIsAdmin(false);
        } catch (error) {
            console.error("登出失敗:", error);
        }
    };

    const email = user?.emailAddresses[0]?.emailAddress ?? null;

    return (
        <AuthContext.Provider value={{
            isAdmin,
            isAuthenticated: !!user,
            loading: !isLoaded,
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
