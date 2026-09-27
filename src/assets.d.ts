// Font files are bundled as assets by Metro; importing one gives its asset id (what expo-font expects).
declare module '*.otf' {
  const asset: number;
  export default asset;
}
