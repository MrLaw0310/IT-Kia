// ─────────────────────────────────────────────────────────────────────────────
// utils/ThemeContext.tsx
//
// 全局主题系统 — 5 种风格
// 科技 / 藏青 / 星海 / 天空 / 梦幻
//
// 渐变背景由 app/_layout.tsx 的 LinearGradient 统一渲染
// 各屏幕背景设为 transparent 让渐变透出来
// ─────────────────────────────────────────────────────────────────────────────

import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

export type ThemeKey = "tech" | "navy" | "galaxy" | "sky" | "fantasy";

export interface Theme {
  key:             ThemeKey;
  name:            string;
  emoji:           string;
  desc:            string;
  bg:              string;    // 渐变不可用时的纯色兜底
  card:            string;    // 卡片背景（需与渐变背景有明显层次）
  border:          string;    // 边框
  accent:          string;    // 主要强调色（按钮/选中）
  green:           string;    // 空位
  red:             string;    // 占用
  orange:          string;    // 警告
  blue:            string;    // OKU 专用
  yellow:          string;    // 我的车位高亮
  text:            string;    // 正文（深色主题用浅色，浅色主题用深色）
  muted:           string;    // 次要文字
  tabBar:          string;    // Tab 栏背景
  tabBorder:       string;    // Tab 栏上边框
  isDarkTheme:     boolean;   // true=深色主题(浅字), false=浅色主题(深字)
  gradientColors:  string[];  // LinearGradient 渐变色数组（从上到下）
}

