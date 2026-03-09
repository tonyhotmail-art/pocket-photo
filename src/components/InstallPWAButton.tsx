"use client";

import { Download } from "lucide-react";
import { usePWAInstall } from "@/hooks/usePWAInstall";

export default function InstallPWAButton() {
    const { isInstallable, isInstalled, triggerInstall } = usePWAInstall();

    // 若已經安裝，或者瀏覽器/系統不支援（或尚未給出 beforeinstallprompt）則不顯示按鈕
    if (isInstalled || !isInstallable) {
        return null;
    }

    return (
        <button
            onClick={triggerInstall}
            className="w-full px-6 py-3.5 rounded-xl text-sm font-bold tracking-widest transition-all duration-300 transform hover:-translate-y-1 bg-[#1A1A1A] border border-[#c8a84b]/30 text-[#c8a84b] hover:bg-[#c8a84b]/20 flex justify-center items-center gap-2 shadow-[0_4px_15px_rgba(0,0,0,0.3)]"
        >
            <Download className="w-4 h-4" />
            立即免費安裝
        </button>
    );
}
