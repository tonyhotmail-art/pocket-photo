import re

with open('src/app/[slug]/page.tsx', 'r') as f:
    content = f.read()

# Replace useSystemSettings()
content = re.sub(r'const \{ settings: siteSettings \} = useSystemSettings\(\); // 前台功能設定',
                 r'const { settings: siteSettings } = useSystemSettings(userTenantId || undefined); // 前台功能設定', content)

# Replace 'tenantId', '==', slug
content = re.sub(r'where\("tenantId", "==", slug\)',
                 r'where("tenantId", "==", userTenantId)', content)

# Pass tenantId prop to components
content = re.sub(r'<CategoryManager />', r'<CategoryManager tenantId={userTenantId!} />', content)
content = re.sub(r'<AutoForm />', r'<AutoForm tenantId={userTenantId!} />', content)
content = re.sub(r'<SystemSettings />', r'<SystemSettings tenantId={userTenantId!} />', content)
content = re.sub(r'<WorkManager />', r'<WorkManager tenantId={userTenantId!} />', content)

# Check authLoading inside effects
content = re.sub(r'if \(authLoading\) return;', r'if (authLoading || !userTenantId) return;', content)
content = re.sub(r'\}, \[isStaffRole, authLoading, slug\]\);', r'}, [isStaffRole, authLoading, userTenantId]);', content)
content = re.sub(r'\}, \[selectedCategoryName, selectedTag, displayLimit, isStaffRole, authLoading, slug\]\);', r'}, [selectedCategoryName, selectedTag, displayLimit, isStaffRole, authLoading, userTenantId]);', content)


with open('src/app/[slug]/page.tsx', 'w') as f:
    f.write(content)
