import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, limit, getDocs, startAfter } from "firebase/firestore";

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const page = parseInt(searchParams.get("page") || "1");
        const pageSize = parseInt(searchParams.get("pageSize") || "20");
        const category = searchParams.get("category") || "all";

        // 建立基礎查詢條件
        const baseConstraints = category === "all"
            ? [orderBy("createdAt", "desc")]
            : [where("categoryName", "==", category), orderBy("createdAt", "desc")];

        if (page === 1) {
            // 第一頁，直接載入
            const pageQuery = query(
                collection(db, "portfolio_items"),
                ...baseConstraints,
                limit(pageSize + 1) // 多載入一筆判斷是否有下一頁
            );

            const snapshot = await getDocs(pageQuery);
            const docs = snapshot.docs;
            const hasMore = docs.length > pageSize;

            const items = docs.slice(0, pageSize).map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            return NextResponse.json({
                items,
                hasNextPage: hasMore,
                hasPrevPage: false,
                currentPage: 1
            });
        } else {
            // 非第一頁，需要先取得 cursor
            const skipCount = (page - 1) * pageSize;

            // 在後端取得 cursor（不傳給前端）
            const cursorQuery = query(
                collection(db, "portfolio_items"),
                ...baseConstraints,
                limit(skipCount)
            );

            const cursorSnapshot = await getDocs(cursorQuery);

            if (cursorSnapshot.docs.length < skipCount) {
                // 沒有足夠的文件，回傳第一頁
                return NextResponse.json({
                    items: [],
                    hasNextPage: false,
                    hasPrevPage: false,
                    currentPage: 1,
                    error: "Page out of range"
                });
            }

            const lastDoc = cursorSnapshot.docs[cursorSnapshot.docs.length - 1];

            // 載入當前頁
            const pageQuery = query(
                collection(db, "portfolio_items"),
                ...baseConstraints,
                startAfter(lastDoc),
                limit(pageSize + 1)
            );

            const snapshot = await getDocs(pageQuery);
            const docs = snapshot.docs;
            const hasMore = docs.length > pageSize;

            const items = docs.slice(0, pageSize).map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            return NextResponse.json({
                items,
                hasNextPage: hasMore,
                hasPrevPage: true,
                currentPage: page
            });
        }
    } catch (error) {
        console.error("Pagination error:", error);
        return NextResponse.json(
            { error: "Failed to fetch items" },
            { status: 500 }
        );
    }
}
