/**
 * What a scan sounds and feels like, so staff can keep their eyes on the queue:
 * one bright tone to let someone in, two for a second look, a low one to stop.
 * Vibration always; sound unless muted (`afriff-door:muted`).
 */
export type Signal = 'good' | 'warn' | 'bad'

let context: AudioContext | null = null

export function useFeedback() {
  const muted = useLocalStorage('afriff-door:muted', false)

  /** Browsers only allow sound after a tap; call this from one. */
  function prime() {
    context ??= new AudioContext()
    if (context.state === 'suspended') context.resume().catch(() => {})
  }

  function tone(frequency: number, start: number, length: number) {
    if (!context) return
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = frequency
    const at = context.currentTime + start
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(0.25, at + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start(at)
    oscillator.stop(at + length + 0.02)
  }

  function signal(kind: Signal) {
    navigator.vibrate?.(kind === 'good' ? 60 : kind === 'warn' ? [70, 60, 70] : [220, 90, 220])
    if (muted.value || !context) return
    if (kind === 'good') tone(1046, 0, 0.14)
    else if (kind === 'warn') {
      tone(660, 0, 0.11)
      tone(660, 0.16, 0.11)
    }
    else tone(196, 0, 0.38)
  }

  return { muted, prime, signal }
}
