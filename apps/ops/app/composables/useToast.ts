/** Short confirmations after a change ("Moved. 37 tickets updated."), read out politely and gone after a few seconds. */
export interface Toast {
  id: number
  text: string
}

let next = 0

export function useToast() {
  const toasts = useState<Toast[]>('ops:toasts', () => [])

  function show(text: string) {
    const toast = { id: (next += 1), text }
    toasts.value = [...toasts.value, toast].slice(-3)
    setTimeout(() => dismiss(toast.id), 4500)
  }

  function dismiss(id: number) {
    toasts.value = toasts.value.filter((toast) => toast.id !== id)
  }

  return { toasts, show, dismiss }
}
