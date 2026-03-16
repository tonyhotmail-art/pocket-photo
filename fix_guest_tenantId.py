import re

with open('src/app/[slug]/page.tsx', 'r') as f:
    content = f.read()

# Replace authLoading || !userTenantId
content = re.sub(r'if \(authLoading \|\| !userTenantId\) return;', r'if (authLoading) return;', content)

# But wait, userTenantId is null for guests because AuthContext ONLY fetches it if user exists.
# We should fix AuthContext.tsx to fetch tenantId based on the current URL slug OR just fetch it in page.tsx if not logged in.
