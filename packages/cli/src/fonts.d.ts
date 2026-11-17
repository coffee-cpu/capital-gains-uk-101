// Font files are inlined as data URLs by esbuild (build.mjs)
declare module '*.ttf' {
  const dataUrl: string
  export default dataUrl
}
