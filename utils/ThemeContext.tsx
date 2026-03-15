/*
utils/ThemeContext.tsx — 全局主题系统 / Global Theme System

为整个 App 定义 6 种视觉风格。
Defines 6 visual styles for the entire app.

可用主题 / Available themes:
 🔵 Tech    — 亮蓝→蓝紫→粉紫（深色）/ Vivid blue → purple → pink
 🌊 Navy    — 深青蓝→中蓝→浅蓝灰（深色）/ Deep teal → ocean blue → grey
 🌌 Galaxy  — 深蓝紫+青色星云（深色）/ Deep space purple + cyan nebula
 ☁️ Sky     — 柔黄→薰衣草→浅紫（浅色）/ Pastel yellow → lavender → soft purple
 ✨ Fantasy — 奶白→暖橙→浅粉→蓝紫（浅色）/ Dreamy white → yellow → pink → purple
 🌅 Sunset  — 淡金→柔琥珀→浅珊瑚（浅色）/ Pale gold → soft amber → warm peach

工作原理 / How it works:
 - app/_layout.tsx 用 gradientColors 渲染全屏 LinearGradient 渐变背景
   app/_layout.tsx uses gradientColors to render a full-screen LinearGradient
 - 所有页面设 transparent 背景，让渐变透出来
   All screens use transparent backgrounds so the gradient shows through
 - isDarkTheme 控制 StatusBar 使用浅色还是深色图标
   isDarkTheme controls whether StatusBar uses light or dark icon color
*/

import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

/* 所有主题标识符的联合类型 / union type of all valid theme keys */
export type ThemeKey = "tech" | "navy" | "galaxy" | "sky" | "fantasy" | "sunset";

/*
完整主题对象，每个主题有一个实例。
Full theme object — one instance per theme.

颜色令牌说明 / Color token guide:
 bg             — 渐变不可用时的纯色背景 / fallback solid bg
 card           — 卡片/面板背景 / card or surface background
 border         — 分隔线、输入框边框 / dividers and input borders
 accent         — 主要操作色：按钮/选中 / primary action: buttons, selected states
 green          — 空位/成功状态 / free spots and success
 red            — 占用/错误/危险 / occupied spots, errors, danger
 orange         — 警告/OKU标识 / warnings and OKU indicator
 blue           — OKU车位颜色 / OKU spot colour
 yellow         — 我的车位高亮 / "my spot" highlight
 text           — 正文颜色 / primary body text
 muted          — 次要/提示文字 / secondary or hint text
 tabBar         — Tab 栏背景 / tab bar background
 tabBorder      — Tab 栏上边框 / tab bar top border
 isDarkTheme    — true=深色主题浅色文字 / true = dark bg, light text
 gradientColors — LinearGradient 从上到下的渐变色数组 / top-to-bottom gradient array
*/
export interface Theme {
  key:            ThemeKey;
  name:           string;
  emoji:          string;
  desc:           string;
  bg:             string;
  card:           string;
  border:         string;
  accent:         string;
  green:          string;
  red:            string;
  orange:         string;
  blue:           string;
  yellow:         string;
  text:           string;
  muted:          string;
  tabBar:         string;
  tabBorder:      string;
  isDarkTheme:    boolean;
  gradientColors: string[];
}

