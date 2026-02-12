import { NextRequest, NextResponse } from "next/server";
import { getAdminApp } from "@/lib/firebase-admin";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const adminAuth = getAuth(getAdminApp());
const adminDb = getFirestore(getAdminApp());

/**
 * 驗證請求是否來自已授權的管理員
 * @param request - Next.js 請求物件
 * @returns 驗證結果,包含使用者資訊或錯誤訊息
 */
export async function verifyAdminAuth(request: NextRequest) {
    try {
        // 1. 從 Authorization header 取得 token
        const authHeader = request.headers.get("Authorization");

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return {
                success: false,
                error: "未提供授權令牌",
                status: 401
            };
        }

        const token = authHeader.split("Bearer ")[1];

        // 2. 驗證 Firebase ID Token
        let decodedToken;
        try {
            decodedToken = await adminAuth.verifyIdToken(token);
        } catch (error) {
            console.error("Token 驗證失敗:", error);
            return {
                success: false,
                error: "無效的授權令牌",
                status: 401
            };
        }

        const uid = decodedToken.uid;
        const email = decodedToken.email;

        // 3. 檢查是否為管理員
        const isAdmin = await checkIsAdmin(uid, email);

        if (!isAdmin) {
            return {
                success: false,
                error: "無權限執行此操作",
                status: 403
            };
        }

        // 4. 驗證成功
        return {
            success: true,
            uid,
            email
        };

    } catch (error) {
        console.error("驗證過程發生錯誤:", error);
        return {
            success: false,
            error: "驗證失敗",
            status: 500
        };
    }
}

/**
 * 檢查使用者是否為管理員
 */
async function checkIsAdmin(uid: string, email?: string): Promise<boolean> {
    try {
        // 檢查 UID
        const adminByUid = await adminDb.collection("admins")
            .where("uid", "==", uid)
            .limit(1)
            .get();

        if (!adminByUid.empty) {
            return true;
        }

        // 檢查 Email
        if (email) {
            const adminByEmail = await adminDb.collection("admins")
                .where("type", "==", "google")
                .where("email", "==", email.toLowerCase())
                .limit(1)
                .get();

            if (!adminByEmail.empty) {
                return true;
            }

            // 預設的超級管理員
            if (email === "tony.hotmail@gmail.com" ||
                email === "tony7777777@gmail.com") {
                return true;
            }
        }

        return false;
    } catch (error) {
        console.error("管理員檢查錯誤:", error);
        return false;
    }
}
