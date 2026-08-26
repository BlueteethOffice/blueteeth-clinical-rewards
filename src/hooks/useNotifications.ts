import { useNotifications as useNotificationContext } from '@/context/NotificationContext';

export function useNotifications() {
  return useNotificationContext();
}
