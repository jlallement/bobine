/** Types de `windows-icon.mjs` (module partagé avec `make-icon.mjs`, lancé par Electron). */
export declare const WINDOWS_ICON_SIZES: readonly number[]
export declare function encodeIco(images: readonly { size: number; png: Uint8Array }[]): Buffer
export declare function decodeIco(data: Uint8Array): { size: number; png: Buffer }[]
