"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useUser, useClerk, useSignIn } from "@clerk/nextjs";
import NextImage from "next/image";
import { LogOut, X, User, Lock, Eye, EyeOff, ChevronLeft, Mail, CheckCircle2 } from "lucide-react";

type ViewMode = "menu" | "password" | "forgot" | "forgotDone";

interface UserCardDropdownProps {
    size?: number;
    afterSignOutUrl?: string;
    /** 在已有 Modal 遮罩的情境下設為 true，避免再疊一層遮罩模糊畫面 */
    noBackdrop?: boolean;
}

/**
 * 自訂使用者卡片 (日式極簡風格)
 * 功能：顯示帳號資訊、新增/修改密碼、找回密碼（發送重設郵件）、登出
 * 資料來源：Clerk useUser() + useClerk() Hook
 */
export default function UserCardDropdown({
    size = 44,
    afterSignOutUrl = "/",
    noBackdrop = false,
}: UserCardDropdownProps) {
    const { user, isLoaded } = useUser();
    const { signOut } = useClerk();
    const { signIn, isLoaded: signInLoaded } = useSignIn();

    const [open, setOpen] = useState(false);
    const [view, setView] = useState<ViewMode>("menu");
    const cardRef = useRef<HTMLDivElement>(null);

    // 密碼表單 state
    const [currentPwd, setCurrentPwd] = useState("");
    const [newPwd, setNewPwd] = useState("");
    const [confirmPwd, setConfirmPwd] = useState("");
    const [showNew, setShowNew] = useState(false);
    const [showCurrent, setShowCurrent] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [pwdError, setPwdError] = useState("");
    const [pwdLoading, setPwdLoading] = useState(false);
    const [pwdSuccess, setPwdSuccess] = useState(false);

    // 找回密碼 state
    const [forgotLoading, setForgotLoading] = useState(false);
    const [forgotError, setForgotError] = useState("");

    // 點擊外部關閉
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
                handleClose();
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    // 關閉並重設狀態
    const handleClose = useCallback(() => {
        setOpen(false);
        setTimeout(() => {
            setView("menu");
            setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
            setPwdError(""); setPwdSuccess(false);
            setForgotError(""); setShowNew(false);
            setShowCurrent(false); setShowConfirm(false);
        }, 300);
    }, []);

    if (!isLoaded || !user) return null;

    const name = user.fullName ?? user.firstName ?? "使用者";
    const email = user.primaryEmailAddress?.emailAddress ?? "";
    const avatarUrl = user.imageUrl;
    const hasPassword = user.passwordEnabled;

    // ── 登出 ─────────────────────────────────
    const handleSignOut = async () => {
        handleClose();
        await signOut({ redirectUrl: afterSignOutUrl });
    };

    // ── 設定 / 修改密碼 ──────────────────────
    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setPwdError(""); setPwdSuccess(false);

        if (newPwd.length < 8) {
            setPwdError("密碼至少需要 8 個字元"); return;
        }
        if (newPwd !== confirmPwd) {
            setPwdError("兩次密碼不一致"); return;
        }
        if (hasPassword && !currentPwd) {
            setPwdError("請輸入目前密碼"); return;
        }

        setPwdLoading(true);
        try {
            await user.updatePassword({
                ...(hasPassword ? { currentPassword: currentPwd } : {}),
                newPassword: newPwd,
            });
            setPwdSuccess(true);
            setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
        } catch (err: any) {
            const msg = err?.errors?.[0]?.longMessage
                ?? err?.errors?.[0]?.message
                ?? "操作失敗，請稍後再試";
            setPwdError(msg);
        } finally {
            setPwdLoading(false);
        }
    };

    // ── 找回密碼：發送重設郵件 ────────────────
    const handleForgotPassword = async () => {
        if (!signInLoaded || !signIn || !email) return;
        setForgotLoading(true); setForgotError("");
        try {
            await signIn.create({
                strategy: "reset_password_email_code",
                identifier: email,
            });
            setView("forgotDone");
        } catch (err: any) {
            const msg = err?.errors?.[0]?.message ?? "發送失敗，請稍後再試";
            setForgotError(msg);
        } finally {
            setForgotLoading(false);
        }
    };

    // ── 共用元素 ─────────────────────────────
    const BackBtn = ({ to = "menu" as ViewMode }) => (
        <button
            onClick={() => setView(to)}
            className="flex items-center gap-1.5 text-xs text-[#aaaaaa] hover:text-[#1A1A1A] transition-colors mb-4"
        >
            <ChevronLeft size={13} /> 返回
        </button>
    );

    const PwdInput = ({
        id, value, onChange, placeholder,
        show, setShow,
    }: {
        id: string; value: string; onChange: (v: string) => void;
        placeholder: string; show: boolean; setShow: (v: boolean) => void;
    }) => (
        <div className="relative">
            <input
                id={id}
                type={show ? "text" : "password"}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                autoComplete="off"
                className="w-full text-sm border border-[#e8e8e4] rounded-xl px-3 py-2.5 pr-9 bg-white text-[#1A1A1A] placeholder:text-[#cccccc] focus:outline-none focus:border-[#1A1A1A] transition-colors"
            />
            <button
                type="button"
                onClick={() => setShow(!show)}
                tabIndex={-1}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#cccccc] hover:text-[#888888]"
            >
                {show ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
        </div>
    );

    return (
        <div className="relative" ref={cardRef}>
            {/* 觸發頭像按鈕 */}
            <button
                onClick={() => setOpen(v => !v)}
                className="rounded-full overflow-hidden hover:scale-110 transition-transform shadow-xl focus:outline-none ring-2 ring-white/60"
                style={{ width: size, height: size, minWidth: size, minHeight: size }}
                aria-label="使用者選單"
            >
                {avatarUrl ? (
                    <NextImage src={avatarUrl} alt={name} width={size} height={size}
                        className="rounded-full object-cover" unoptimized />
                ) : (
                    <div className="flex items-center justify-center bg-[#1A1A1A] text-white rounded-full w-full h-full">
                        <User size={size * 0.45} strokeWidth={1.5} />
                    </div>
                )}
            </button>

            {open && (
                <>
                    {/* 遮罩（在 Modal 內使用時可關閉） */}
                    {!noBackdrop && (
                        <div className="fixed inset-0 z-[200] bg-black/20 backdrop-blur-[2px]" onClick={handleClose} />
                    )}

                    {/* 卡片本體 */}
                    <div className="absolute bottom-full right-0 mb-3 z-[201] w-72 rounded-2xl overflow-hidden shadow-2xl border border-[#e8e8e4] bg-white">

                        {/* 關閉按鈕 */}
                        <button onClick={handleClose}
                            className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center text-[#bbbbbb] hover:text-[#1A1A1A] transition-colors z-10"
                            aria-label="關閉">
                            <X size={13} />
                        </button>

                        {/* ═══ 主選單 ═══ */}
                        {view === "menu" && (
                            <>
                                <div className="bg-[#F8F7F3] px-5 pt-6 pb-5 flex flex-col items-center gap-3 border-b border-[#eeede9]">
                                    {avatarUrl ? (
                                        <NextImage src={avatarUrl} alt={name} width={60} height={60}
                                            className="rounded-full object-cover border-2 border-white shadow-md" unoptimized />
                                    ) : (
                                        <div className="w-15 h-15 rounded-full bg-[#1A1A1A] flex items-center justify-center shadow-md">
                                            <User size={28} className="text-white" strokeWidth={1.5} />
                                        </div>
                                    )}
                                    <div className="text-center">
                                        <p className="text-sm font-medium text-[#1A1A1A] tracking-wide">{name}</p>
                                        {email && <p className="text-xs text-[#999999] mt-0.5">{email}</p>}
                                    </div>
                                </div>

                                <div className="p-2">
                                    <button onClick={() => { setPwdSuccess(false); setPwdError(""); setView("password"); }}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#555555] hover:bg-[#F8F7F3] hover:text-[#1A1A1A] rounded-xl transition-colors group">
                                        <Lock size={14} strokeWidth={1.5} className="text-[#bbbbbb] group-hover:text-[#1A1A1A] transition-colors" />
                                        <span className="tracking-wide">{hasPassword ? "修改密碼" : "設定密碼"}</span>
                                    </button>
                                    <button onClick={handleSignOut}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#555555] hover:bg-[#F8F7F3] hover:text-[#1A1A1A] rounded-xl transition-colors group">
                                        <LogOut size={14} strokeWidth={1.5} className="text-[#bbbbbb] group-hover:text-[#1A1A1A] transition-colors" />
                                        <span className="tracking-wide">登出</span>
                                    </button>
                                </div>
                                <div className="pb-3 text-center">
                                    <p className="text-[10px] text-[#cccccc] tracking-[0.2em] uppercase">Kelly Photo</p>
                                </div>
                            </>
                        )}

                        {/* ═══ 密碼管理 ═══ */}
                        {view === "password" && (
                            <div className="p-5">
                                <BackBtn to="menu" />
                                <p className="text-sm font-medium text-[#1A1A1A] mb-4 tracking-wide">
                                    {hasPassword ? "修改密碼" : "設定密碼"}
                                </p>

                                {pwdSuccess ? (
                                    <div className="flex flex-col items-center gap-3 py-4">
                                        <CheckCircle2 size={36} className="text-green-500" />
                                        <p className="text-sm text-[#555555]">密碼{hasPassword ? "已更新" : "已設定"}！</p>
                                        <button onClick={() => setView("menu")}
                                            className="text-xs text-[#aaaaaa] hover:text-[#1A1A1A] transition-colors">
                                            返回選單
                                        </button>
                                    </div>
                                ) : (
                                    <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-2.5">
                                        {hasPassword && (
                                            <PwdInput id="cur" value={currentPwd} onChange={setCurrentPwd}
                                                placeholder="目前密碼" show={showCurrent} setShow={setShowCurrent} />
                                        )}
                                        <PwdInput id="new" value={newPwd} onChange={setNewPwd}
                                            placeholder="新密碼（至少 8 字元）" show={showNew} setShow={setShowNew} />
                                        <PwdInput id="con" value={confirmPwd} onChange={setConfirmPwd}
                                            placeholder="確認新密碼" show={showConfirm} setShow={setShowConfirm} />

                                        {pwdError && (
                                            <p className="text-xs text-red-500 text-center leading-relaxed">{pwdError}</p>
                                        )}

                                        <button type="submit" disabled={pwdLoading}
                                            className="w-full py-2.5 bg-[#1A1A1A] text-white text-sm rounded-xl hover:bg-[#333333] transition-colors disabled:opacity-50 tracking-wide mt-1">
                                            {pwdLoading ? "處理中..." : (hasPassword ? "更新密碼" : "設定密碼")}
                                        </button>

                                        {hasPassword && (
                                            <button type="button" onClick={() => setView("forgot")}
                                                className="text-xs text-center text-[#aaaaaa] hover:text-[#1A1A1A] transition-colors py-1">
                                                忘記密碼？
                                            </button>
                                        )}
                                    </form>
                                )}
                            </div>
                        )}

                        {/* ═══ 找回密碼 ═══ */}
                        {view === "forgot" && (
                            <div className="p-5">
                                <BackBtn to="password" />
                                <div className="flex flex-col items-center gap-3 text-center">
                                    <Mail size={32} className="text-[#bbbbbb]" />
                                    <p className="text-sm font-medium text-[#1A1A1A]">找回密碼</p>
                                    <p className="text-xs text-[#888888] leading-relaxed">
                                        重設連結將發送至：<br />
                                        <span className="text-[#1A1A1A] font-medium">{email}</span>
                                    </p>
                                    {forgotError && <p className="text-xs text-red-500">{forgotError}</p>}
                                    <button onClick={handleForgotPassword} disabled={forgotLoading}
                                        className="w-full py-2.5 bg-[#1A1A1A] text-white text-sm rounded-xl hover:bg-[#333333] transition-colors disabled:opacity-50 tracking-wide mt-1">
                                        {forgotLoading ? "發送中..." : "發送重設郵件"}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ═══ 找回密碼成功 ═══ */}
                        {view === "forgotDone" && (
                            <div className="p-5">
                                <div className="flex flex-col items-center gap-3 text-center py-2">
                                    <CheckCircle2 size={36} className="text-green-500" />
                                    <p className="text-sm font-medium text-[#1A1A1A]">重設郵件已送出</p>
                                    <p className="text-xs text-[#888888] leading-relaxed">
                                        請查收 <span className="font-medium text-[#1A1A1A]">{email}</span> 的信件<br />
                                        並依指示完成密碼重設。
                                    </p>
                                    <button onClick={() => setView("menu")}
                                        className="text-xs text-[#aaaaaa] hover:text-[#1A1A1A] transition-colors mt-2">
                                        返回選單
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
