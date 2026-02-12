import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
    return (
        <div className="min-h-screen bg-[#F8F7F3] flex flex-col items-center justify-center p-6 text-center font-serif">
            <div className="space-y-6 animate-in fade-in zoom-in duration-500">
                <h1 className="text-9xl font-bold text-gray-200 tracking-tighter">404</h1>
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-[#1A1A1A]">找不到此頁面</h2>
                    <p className="text-gray-500 tracking-widest text-sm">
                        PAGE NOT FOUND
                    </p>
                </div>

                <div className="pt-8">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-[#1A1A1A] text-white rounded-full hover:bg-black transition-transform hover:scale-105"
                    >
                        <ArrowLeft size={16} />
                        <span className="text-sm font-bold tracking-widest">返回首頁</span>
                    </Link>
                </div>
            </div>
        </div>
    );
}
