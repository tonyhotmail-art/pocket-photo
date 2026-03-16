import re

with open('src/components/AdminManagement.tsx', 'r') as f:
    content = f.read()

content = re.sub(r'const \{ userTenantSlug \} = useAuth\(\);',
                 r'const { userTenantSlug, userTenantId } = useAuth();', content)

with open('src/components/AdminManagement.tsx', 'w') as f:
    f.write(content)
