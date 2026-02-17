import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, getDocs, limit, query } from "firebase/firestore";

export async function GET(request: NextRequest) {
    try {
        const categoriesSnapshot = await getDocs(query(collection(db, "categories"), limit(5)));
        const categories = categoriesSnapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }));

        const itemsSnapshot = await getDocs(query(collection(db, "portfolio_items"), limit(5)));
        const items = itemsSnapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }));

        return NextResponse.json({
            success: true,
            debug: {
                categoriesCount: categoriesSnapshot.size,
                categoriesSample: categories,
                itemsCount: itemsSnapshot.size,
                itemsSample: items,
                cwd: process.cwd()
            }
        });
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
        }, { status: 500 });
    }
}
