import re

with open('src/app/[slug]/page.tsx', 'r') as f:
    content = f.read()

content = re.sub(r'const \{ isStaffRole, isAuthenticated, logout, userName, userPhotoUrl, loading: authLoading \} = useAuth\(\);',
                 r'const { isStaffRole, isAuthenticated, logout, userName, userPhotoUrl, loading: authLoading, userTenantId } = useAuth();', content)

with open('src/app/[slug]/page.tsx', 'w') as f:
    f.write(content)
