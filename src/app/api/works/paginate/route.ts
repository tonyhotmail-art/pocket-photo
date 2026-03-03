import { NextRequest, NextResponse } from "next/server";
import { portfolioService } from "@/lib/services/portfolio.service";
import { env } from "@/lib/env";

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const page = parseInt(searchParams.get("page") || "1");
        const pageSize = parseInt(searchParams.get("pageSize") || "20");
        const category = searchParams.get("category") || "all";
        const tenantId = searchParams.get("tenantSlug") || env.NEXT_PUBLIC_TENANT_ID;

        const result = await portfolioService.getPaginatedItems(tenantId, page, pageSize, category);

        return NextResponse.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error("Pagination error:", error);
        return NextResponse.json({
            success: false,
            error: "Failed to fetch items",
            details: error instanceof Error ? error.message : "Unknown error"
        }, { status: 500 });
    }
}
