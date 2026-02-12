
import imageCompression from 'browser-image-compression';

export interface CompressionOptions {
    maxSizeMB?: number;
    maxWidthOrHeight?: number;
    useWebWorker?: boolean;
    initialQuality?: number;
}

/**
 * Compresses an image file using browser-image-compression.
 * 
 * @param file The original image File object.
 * @param customOptions Optional custom compression settings.
 * @returns A Promise that resolves to the compressed File object.
 */
export async function compressImage(file: File, customOptions?: CompressionOptions): Promise<File> {
    // Default options from reference code
    const defaultOptions: CompressionOptions = {
        maxSizeMB: 1,           // Max size 1MB
        maxWidthOrHeight: 1920, // Max dimension 1920px (Full HD)
        useWebWorker: true,     // Use web worker for performance
        initialQuality: 0.8     // Good quality
    };

    const options = { ...defaultOptions, ...customOptions };

    try {
        console.log(`[ImageCompression] Original size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
        const compressedFile = await imageCompression(file, options);
        console.log(`[ImageCompression] Compressed size: ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`);
        return compressedFile;
    } catch (error) {
        console.error("[ImageCompression] Error:", error);
        // If compression fails, return the original file
        return file;
    }
}
