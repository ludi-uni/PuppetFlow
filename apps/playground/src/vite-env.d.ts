/// <reference types="vite/client" />

declare module "*.pfpreset?raw" {
  const content: string;
  export default content;
}
