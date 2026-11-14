/* Shape Detection API (Chromium); not in TypeScript's DOM lib. */
interface DetectedBarcode { rawValue: string; format: string }
declare class BarcodeDetector {
  constructor(options?: { formats: string[] });
  static getSupportedFormats(): Promise<string[]>;
  detect(source: ImageBitmapSource): Promise<DetectedBarcode[]>;
}
