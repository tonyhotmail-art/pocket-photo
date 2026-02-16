"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
    onAuthStateChanged,
    User,
    signOut,
    signInWithPopup,
    setPersistence,
    browserLocalPersistence
} from "firebase/auth";
import { auth, googleProvider, db } from "@/lib/firebase";
import { collection, query, where, getDocs, updateDoc, doc, serverTimestamp } from "firebase/firestore";

interface AuthContextType {
    user: User | null;
    isAdmin: boolean;
    loading: boolean;
    loginWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
    checkAdminStatus: (user: User) => Promise<boolean>;
    setManuallyAuthorized: (status: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isAdminState, setIsAdminState] = useState(false);
    const [isManuallyAuthorized, setIsManuallyAuthorized] = useState(false);
    const [loading, setLoading] = useState(true);

    // 綜合判定是否為管理員
    const isAdmin = isAdminState || isManuallyAuthorized;

    // 檢查管理員身份 (比對 Firestore 中的 admins 集合)
    const checkAdminStatus = async (currentUser: User) => {
        try {
            // 嘗試透過 UID 查詢 (針對已記錄過的 Google 使用者)
            const qByUid = query(collection(db, "admins"), where("uid", "==", currentUser.uid));
            const snapByUid = await getDocs(qByUid);
            if (!snapByUid.empty) return true;

            // 嘗試透過 Email 查詢 (針對預先授權但尚未登入過的電子郵件)
            if (currentUser.email) {
                const qByEmail = query(collection(db, "admins"),
                    where("type", "==", "google"),
                    where("email", "==", currentUser.email.toLowerCase())
                );
                const snapByEmail = await getDocs(qByEmail);
                if (!snapByEmail.empty) return true;

                // 預設的高級管理員信箱
                if (currentUser.email === "tony.hotmail@gmail.com" ||
                    currentUser.email === "tony7777777@gmail.com") return true;
            }

            return false;
        } catch (error) {
            console.error("Admin check error:", error);
            return false;
        }
    };

    // 同步管理員個人資料 (如名稱、UID)
    const syncAdminProfile = async (currentUser: User) => {
        try {
            const adminsRef = collection(db, "admins");
            if (!currentUser.email) return;

            // 搜尋匹配此 Email 的 Google 類型管理員
            const q = query(adminsRef,
                where("type", "==", "google"),
                where("email", "==", currentUser.email.toLowerCase())
            );
            const snap = await getDocs(q);

            for (const adminDoc of snap.docs) {
                const data = adminDoc.data();
                // 如果 UID 尚未紀錄，或名稱與 Google 不一致，則更新
                if (data.uid !== currentUser.uid || data.accountName !== currentUser.displayName) {
                    await updateDoc(doc(db, "admins", adminDoc.id), {
                        uid: currentUser.uid,
                        // 優先使用 Google 提供的名稱，若無則保留原樣
                        accountName: currentUser.displayName || data.accountName || "",
                        lastLogin: serverTimestamp()
                    });
                }
            }
        } catch (error) {
            console.error("同步管理員資料失敗:", error);
        }
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                const adminResult = await checkAdminStatus(currentUser);
                setIsAdminState(adminResult);

                // 如果確認是管理員，且是透過 Google 登入，則同步資料
                if (adminResult && currentUser.providerData.some(p => p.providerId === 'google.com')) {
                    syncAdminProfile(currentUser);
                }
            } else {
                setIsAdminState(false);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const loginWithGoogle = async () => {
        setLoading(true);
        try {
            await setPersistence(auth, browserLocalPersistence);
            await signInWithPopup(auth, googleProvider);
        } catch (error: any) {
            console.error("Login Error:", error);
            if (error.code === 'auth/popup-blocked') {
                alert("請允許本網站開啟彈出視窗以進行登入。");
            } else {
                alert("登入失敗：" + error.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const logout = async () => {
        try {
            await signOut(auth);
            setIsManuallyAuthorized(false);
        } catch (error) {
            console.error("Logout Error:", error);
        }
    };

    const setManuallyAuthorized = (status: boolean) => {
        setIsManuallyAuthorized(status);
    };

    return (
        <AuthContext.Provider value={{
            user,
            isAdmin,
            loading,
            loginWithGoogle,
            logout,
            checkAdminStatus,
            setManuallyAuthorized
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