export const THEMES: Record<ThemeKey, Theme> = {

  // ── 1. 科技 Tech ─────────────────────────────────────────────────
  // 参考图4：亮蓝（顶）→ 蓝紫（中）→ 粉紫（底）
  // 深色主题，浅色文字
  tech: {
    key: "tech", name: "Tech", emoji: "🔵", desc: "Vivid blue · Purple · Pink",
    bg:          "#1A35F0",  // 渐变兜底色（亮蓝）
    card:        "#0A1880",  // 深蓝卡片（比渐变深，层次感）
    border:      "#2030A0",  // 边框
    accent:      "#FF80C0",  // 粉色点缀（与蓝色强对比）
    green:       "#40E898",  // 亮翠绿（空位）
    red:         "#FF6080",  // 亮粉红（占用）
    orange:      "#FFB040",  // 亮橙（警告）
    blue:        "#80D0FF",  // 天蓝（OKU）
    yellow:      "#FFE040",  // 亮黄（我的车位）
    text:        "#F0F4FF",  // 近白正文
    muted:       "#A0B0E0",  // 浅蓝次要文字
    tabBar:      "#0A1060",  // 深蓝 Tab 栏
    tabBorder:   "#2030A0",
    isDarkTheme: true,
    gradientColors: [
      "#1A35F0",  // 亮蓝（顶部）
      "#3050E8",  // 中蓝
      "#5048D0",  // 蓝紫
      "#8840B8",  // 紫
      "#C05890",  // 粉紫（底部）
    ],
  },

  // ── 2. 藏青 Navy ─────────────────────────────────────────────────
  // 参考图2：深青蓝（顶）→ 中蓝（中）→ 浅蓝灰（底）
  // 深色主题，浅色文字
  navy: {
    key: "navy", name: "Navy", emoji: "🌊", desc: "Deep teal · Ocean blue · Light grey",
    bg:          "#0A5878",  // 渐变兜底色（深青蓝）
    card:        "#083A50",  // 深海蓝卡片（比渐变深）
    border:      "#1A6080",  // 边框
    accent:      "#5CDAF0",  // 亮青点缀
    green:       "#40D8A0",  // 亮翠绿（空位）
    red:         "#FF7070",  // 亮红（占用）
    orange:      "#FFB060",  // 亮橙（警告）
    blue:        "#80C8FF",  // 天蓝（OKU）
    yellow:      "#FFE080",  // 亮黄（我的车位）
    text:        "#E8F4F8",  // 近白正文
    muted:       "#80B0C8",  // 浅蓝次要文字
    tabBar:      "#063040",  // 极深青 Tab 栏
    tabBorder:   "#1A6080",
    isDarkTheme: true,
    gradientColors: [
      "#0A5878",  // 深青蓝（顶部）
      "#1A78A0",  // 中青蓝
      "#3090B8",  // 中蓝
      "#60A8C8",  // 浅蓝
      "#A8D0E0",  // 浅蓝灰（底部）
    ],
  },

  // ── 3. 星海 Galaxy ───────────────────────────────────────────────
  // 参考图3：深蓝紫 + 青色 + 粉紫 + 星光白 混色星空
  // 深色主题，浅色文字
  galaxy: {
    key: "galaxy", name: "Galaxy", emoji: "🌌", desc: "Deep space · Cyan · Purple nebula",
    bg:          "#181060",  // 渐变兜底色（深蓝紫）
    card:        "#201878",  // 深紫蓝卡片（比渐变微亮，层次感）
    border:      "#3828A0",  // 边框
    accent:      "#50D8F0",  // 亮青点缀（星光感）
    green:       "#50E898",  // 亮翠绿（空位）
    red:         "#FF6090",  // 亮粉红（占用）
    orange:      "#FFB040",  // 亮橙（警告）
    blue:        "#80C8FF",  // 天蓝（OKU）
    yellow:      "#FFE040",  // 亮黄（我的车位）
    text:        "#F0ECFF",  // 近白正文（微紫）
    muted:       "#9888C8",  // 淡紫次要文字
    tabBar:      "#100840",  // 极深紫 Tab 栏
    tabBorder:   "#3828A0",
    isDarkTheme: true,
    gradientColors: [
      "#181060",  // 深蓝紫（顶部）
      "#3040B8",  // 亮蓝紫
      "#2898C8",  // 亮青蓝（星云青）
      "#9838A8",  // 粉紫（星云紫）
      "#1820A0",  // 深蓝（底部）
    ],
  },

  // ── 4. 天空 Sky ──────────────────────────────────────────────────
  // 参考图1：柔黄（左上）→ 浅粉 → 薰衣草 → 浅蓝 → 中紫（底）
  // 浅色主题，深色文字
  sky: {
    key: "sky", name: "Sky", emoji: "☁️", desc: "Pastel yellow · Lavender · Soft purple",
    bg:          "#D8C8F8",  // 渐变兜底色（浅薰衣草）
    card:        "#FFFFFF",  // 白色卡片（浅色背景用白卡片，最清晰）
    border:      "#D8C8F0",  // 浅紫边框
    accent:      "#7020C8",  // 深紫点缀（浅底深色跳出）
    green:       "#1A8040",  // 深绿（浅底深色）
    red:         "#C82030",  // 深红（浅底深色）
    orange:      "#C06010",  // 深橙（浅底深色）
    blue:        "#2060C0",  // 深蓝（浅底深色）
    yellow:      "#B07010",  // 深金（浅底深色）
    text:        "#2A1050",  // 深紫文字（浅底）
    muted:       "#7060A0",  // 中紫次要文字
    tabBar:      "#EEE8FF",  // 浅紫 Tab 栏
    tabBorder:   "#D0C0F0",
    isDarkTheme: false,      // 浅色主题 → StatusBar 深色
    gradientColors: [
      "#F5F5C0",  // 柔黄（顶部）
      "#F5D0E8",  // 浅粉
      "#DDD0F5",  // 薰衣草
      "#C8D8F8",  // 浅蓝
      "#B8A8F0",  // 浅紫
      "#9870D8",  // 中紫（底部）
    ],
  },

  // ── 5. 梦幻 Fantasy ──────────────────────────────────────────────
  // 参考图5：奶白（中）→ 柔黄 → 暖橙 → 浅粉 → 蓝紫（角落）
  // 浅色主题，深色文字
  fantasy: {
    key: "fantasy", name: "Fantasy", emoji: "✨", desc: "Dreamy white · Yellow · Pink · Purple",
    bg:          "#F0F0FF",  // 渐变兜底色（极浅蓝白）
    card:        "#FFFFFF",  // 白色卡片
    border:      "#E8D8F8",  // 浅粉紫边框
    accent:      "#9020D0",  // 深紫点缀（浅底深色跳出）
    green:       "#1A7838",  // 深绿
    red:         "#C02030",  // 深红
    orange:      "#B85800",  // 深橙
    blue:        "#1858C0",  // 深蓝
    yellow:      "#A06010",  // 深金
    text:        "#1A0A30",  // 极深紫文字
    muted:       "#806090",  // 中紫粉次要文字
    tabBar:      "#FFF8F8",  // 极浅粉白 Tab 栏
    tabBorder:   "#EED8F0",
    isDarkTheme: false,      // 浅色主题 → StatusBar 深色
    gradientColors: [
      "#FFFCE8",  // 奶白（顶部）
      "#FFE898",  // 柔黄
      "#FFCA70",  // 暖橙黄
      "#F8B8D8",  // 浅粉
      "#D8A0E8",  // 浅紫粉
      "#9090E0",  // 蓝紫（底部）
    ],
  },
};

// ─── Context ──────────────────────────────────────────────────────────────────
interface ThemeContextType {
  theme:    Theme;
  themeKey: ThemeKey;
  setTheme: (key: ThemeKey) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme:    THEMES.tech,
  themeKey: "tech",
  setTheme: () => {},
});

// ─── ThemeProvider — 放在 app/_layout.tsx 最外层 ──────────────────────────────
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeKey, setThemeKey] = useState<ThemeKey>("tech");

  // 启动时读取上次保存的主题
  useEffect(() => {
    AsyncStorage.getItem("app_theme").then(saved => {
      if (saved && saved in THEMES) setThemeKey(saved as ThemeKey);
    });
  }, []);

  // 切换主题并持久化
  function setTheme(key: ThemeKey) {
    setThemeKey(key);
    AsyncStorage.setItem("app_theme", key);
  }

  return (
    <ThemeContext.Provider value={{ theme: THEMES[themeKey], themeKey, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ─── useTheme Hook ─────────────────────────────────────────────────────────────
// 用法：const { theme, themeKey, setTheme } = useTheme();
export function useTheme() {
  return useContext(ThemeContext);
}