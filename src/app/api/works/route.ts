
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase"; // Client SDK for Firestore (or use Admin if robust) - Using Admin is better for API routes
import { getAdminApp, adminStorage } from "@/lib/firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { verifyAdminAuth } from "@/lib/auth-middleware";

// Initialize Admin Firestore
const adminDb = getFirestore(getAdminApp());
import { r2Client, R2_BUCKET_NAME, R2_PUBLIC_DOMAIN } from "@/lib/r2";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";

export async function DELETE(request: NextRequest) {
    // 🔒 驗證身份
    const authResult = await verifyAdminAuth(request);
    if (!authResult.success) {
        return NextResponse.json(
            { error: authResult.error },
            { status: authResult.status }
        );
    }

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");
        const ids = searchParams.get("ids");


        if (!id && !ids) {
            return NextResponse.json({ error: "Missing id or ids" }, { status: 400 });
        }

        if (ids) {
            const idList = ids.split(",").filter(Boolean);
            console.log(`[Delete API] Batch deleting ${idList.length} items`);

            // Execute in parallel (or sequential if too many, but parallel is usually fine for <50)
            const results = await Promise.allSettled(idList.map(async (itemId) => {
                await deleteSingleWork(itemId);
            }));

            // Check for failures
            const failed = results.filter(r => r.status === 'rejected');
            if (failed.length > 0) {
                console.error(`[Delete API] Some items failed to delete:`, failed);
            }

            return NextResponse.json({
                success: true,
                deletedCount: idList.length - failed.length,
                failedCount: failed.length
            });
        }

        if (id) {
            await deleteSingleWork(id);
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: "Invalid request" }, { status: 400 });

    } catch (error: any) {
        console.error("[Delete API] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    // 🔒 驗證身份
    const authResult = await verifyAdminAuth(request);
    if (!authResult.success) {
        return NextResponse.json(
            { success: false, error: authResult.error },
            { status: authResult.status }
        );
    }

    try {
        const body = await request.json();
        const { id, categoryName } = body;

        if (!id || !categoryName) {
            return NextResponse.json({
                success: false,
                error: "缺少 ID 或分類名稱"
            }, { status: 400 });
        }

        console.log(`[Update API] Updating work ${id} to category: ${categoryName}`);

        // Update Firestore
        const docRef = adminDb.collection("portfolio_items").doc(id);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            return NextResponse.json({
                success: false,
                error: "找不到該作品"
            }, { status: 404 });
        }

        // Update the document
        await docRef.update({
            categoryName: categoryName,
            // Assuming categoryOrder might need update based on new category, but for now just updating name. 
            // If categoryOrder is important for sorting within category, it might need to be recalculated or passed in.
            // For simplicity, we'll keep the existing order or set a default if needed.
            // Let's just update the name for now.
        });

        console.log(`[Update API] Work ${id} updated successfully.`);

        return NextResponse.json({
            success: true,
            data: { id, categoryName }
        });

    } catch (error: any) {
        console.error("[Update API] Error:", error);
        return NextResponse.json({
            success: false,
            error: "更新失敗",
            details: error.message
        }, { status: 500 });
    }
}

async function deleteSingleWork(id: string) {
    console.log(`[Delete API] Attempting to delete work: ${id}`);

    // 1. Get the document to find the image URL
    const docRef = adminDb.collection("portfolio_items").doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
        // If document doesn't exist, we can consider it "deleted" or throw.
        // For batch operations, it's safer to just return/log.
        console.warn(`[Delete API] Document ${id} not found, skipping.`);
        return;
    }

    const data = docSnap.data();
    const imageUrl = data?.imageUrl;

    // 2. Delete from Storage if imageUrl exists
    if (imageUrl) {
        try {
            // A. Check if it's an R2 URL
            if (R2_PUBLIC_DOMAIN && imageUrl.startsWith(R2_PUBLIC_DOMAIN)) {
                // Handle different URL formats just in case
                // url: https://pub-xxx.r2.dev/folder/image.jpg -> Key: folder/image.jpg
                // The replacement should be careful. 
                // Currently: imageUrl.replace(`${R2_PUBLIC_DOMAIN}/`, '') handles simple case.
                const fileKey = imageUrl.replace(`${R2_PUBLIC_DOMAIN}/`, '');

                // Decode URI component in case filename has special chars
                const decodedKey = decodeURIComponent(fileKey);

                console.log(`[Delete API] Deleting from R2: ${decodedKey}`);

                await r2Client.send(new DeleteObjectCommand({
                    Bucket: R2_BUCKET_NAME,
                    Key: decodedKey,
                }));
            }
            // B. Fallback: Check if it's a Firebase Storage URL
            else {
                const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
                if (bucketName && imageUrl.includes(bucketName)) {
                    const urlParts = imageUrl.split(`${bucketName.replace(/^(gs:\/\/|https?:\/\/)/, '')}/`);
                    if (urlParts.length > 1) {
                        const filePath = decodeURIComponent(urlParts[1]);
                        const cleanPath = filePath.split('?')[0];
                        console.log(`[Delete API] Deleting from Firebase Storage: ${cleanPath}`);
                        await adminStorage.bucket(bucketName).file(cleanPath).delete();
                    }
                }
            }
        } catch (storageError) {
            console.warn("[Delete API] Storage delete failed (might be already deleted):", storageError);
            // Don't block creation deletion if image delete fails
        }
    }

    // 3. Delete from Firestore
    await docRef.delete();
    console.log(`[Delete API] Firestore document ${id} deleted.`);
}
