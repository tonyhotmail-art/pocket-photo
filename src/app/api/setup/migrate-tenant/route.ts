import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, getDocs, writeBatch, query, where } from "firebase/firestore";

export async function GET(request: NextRequest) {
    try {
        const batch = writeBatch(db);
        let updatedCount = 0;

        // 1. 遷移分類 (Categories)
        const categoriesSnapshot = await getDocs(collection(db, "categories"));
        categoriesSnapshot.docs.forEach(docSnap => {
            const data = docSnap.data();
            if (!data.tenantId) {
                batch.update(docSnap.ref, { tenantId: "default" });
                updatedCount++;
            }
        });

        // 2. 遷移作品 (Portfolio Items)
        const itemsSnapshot = await getDocs(collection(db, "portfolio_items"));
        itemsSnapshot.docs.forEach(docSnap => {
            const data = docSnap.data();
            if (!data.tenantId) {
                batch.update(docSnap.ref, { tenantId: "default" });
                updatedCount++;
            }
        });

        if (updatedCount > 0) {
            await batch.commit();
        }

        return NextResponse.json({
            success: true,
            message: `成功遷移 ${updatedCount} 筆資料`,
            updatedCount
        });
    } catch (error) {
        console.error("Migration error:", error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
        }, { status: 500 });
    }
}
