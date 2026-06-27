declare module "html2canvas" {
  export interface Html2CanvasOptions {
    scale?: number;
    backgroundColor?: string | null;
    logging?: boolean;
    useCORS?: boolean;
    width?: number;
    height?: number;
    windowWidth?: number;
    windowHeight?: number;
  }

  export default function html2canvas(
    element: HTMLElement,
    options?: Partial<Html2CanvasOptions>,
  ): Promise<HTMLCanvasElement>;
}
