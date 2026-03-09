import type { MetadataRoute } from 'next';

/**
 * Web App Manifest
 * 控制手機安裝到桌面時的圖示、名稱、主題色
 */
export default function manifest(): MetadataRoute.Manifest {
    return {
        name: '口袋相片 Pocket Photo',
        short_name: '口袋相片',
        description: '你的專屬專業相冊平台',
        start_url: '/',
        display: 'standalone',
        background_color: '#F8F7F3',
        theme_color: '#1A1A1A',
        icons: [
            {
                src: '/logo.png',
                sizes: '512x512',
                type: 'image/png',
            },
        ],
    };
}
