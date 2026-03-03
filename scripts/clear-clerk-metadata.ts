import { clerkClient } from '@clerk/nextjs/server';

async function main() {
    const userId = "user_3A6Zun6KIeyIaOJ3IuRxbCxbU2b";

    console.log(`[Clerk] 寫入 ${userId} 的 Metadata...`);
    const client = await clerkClient();
    await client.users.updateUserMetadata(userId, {
        publicMetadata: {
            role: 'store_admin',
            tenantSlug: 'kelly'
        }
    });
    console.log("寫入成功！");
}

main().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
});
