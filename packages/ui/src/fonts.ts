import barlowCondensed600 from '@fontsource/barlow-condensed/files/barlow-condensed-latin-600-normal.woff2?url'
import barlow400 from '@fontsource/barlow/files/barlow-latin-400-normal.woff2?url'

/** The two faces above the fold on every screen; preload them so headings never reflow. */
export const PRELOAD_FONTS: string[] = [barlow400, barlowCondensed600]
