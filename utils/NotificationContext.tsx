/*
utils/NotificationContext.tsx — 全局应用内通知状态 / Global In-App Notification State

使用 React Context 管理应用内通知（横幅/弹窗）的显示和隐藏。
Manages in-app notification (banner/modal) display and dismissal using React Context.

工作原理 / How it works:
 - notifications 数组存储当前显示的所有通知
   notifications array stores all currently displayed notifications
 - addNotification / dismissNotification / clearAllNotifications 控制通知的生命周期
   addNotification / dismissNotification / clearAllNotifications control notification lifecycle
 - 通知自动在指定时间后 (autoCloseDuration) 自动关闭
   Notifications auto-close after specified duration (autoCloseDuration)
 - 通知 UI 组件在 app/_layout.tsx 或任何需要的地方渲染 NotificationBanner 组件
   Notification UI components render NotificationBanner anywhere needed

用法 / Usage:
 const { addNotification, notifications } = useNotification();
 addNotification('Parking expires in 15 minutes', 'warning', 5000);
*/

import { createContext, ReactNode, useCallback, useContext, useState } from "react";

// ─── Notification interfaces ────────────────────────────────────────────────
export interface Notification {
  id: string;
  message: string;
  type: "success" | "warning" | "error" | "info";
  autoCloseDuration?: number; // milliseconds (0 = never auto-close)
  createdAt: number;
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (
    message: string,
    type?: Notification["type"],
    autoCloseDuration?: number
  ) => string; // returns notification ID
  dismissNotification: (id: string) => void;
  clearAllNotifications: () => void;
}

// Default context value before Provider mounts
const NotificationContext = createContext<NotificationContextType | null>(null);

/*
NotificationProvider — 在 app/_layout.tsx 中用此 Provider 包裹整个 App。
Wrap the entire app in app/_layout.tsx inside AuthProvider.

必须放在 App 结构的顶层，以便所有子组件都能访问通知功能。
Must be placed at the top of the App structure so all children can access notifications.
*/
export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  /*
  添加一条新通知。
  Add a new notification.

  自动生成唯一 ID，如果设置了 autoCloseDuration，则在该时间后自动关闭。
  Auto-generates unique ID; auto-closes after duration if specified.

  返回通知 ID 以便后续手动控制。
  Returns notification ID for manual control if needed.
  */
  const addNotification = useCallback(
    (
      message: string,
      type: Notification["type"] = "info",
      autoCloseDuration: number = 5000
    ): string => {
      const id = `notification-${Date.now()}-${Math.random()}`;
      const notification: Notification = {
        id,
        message,
        type,
        autoCloseDuration,
        createdAt: Date.now(),
      };

      setNotifications((prev) => [...prev, notification]);

      // Auto-dismiss notification after duration (if duration > 0)
      if (autoCloseDuration > 0) {
        setTimeout(() => {
          dismissNotification(id);
        }, autoCloseDuration);
      }

      return id;
    },
    []
  );

  /*
  根据 ID 移除指定的通知。
  Dismiss a specific notification by ID.
  */
  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  /*
  移除所有通知。
  Clear all notifications.
  */
  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const value: NotificationContextType = {
    notifications,
    addNotification,
    dismissNotification,
    clearAllNotifications,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

/*
useNotification Hook — 在任何函数组件中使用此 Hook 来访问通知功能。
Use this Hook in any functional component to access notification functions.

在使用前确保该组件已被 NotificationProvider 包裹。
Make sure the component is wrapped by NotificationProvider before using.
*/
export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotification must be used within a NotificationProvider"
    );
  }
  return context;
}
