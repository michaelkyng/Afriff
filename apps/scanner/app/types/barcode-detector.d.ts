/**
 * The Shape Detection API's BarcodeDetector, which TypeScript's DOM types leave
 * out. Chrome on Android has it; Safari does not, so the scanner falls back to jsQR.
 * https://wicg.github.io/shape-detection-api/#barcode-detection-api
 */
interface DetectedBarcode {
  rawValue: string
  format: string
}

declare class BarcodeDetector {
  constructor(options?: { formats: string[] })
  static getSupportedFormats(): Promise<string[]>
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>
}

interface Window {
  BarcodeDetector?: typeof BarcodeDetector
}
