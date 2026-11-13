import { Toast } from '@base-ui/react/toast'

// One manager per page: `toast()` called anywhere reaches whichever styled Toaster the app renders.
export const toast = Toast.createToastManager()

export const useToastManager = Toast.useToastManager
