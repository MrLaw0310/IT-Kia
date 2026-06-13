/*
components/NotificationBanner.tsx — 应用内通知横幅显示组件 / In-App Notification Banner Display

渲染所有活动通知的横幅/弹窗，通常放在 App 的最顶层。
Renders all active notification banners, typically placed at the top of the App.

工作原理 / How it works:
 - 监听 NotificationContext 中的 notifications 数组
   Listens to notifications array in NotificationContext
 - 为每条通知渲染一条横幅，显示消息、类型和关闭按钮
   Renders a banner for each notification with message, type, and close button
 - 支持多条通知同时显示，垂直堆叠
   Supports multiple notifications displayed simultaneously, stacked vertically
 - 根据类型应用不同的样式（颜色、图标）/ applies different styles based on type (color, icon)

用法 / Usage:
 在 app/_layout.tsx 的顶层渲染此组件：
 Render this component at the top level of app/_layout.tsx:

 <NotificationBanner />

样式注意 / Style notes:
 - 这是一个简单的纯样式实现，可根据需求自定义
   This is a simple, pure styling implementation that can be customized
 - 可选：集成 Animated API 增加进出动画
   Optional: integrate Animated API for enter/exit animations
*/

import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Notification, useNotification } from "../utils/NotificationContext";

interface NotificationBannerProps {
  position?: "top" | "bottom";
  maxVisibleNotifications?: number;
}

export default function NotificationBanner({
  position = "top",
  maxVisibleNotifications = 3,
}: NotificationBannerProps) {
  const { notifications, dismissNotification } = useNotification();

  // 限制显示的通知数量 / limit visible notifications
  const visibleNotifications = notifications.slice(0, maxVisibleNotifications);

  // 根据通知类型获取背景颜色 / get background color based on notification type
  const getBackgroundColor = (type: Notification["type"]) => {
    switch (type) {
      case "success":
        return "#10B981"; // 绿色 / green
      case "warning":
        return "#F59E0B"; // 橙色 / orange
      case "error":
        return "#EF4444"; // 红色 / red
      case "info":
      default:
        return "#3B82F6"; // 蓝色 / blue
    }
  };

  // 根据通知类型获取图标 / get icon based on notification type
  const getIcon = (type: Notification["type"]) => {
    switch (type) {
      case "success":
        return "✓"; // 对勾 / checkmark
      case "warning":
        return "⚠"; // 感叹号 / exclamation
      case "error":
        return "✕"; // 叉号 / cross
      case "info":
      default:
        return "ℹ"; // 信息 / info
    }
  };

  if (visibleNotifications.length === 0) {
    return null;
  }

  return (
    <View
      style={[
        styles.container,
        position === "top" ? styles.containerTop : styles.containerBottom,
      ]}
      pointerEvents="box-none"
    >
      {visibleNotifications.map((notification) => (
        <View
          key={notification.id}
          style={[
            styles.banner,
            {
              backgroundColor: getBackgroundColor(notification.type),
            },
          ]}
        >
          <View style={styles.bannerContent}>
            <Text style={styles.icon}>{getIcon(notification.type)}</Text>
            <Text style={styles.message} numberOfLines={2}>
              {notification.message}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => dismissNotification(notification.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.closeButton}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 999,
    paddingHorizontal: 12,
    gap: 8,
  },
  containerTop: {
    top: 0,
    paddingTop: 16,
  },
  containerBottom: {
    bottom: 0,
    paddingBottom: 16,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5, // Android shadow
  },
  bannerContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  icon: {
    fontSize: 18,
    color: "#FFF",
    marginRight: 10,
    fontWeight: "bold",
  },
  message: {
    flex: 1,
    fontSize: 14,
    color: "#FFF",
    fontWeight: "500",
  },
  closeButton: {
    fontSize: 18,
    color: "#FFF",
    fontWeight: "bold",
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
});
