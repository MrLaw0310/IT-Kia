// ─────────────────────────────────────────────────────────────────────────────
// utils/ThemeContext.tsx
//
// 全局主题系统 — 5 种风格
// Tech (default) / Nordic / Vintage / Mystic / Autumn
// ─────────────────────────────────────────────────────────────────────────────

import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

export type ThemeKey = "tech" | "nordic" | "vintage" | "mystic" | "autumn";

export interface Theme {
  key:           ThemeKey;
  name:          string;
  emoji:         string;
  desc:          string;
  bg:            string;   // 页面背景
  card:          string;   // 卡片背景
  border:        string;   // 边框
  accent:        string;   // 主要强调色（按钮、选中）
  green:         string;   // 成功/空位
  red:           string;   // 错误/占用
  orange:        string;   // 警告
  blue:          string;   // OKU 专用
  yellow:        string;   // 我的停车位高亮色
  text:          string;   // 正文
  muted:         string;   // 次要文字
  tabBar:        string;   // Tab 栏背景
  tabBorder:     string;   // Tab 栏上边框
  pattern?:      string;   // 背景装饰字符
  patternColor?: string;   // 装饰字符颜色
}

export const THEMES: Record<ThemeKey, Theme> = {

  // ── 1. 科技深色（默认）────────────────────────────────────────────
  // 深蓝黑底，霓虹蓝高亮，未来感
  tech: {
    key: "tech", name: "Tech", emoji: "🌌", desc: "Dark sci-fi · Default",
    bg:        "#060D1F",
    card:      "#0D1B38",
    border:    "#1A2F5A",
    accent:    "#1E90FF",
    green:     "#22C55E",
    red:       "#EF4444",
    orange:    "#F97316",
    blue:      "#818CF8",
    yellow:    "#FBBF24",   // 我的车位：金黄色
    text:      "#E8F0FF",
    muted:     "#6B7FA8",
    tabBar:    "#080F22",
    tabBorder: "#1A2F5A",
    // 科技风无背景装饰
  },

  // ══════════════════════════════════════════════════════════════════
  // 配色原则 6:3:1（参考丁香医生 / ofo 的三色层次）
  //
  //  6 → bg     主背景色（大面积铺底，最轻的颜色）
  //  3 → card   配合色（卡片/区块的主体颜色，跟背景搭但有层次感）
  //  1 → accent 点缀色（按钮/徽章/高亮，跳出背景的对比色）
  //
  //  例子：
  //    丁香医生 → 6=淡紫白 / 3=紫色 / 1=橙色
  //    ofo     → 6=米白  / 3=黄色 / 1=红色
  // ══════════════════════════════════════════════════════════════════

  // ── 2. Nordic ─────────────────────────────────────────────────────
  //  6 背景: #F2F4F5  冷雾白（大面积铺底）
  //  3 卡片: #B8CDD6  灰蓝色（卡片/区块主体，30% 面积）
  //  1 点缀: #1A3D4F  深海军蓝（按钮/高亮，10% 跳出）
  nordic: {
    key: "nordic", name: "Nordic", emoji: "🌊", desc: "Nordic coast · Cool grey · Calm",
    bg:        "#F2F4F5",   // 6 ── 主背景（冷雾白，大面积）
    card:      "#B8CDD6",   // 3 ── 卡片色（灰蓝，独立配合色）
    border:    "#9ABAC6",   // 边框（卡片色深一阶）
    accent:    "#1A3D4F",   // 1 ── 点缀色（深海军蓝，对比跳出）
    green:     "#2A6040",
    red:       "#803038",
    orange:    "#806040",
    blue:      "#2A5878",
    yellow:    "#706020",
    text:      "#0A2030",   // 深色正文（浅底配深字）
    muted:     "#5A7888",   // 次要文字（卡片色调）
    tabBar:    "#F2F4F5",   // Tab 栏跟主背景一致
    tabBorder: "#9ABAC6",
  },

  // ── 3. Vintage ───────────────────────────────────────────────────
  //  6 背景: #F5F0E6  宣纸米白（大面积铺底）
  //  3 卡片: #C8B080  暖金褐（卡片/区块主体，30% 面积）
  //  1 点缀: #2C1A08  深墨棕（按钮/高亮，10% 跳出）
  vintage: {
    key: "vintage", name: "Vintage", emoji: "☕", desc: "Vintage café · Warm kraft · Earthy",
    bg:        "#F5F0E6",   // 6 ── 主背景（宣纸米白，大面积）
    card:      "#C8B080",   // 3 ── 卡片色（暖金褐，独立配合色）
    border:    "#B09060",   // 边框（卡片色深一阶）
    accent:    "#2C1A08",   // 1 ── 点缀色（深墨棕，对比跳出）
    green:     "#385840",
    red:       "#782828",
    orange:    "#785020",
    blue:      "#304858",
    yellow:    "#685010",
    text:      "#180A00",   // 深墨正文
    muted:     "#786040",   // 次要文字（卡片色调）
    tabBar:    "#F5F0E6",   // Tab 栏跟主背景一致
    tabBorder: "#B09060",
    pattern:      "墨",
    patternColor: "rgba(44,26,8,0.05)",
  },

  // ── 4. Mystic ───────────────────────────────────────────────────
  //  6 背景: #0E0E1C  极深夜蓝（大面积铺底）
  //  3 卡片: #2E2060  深紫（卡片/区块主体，30% 面积）
  //  1 点缀: #D0B8FF  亮薰衣草（按钮/高亮，10% 跳出）
  mystic: {
    key: "mystic", name: "Mystic", emoji: "🌌", desc: "Deep space · Midnight purple · Mystic",
    bg:        "#0E0E1C",   // 6 ── 主背景（极深夜蓝，大面积）
    card:      "#2E2060",   // 3 ── 卡片色（深紫，独立配合色）
    border:    "#3E3070",   // 边框（卡片色亮一阶）
    accent:    "#D0B8FF",   // 1 ── 点缀色（亮薰衣草，对比跳出）
    green:     "#48D880",
    red:       "#E05050",
    orange:    "#E09848",
    blue:      "#88A8FF",
    yellow:    "#E0C848",
    text:      "#F0ECFF",   // 亮色正文（深底配浅字）
    muted:     "#9888C8",   // 次要文字（卡片色调偏亮）
    tabBar:    "#0E0E1C",   // Tab 栏跟主背景一致
    tabBorder: "#3E3070",
    pattern:      "✦",
    patternColor: "rgba(208,184,255,0.08)",
  },

  // ── 5. Autumn ───────────────────────────────────────────────────
  //  6 背景: #FFF4EC  奶油暖白（大面积铺底）
  //  3 卡片: #FFBB88  蜜桃橙（卡片/区块主体，30% 面积）
  //  1 点缀: #802000  深砖红（按钮/高亮，10% 跳出）
  autumn: {
    key: "autumn", name: "Autumn", emoji: "🍂", desc: "Autumn sunset · Peach · Cozy",
    bg:        "#FFF4EC",   // 6 ── 主背景（奶油暖白，大面积）
    card:      "#FFBB88",   // 3 ── 卡片色（蜜桃橙，独立配合色）
    border:    "#F0A060",   // 边框（卡片色深一阶）
    accent:    "#802000",   // 1 ── 点缀色（深砖红，对比跳出）
    green:     "#306030",
    red:       "#902020",
    orange:    "#904818",
    blue:      "#304870",
    yellow:    "#905010",
    text:      "#200800",   // 深暖棕正文
    muted:     "#906040",   // 次要文字（卡片色调）
    tabBar:    "#FFF4EC",   // Tab 栏跟主背景一致
    tabBorder: "#F0A060",
    pattern:      "☀",
    patternColor: "rgba(128,32,0,0.05)",
  },
};

// ─── Context ──────────────────────────────────────────────────────────
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

// ─── ThemeProvider — 放在 app/_layout.tsx 最外层 ──────────────────────
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeKey, setThemeKey] = useState<ThemeKey>("tech");

  // 启动时读取上次保存的主题
  useEffect(() => {
    AsyncStorage.getItem("app_theme").then(saved => {
      if (saved && saved in THEMES) setThemeKey(saved as ThemeKey);
    });
  }, []);

  // 切换主题并保存
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

// ─── useTheme Hook ────────────────────────────────────────────────────
// 用法：const { theme, themeKey, setTheme } = useTheme();
export function useTheme() {
  return useContext(ThemeContext);
}