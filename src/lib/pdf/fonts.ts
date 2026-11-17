import type { Font as FontRegistry } from '@react-pdf/renderer'

/**
 * Fonts used by the PDF report. Headings, labels and figures are set in
 * IBM Plex Mono (SIL Open Font License, see fonts/OFL.txt); explanatory
 * paragraphs stay in Helvetica, which is built into every PDF reader.
 */
export const REPORT_FONTS = {
  mono: 'IBMPlexMono',
  monoBold: 'IBMPlexMono-SemiBold',
  text: 'Helvetica',
} as const

/** Where the font files are: URLs in the browser, data URLs or file paths in Node */
export interface ReportFontSources {
  regular: string
  semiBold: string
}

const registered = new WeakSet<object>()

/**
 * Registers the report fonts with @react-pdf/renderer. Call it before
 * rendering a document from buildCGTReportDocument; repeat calls do nothing.
 */
export function registerReportFonts(Font: typeof FontRegistry, sources: ReportFontSources): void {
  if (registered.has(Font)) return
  Font.register({ family: REPORT_FONTS.mono, src: sources.regular })
  Font.register({ family: REPORT_FONTS.monoBold, src: sources.semiBold })
  // Don't hyphenate: a split ticker or figure reads as a different one
  Font.registerHyphenationCallback(word => [word])
  registered.add(Font)
}
