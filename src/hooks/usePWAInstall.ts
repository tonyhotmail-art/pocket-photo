"use client";

import { useState, useEffect } from "react";

// 定義 beforeinstallprompt 事件型別
interface BeforeInstallPromptEvent extends Event {
    readonly platforms: string[];
    readonly userChoice: Promise<{
        outcome: "accepted" | "dismissed";
        platform: string;
    }>;
    prompt(): Promise<void>;
}

export function usePWAInstall() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isInstallable, setIsInstallable] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);

    useEffect(() => {
        // 檢查是否已經安裝
        const checkInstalledStatus = () => {
            if (
                window.matchMedia("(display-mode: standalone)").matches ||
                ("standalone" in window.navigator && (window.navigator as any).standalone === true)
            ) {
                setIsInstalled(true);
            }
        };

        checkInstalledStatus();

        // 監聽支援 PWA 安裝時觸發的事件
        const handleBeforeInstallPrompt = (e: Event) => {
            // 阻止 Chrome 67 以前的自動顯示
            e.preventDefault();
            // 存起來以便後續觸發
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            setIsInstallable(true);
        };

        // 監聽安裝成功事件
        const handleAppInstalled = () => {
            setIsInstalled(true);
            setIsInstallable(false);
            setDeferredPrompt(null);
        };

        window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
        window.addEventListener("appinstalled", handleAppInstalled);

        return () => {
            window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
            window.removeEventListener("appinstalled", handleAppInstalled);
        };
    }, []);

    const triggerInstall = async () => {
        if (!deferredPrompt) {
            return;
        }
        // 顯示瀏覽器的安裝視窗
        deferredPrompt.prompt();
        // 等待用戶操作結果
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === "accepted") {
            setIsInstallable(false);
        }
        // 不論接受與否都清空 deferredPrompt，因為 prompt 只能呼叫一次
        setDeferredPrompt(null);
    };

    return { isInstallable, isInstalled, triggerInstall };
}
