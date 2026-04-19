"use client";

import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { usePathname } from "next/navigation";

export default function UserAuth() {
    const pathname = usePathname();

    return (
        <div className="flex items-center gap-4">
            <SignedOut>
                <SignInButton mode="modal">
                    <button className="px-4 py-2 text-sm font-medium transition-colors border rounded-md shadow-sm border-input bg-background hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                        登入 / 註冊
                    </button>
                </SignInButton>
            </SignedOut>
            <SignedIn>
                <UserButton afterSignOutUrl={pathname} />
            </SignedIn>
        </div>
    );
}