/*
全部 6 个主题的配置表。通过 key 访问：THEMES["tech"]、THEMES["sky"] 等。
All 6 theme definitions. Access by key: THEMES["tech"], THEMES["sky"], etc.
*/
export const THEMES: Record<ThemeKey, Theme> = {

  // ── 1. Tech 科技 ─────────────────────────────────────────────────────────
  // 深色主题：亮蓝（顶）→ 蓝紫（中）→ 粉紫（底）
  // Dark theme: vivid blue (top) → blue-purple (mid) → pink-purple (bottom)
  tech: {
    key: "tech", name: "Tech", emoji: "🔵", desc: "Vivid blue · Purple · Pink",
    bg:          "#1A35F0",   // 亮蓝兜底色 / bright blue fallback
    card:        "#0A1880",   // 深蓝卡片 / deep blue card
    border:      "#2030A0",
    accent:      "#FF80C0",   // 粉色强调，与蓝色强对比 / pink accent, high contrast on blue
    green:       "#40E898",   // 亮翠绿 / bright emerald
    red:         "#FF6080",   // 亮粉红 / bright pink-red
    orange:      "#FFB040",   // 亮琥珀橙 / bright amber
    blue:        "#80D0FF",   // 天蓝OKU / sky blue for OKU
    yellow:      "#FFE040",   // 亮黄我的车位 / bright yellow for my spot
    text:        "#F0F4FF",   // 近白文字 / near-white
    muted:       "#A0B0E0",   // 浅蓝次要文字 / light blue muted
    tabBar:      "#0A1060",   // 极深蓝Tab栏 / very dark blue
    tabBorder:   "#2030A0",
    isDarkTheme: true,
    gradientColors: [
      "#1A35F0",  // 亮蓝顶部 / vivid blue top
      "#3050E8",
      "#5048D0",  // 蓝紫中部 / blue-purple mid
      "#8840B8",
      "#C05890",  // 粉紫底部 / pink-purple bottom
    ],
  },

  // ── 2. Navy 藏青 ─────────────────────────────────────────────────────────
  // 深色主题：深青蓝（顶）→ 中蓝 → 浅蓝灰（底）
  // Dark theme: deep teal (top) → mid blue → light blue-grey (bottom)
  navy: {
    key: "navy", name: "Navy", emoji: "🌊", desc: "Deep teal · Ocean blue · Light grey",
    bg:          "#0A5878",
    card:        "#083A50",   // 比渐变深，增加层次感 / darker than gradient for depth
    border:      "#1A6080",
    accent:      "#5CDAF0",   // 亮青点缀 / bright cyan
    green:       "#40D8A0",
    red:         "#FF7070",
    orange:      "#FFB060",
    blue:        "#80C8FF",
    yellow:      "#FFE080",
    text:        "#E8F4F8",
    muted:       "#a8d8f0",
    tabBar:      "#063040",
    tabBorder:   "#1A6080",
    isDarkTheme: false,
    gradientColors: [
      "#0A5878",  // 深青蓝顶部 / deep teal top
      "#1A78A0",
      "#3090B8",  // 中蓝 / mid blue
      "#60A8C8",
      "#A8D0E0",  // 浅蓝灰底部 / light blue-grey bottom
    ],
  },

  // ── 3. Galaxy 星海 ───────────────────────────────────────────────────────
  // 深色主题：深蓝紫+青色+粉紫 — 星空感
  // Dark theme: deep blue-purple + cyan + pink-purple — starfield look
  galaxy: {
    key: "galaxy", name: "Galaxy", emoji: "🌌", desc: "Deep space · Cyan · Purple nebula",
    bg:          "#181060",
    card:        "#201878",   // 比背景稍亮，增加层次 / slightly brighter than bg for depth
    border:      "#3828A0",
    accent:      "#50D8F0",   // 亮青，星光感 / bright cyan, starlight feel
    green:       "#50E898",
    red:         "#FF6090",
    orange:      "#FFB040",
    blue:        "#80C8FF",
    yellow:      "#FFE040",
    text:        "#F0ECFF",   // 近白微紫 / near-white with slight purple tint
    muted:       "#9888C8",   // 淡紫次要文字 / soft purple muted
    tabBar:      "#100840",
    tabBorder:   "#3828A0",
    isDarkTheme: true,
    gradientColors: [
      "#181060",  // 深蓝紫顶部 / deep blue-purple top
      "#3040B8",
      "#2898C8",  // 星云青蓝 / cyan-blue nebula
      "#9838A8",  // 星云紫 / purple nebula
      "#1820A0",  // 深蓝底部 / deep blue bottom
    ],
  },

  // ── 4. Sky 天空 ──────────────────────────────────────────────────────────
  // 浅色主题：柔黄 → 薰衣草 → 浅蓝 → 浅紫
  // Light theme: soft yellow → lavender → light blue → soft purple
  sky: {
    key: "sky", name: "Sky", emoji: "☁️", desc: "Pastel yellow · Lavender · Soft purple",
    bg:          "#D8C8F8",
    card:        "#FFFFFF",   // 浅色背景用白卡片，最清晰 / white card on light bg
    border:      "#bea5e3",
    accent:      "#7020C8",   // 深紫，在浅色背景上跳出 / deep purple pops on light bg
    green:       "#1A8040",   // 深绿，适合浅色背景 / deep green for light bg
    red:         "#C82030",
    orange:      "#C06010",
    blue:        "#2060C0",
    yellow:      "#B07010",
    text:        "#2A1050",   // 深紫黑色文字 / deep purple-black text
    muted:       "#7060A0",
    tabBar:      "#EEE8FF",
    tabBorder:   "#D0C0F0",
    isDarkTheme: false,       // 浅色主题，StatusBar 使用深色图标 / light theme, dark status bar icons
    gradientColors: [
      "#F5F5C0",  // 柔黄顶部 / soft yellow top
      "#F5D0E8",  // 浅粉 / blush pink
      "#DDD0F5",  // 薰衣草 / lavender
      "#C8D8F8",  // 浅蓝 / light blue
      "#B8A8F0",
      "#9870D8",  // 中紫底部 / soft purple bottom
    ],
  },

  // ── 5. Fantasy 梦幻 ──────────────────────────────────────────────────────
  // 浅色主题：奶白 → 暖黄 → 浅粉 → 蓝紫
  // Light theme: creamy white → warm yellow → pink → blue-purple
  fantasy: {
    key: "fantasy", name: "Fantasy", emoji: "✨", desc: "Dreamy white · Yellow · Pink · Purple",
    bg:          "#F0F0FF",
    card:        "#FFFFFF",
    border:      "#d1bae8",
    accent:      "#9020D0",   // 深紫，浅色背景上跳出 / deep purple pops on light bg
    green:       "#1A7838",
    red:         "#C02030",
    orange:      "#B85800",
    blue:        "#1858C0",
    yellow:      "#A06010",
    text:        "#1A0A30",   // 极深紫黑 / very dark purple-black
    muted:       "#806090",
    tabBar:      "#FFF8F8",
    tabBorder:   "#EED8F0",
    isDarkTheme: false,       // 浅色主题 / light theme
    gradientColors: [
      "#FFFCE8",  // 奶白顶部 / creamy white top
      "#FFE898",  // 暖黄 / warm yellow
      "#FFCA70",  // 暖橙黄 / warm amber
      "#F8B8D8",  // 浅粉 / blush pink
      "#D8A0E8",  // 浅紫粉 / soft lilac
      "#9090E0",  // 蓝紫底部 / blue-purple bottom
    ],
  },

  // ── 6. Sunset 日落 ───────────────────────────────────────────────────────
  // 浅色主题：淡金（顶）→ 柔琥珀 → 暖桃粉 → 浅珊瑚（底）— 取自日落海面照片
  // Light theme: pale gold (top) → soft amber → warm peach → light coral (bottom)
  sunset: {
    key: "sunset", name: "Sunset", emoji: "🌅", desc: "Pale gold · Soft amber · Warm peach",
    bg:          "#FFD8A0",   // 柔琥珀兜底色 / soft amber fallback
    card:        "#FFFFFF",   // 浅色背景用白卡片，最清晰 / white card on light bg
    border:      "#F0C888",   // 暖金边框 / warm gold border
    accent:      "#C05010",   // 深焦橙，浅色背景上跳出 / deep burnt orange pops on light bg
    green:       "#2A7830",   // 深森绿，适合浅色背景 / deep forest green for light bg
    red:         "#C02820",   // 深红 / deep red
    orange:      "#D06010",   // 暖焦橙 / warm burnt orange
    blue:        "#2060B0",   // 深蓝，与橙形成对比 / deep blue contrasts with orange
    yellow:      "#A06000",   // 深琥珀，我的车位 / deep amber for my spot
    text:        "#2A1000",   // 极深棕黑文字 / very dark brown-black text
    muted:       "#9B6E3A",   // 暖太妃棕 / warm toffee brown
    tabBar:      "#FFE8C0",   // 淡暖奶油Tab栏 / pale warm cream
    tabBorder:   "#F0C880",   // 柔金Tab边框 / soft gold tab border
    isDarkTheme: false,       // 浅色主题 / light theme
    gradientColors: [
      "#FFF4C0",  // 淡金顶部，柔和光晕 / pale gold top
      "#FFD888",  // 暖蜂蜜黄 / warm honey yellow
      "#FFBA70",  // 柔琥珀，地平线 / soft amber horizon
      "#F09868",  // 暖桃粉 / warm peach
      "#E87858",  // 浅珊瑚底部，海面倒影 / light coral bottom
    ],
  },
};

