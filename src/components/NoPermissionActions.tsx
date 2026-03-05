"use client";

import { useState } from "react";
import { ImagePlus } from "lucide-react";
import ApplicationForm from "@/components/ApplicationForm";

interface NoPermissionActionsProps {
    userEmail: string;
    userName: string;
}

/**
 * 非管理者登入後的操作按鈕
 * 提供「申請自己的相本」選項
 */
export default function NoPermissionActions({ userEmail, userName }: NoPermissionActionsProps) {
    const [showForm, setShowForm] = useState(false);

    if (showForm) {
        return (
            <div className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
                <ApplicationForm userEmail={userEmail} userName={userName} />
                <button
                    onClick={() => setShowForm(false)}
                    className="mt-4 w-full text-center text-sm text-gray-500 hover:text-white transition-colors"
                >
                    ← 返回
                </button>
            </div>
        );
    }

    return (
        <div className="w-full max-w-md">
            {/* 申請自己的相本 */}
            <button
                onClick={() => setShowForm(true)}
                className="w-full flex items-center justify-center gap-2 px-8 py-4 bg-white text-black rounded-xl font-semibold text-lg hover:bg-gray-200 transition-all duration-200"
            >
                <ImagePlus className="w-5 h-5" />
                申請自己的相本
            </button>
        </div>
    );
}
