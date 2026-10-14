/**
 * Types for Paystack's InlineJS v2, which ships none. Only what the app uses:
 * resuming a transaction the server opened. https://paystack.com/docs/developer-tools/inlinejs/
 */
declare module '@paystack/inline-js' {
  interface PaystackCallbacks {
    /** The checkout is on screen. */
    onLoad?: (transaction: { id: number; accessCode: string }) => void
    /** The customer paid. The server still checks: this is only a hint to ask. */
    onSuccess?: (transaction: { id: number; reference: string; message: string }) => void
    onCancel?: () => void
    /** The checkout could not be loaded. */
    onError?: (error: { message: string }) => void
  }

  export default class PaystackPop {
    resumeTransaction(accessCode: string, callbacks?: PaystackCallbacks): unknown
    static isLoaded(): boolean
  }
}