// ─── Context 接口 / Context shape ────────────────────────────────────────────
interface ThemeContextType {
  theme: Theme; // 当前主题的完整对象 / full theme object for current key
  themeKey: ThemeKey; // 当前激活的主题 Key / active theme key string
  setTheme: (key: ThemeKey) => void; // 切换主题 / switch theme
}

// Provider 挂载前的默认值 / default context value before Provider mounts
const ThemeContext = createContext<ThemeContextType>({
  theme: THEMES.tech,
  themeKey: "tech",
  setTheme: () => {},
});

/*
ThemeProvider — 在 app/_layout.tsx 中用此 Provider 包裹整个 App。
Wrap the entire app in app/_layout.tsx.

启动时从 AsyncStorage 读取已保存的主题，切换时持久化新选择。
Loads saved theme on startup and persists changes.
*/
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeKey, setThemeKey] = useState<ThemeKey>("tech"); // 默认主题 / default theme

  // 启动时读取上次保存的主题 / load previously saved theme on startup
  useEffect(() => {
    AsyncStorage.getItem("app_theme").then(saved => {
      if (saved && saved in THEMES) {
        setThemeKey(saved as ThemeKey);
      }
    });
  }, []);

  /*
  切换到新主题并持久化到 AsyncStorage。
  Switches to a new theme and saves the choice.

  @param key 6个主题 Key 之一 / one of the ThemeKey values
  */
  function setTheme(key: ThemeKey) {
    setThemeKey(key);
    AsyncStorage.setItem("app_theme", key); // 持久化选择 / persist choice
  }

  return (
    <ThemeContext.Provider value={{ theme: THEMES[themeKey], themeKey, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/*
useTheme — 在 App 任何地方读取当前主题的自定义 Hook。
Custom hook to read the current theme anywhere in the app.

用法 / Usage:
 const { theme, themeKey, setTheme } = useTheme();
 <Text style={{ color: theme.text }}>Hello</Text>
 setTheme("sky"); // 切换到天空主题 / switch to Sky theme
*/
export function useTheme() {
  return useContext(ThemeContext);
}