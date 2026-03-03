/**
 * 口袋照片 — 角色階層定義與權限規則
 * (從口袋預約對齊同步)
 *
 * 角色由高到低：
 *   system_admin > store_admin > beautician > customer
 *
 * 管理權限規則：
 *   - system_admin  → 可新增/修改/刪除：system_admin、store_admin
 *   - store_admin   → 可新增/修改/刪除：store_admin、beautician、customer
 *   - 其餘角色      → 無任何管理權限
 *   - 下層不可對上層執行任何操作
 */

export type UserRole = 'system_admin' | 'store_admin' | 'beautician' | 'customer';

/**
 * 角色數值越小，階層越高（越大越低）
 * 用於比較「是否為上層角色」
 */
const ROLE_LEVEL: Record<UserRole, number> = {
    system_admin: 0,
    store_admin: 1,
    beautician: 2,
    customer: 3,
};

/**
 * 每個角色可以管理的目標角色範圍
 *
 * 設計原則：
 *   - system_admin 只管系統層級（system_admin、store_admin）
 *     不介入店面內部的員工與客戶管理
 *   - store_admin 管店面層級（store_admin、beautician、customer）
 *     不能動 system_admin
 */
const MANAGEABLE_ROLES: Record<UserRole, UserRole[]> = {
    system_admin: ['system_admin', 'store_admin'],
    store_admin: ['store_admin', 'beautician', 'customer'],
    beautician: [],  // 無管理權限
    customer: [],  // 無管理權限
};

/**
 * 檢查操作者是否有權限對目標角色執行管理操作（新增/修改/刪除）
 *
 * @param callerRole  操作者目前的角色
 * @param targetRole  要被管理的目標角色
 * @returns { allowed: boolean; reason?: string }
 */
export function checkRolePermission(
    callerRole: UserRole,
    targetRole: UserRole
): { allowed: boolean; reason?: string } {
    const allowedTargets = MANAGEABLE_ROLES[callerRole];

    if (!allowedTargets || allowedTargets.length === 0) {
        return {
            allowed: false,
            reason: `「${getRoleDisplayName(callerRole)}」沒有任何用戶管理權限`,
        };
    }

    if (!allowedTargets.includes(targetRole)) {
        // 判斷是「越權往上」還是「超出管理範圍」
        if (ROLE_LEVEL[targetRole] < ROLE_LEVEL[callerRole]) {
            return {
                allowed: false,
                reason: `「${getRoleDisplayName(callerRole)}」不可管理上層角色「${getRoleDisplayName(targetRole)}」`,
            };
        }
        return {
            allowed: false,
            reason: `「${getRoleDisplayName(callerRole)}」的管理範圍不包含「${getRoleDisplayName(targetRole)}」`,
        };
    }

    return { allowed: true };
}

/**
 * 檢查操作者是否有權限對「已有特定角色的用戶」執行刪除
 * （邏輯同上，防止降級後再刪除的繞過手法）
 */
export function checkDeletePermission(
    callerRole: UserRole,
    targetCurrentRole: UserRole
): { allowed: boolean; reason?: string } {
    return checkRolePermission(callerRole, targetCurrentRole);
}

/**
 * 取得角色的中文顯示名稱
 */
export function getRoleDisplayName(role: UserRole | string): string {
    const map: Record<string, string> = {
        system_admin: '系統管理員',
        store_admin: '店長',
        beautician: '美容師',
        customer: '一般顧客',
    };
    return map[role] ?? '未知角色';
}

/**
 * 驗證給定的字串是否為合法的 UserRole
 */
export function isValidRole(role: string): role is UserRole {
    return ['system_admin', 'store_admin', 'beautician', 'customer'].includes(role);
}
