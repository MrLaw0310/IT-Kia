/*
utils/notifications.ts — 停车相关通知辅助函数 / Parking-Related Notification Helpers

提供便捷函数来触发应用内通知，特别是停车相关的提示。
Provides convenient functions to trigger in-app notifications, especially for parking-related alerts.

工作原理 / How it works:
 - 这些函数封装了常见的通知场景，简化在 App 各处调用通知的代码
   These functions encapsulate common notification scenarios, simplifying notification calls throughout the app
 - 使用 useNotification Hook 来访问 NotificationContext
   Uses useNotification Hook to access NotificationContext
 - 所有函数都应在组件内或事件处理器中调用
   All functions should be called within components or event handlers

用法示例 / Usage Examples:
 const { addNotification } = useNotification();
 notifyParkingExpiringIn15Min(addNotification);  // 停车位即将过期提示
 notifyParkingBooked(addNotification);           // 预订成功提示

实现于 / Implemented in:
 - 停车计时器检测到过期 15 分钟时调用 notifyParkingExpiringIn15Min
 - 预订确认时调用 notifyParkingBooked
*/


/*
停车位即将在 15 分钟后过期时显示警告横幅。
Display warning banner when parking spot will expire in 15 minutes.

参数 / Parameters:
 - addNotification: NotificationContext 中的 addNotification 函数 / the addNotification function from NotificationContext

返回通知 ID 以便后续手动控制。
Returns notification ID for manual control if needed.
*/
export function notifyParkingExpiringIn15Min(
  addNotification: (
    message: string,
    type?: "success" | "warning" | "error" | "info",
    duration?: number
  ) => string
): string {
  return addNotification(
    "Your parking expires in 15 minutes.",
    "warning",
    6000 // 显示 6 秒后自动关闭 / auto-close after 6 seconds
  );
}

/*
停车预订成功时显示成功横幅。
Display success banner when parking spot is successfully booked.

参数 / Parameters:
 - addNotification: NotificationContext 中的 addNotification 函数 / the addNotification function from NotificationContext

返回通知 ID 以便后续手动控制。
Returns notification ID for manual control if needed.
*/
export function notifyParkingBooked(
  addNotification: (
    message: string,
    type?: "success" | "warning" | "error" | "info",
    duration?: number
  ) => string
): string {
  return addNotification(
    "Your parking spot has been successfully booked.",
    "success",
    5000 // 显示 5 秒后自动关闭 / auto-close after 5 seconds
  );
}

/*
预订失败或出错时显示错误横幅。
Display error banner when booking fails or an error occurs.

参数 / Parameters:
 - addNotification: NotificationContext 中的 addNotification 函数 / the addNotification function from NotificationContext
 - errorMessage: 自定义错误消息，如不提供则使用默认错误信息 / custom error message, uses default if not provided

返回通知 ID 以便后续手动控制。
Returns notification ID for manual control if needed.
*/
export function notifyParkingBookingError(
  addNotification: (
    message: string,
    type?: "success" | "warning" | "error" | "info",
    duration?: number
  ) => string,
  errorMessage?: string
): string {
  const message = errorMessage || "Failed to book parking spot. Please try again.";
  return addNotification(
    message,
    "error",
    6000 // 显示 6 秒后自动关闭 / auto-close after 6 seconds
  );
}

/*
停车已过期时显示信息横幅。
Display info banner when parking has expired.

参数 / Parameters:
 - addNotification: NotificationContext 中的 addNotification 函数 / the addNotification function from NotificationContext

返回通知 ID 以便后续手动控制。
Returns notification ID for manual control if needed.
*/
export function notifyParkingExpired(
  addNotification: (
    message: string,
    type?: "success" | "warning" | "error" | "info",
    duration?: number
  ) => string
): string {
  return addNotification(
    "Your parking time has expired.",
    "error",
    6000 // 显示 6 秒后自动关闭 / auto-close after 6 seconds
  );
}

/*
自定义通知，用于其他需要通知的场景。
Generic notification function for other scenarios.

参数 / Parameters:
 - message: 通知消息内容 / notification message content
 - type: 通知类型："success" | "warning" | "error" | "info" / notification type
 - autoCloseDuration: 自动关闭时间（毫秒），0 表示不自动关闭 / auto-close duration in ms, 0 for no auto-close

返回通知 ID 以便后续手动控制。
Returns notification ID for manual control if needed.

用法示例 / Usage:
 export function notifyCustom(
   message: string,
   type: "success" | "warning" | "error" | "info" = "info",
   autoCloseDuration: number = 5000
 ): string {
   return addNotification(message, type, autoCloseDuration);
 }
*/
export function createCustomNotification(
  addNotification: (
    message: string,
    type?: "success" | "warning" | "error" | "info",
    duration?: number
  ) => string,
  message: string,
  type: "success" | "warning" | "error" | "info" = "info",
  autoCloseDuration: number = 5000
): string {
  return addNotification(message, type, autoCloseDuration);
}
