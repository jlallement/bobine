/** Types de `bundled-fonts.mjs` (module partagé avec `e2e/packaged.mjs`). */
export declare const BUNDLED_FONT_FILES: readonly string[]
export declare const MAC_FONTS_EXCLUSION: string
export declare const FONT_LICENSES: readonly string[]
export declare function bundledFontsIn(entries: readonly string[]): string[]
export declare function missingFonts(entries: readonly string[]): string[]
