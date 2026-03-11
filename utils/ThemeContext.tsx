// ═══════════════════════════════════════════════════════════════════════════════
// FILE: utils/ThemeContext.tsx
//
// PURPOSE (用途):
//   Global theme system — defines 5 visual styles for the entire app.
//   全局主题系统 — 为整个 App 定义 5 种视觉风格。
//
// THEMES (主题):
//   🔵 Tech    — Vivid blue → purple → pink gradient (深色) 亮蓝→蓝紫→粉紫
//   🌊 Navy    — Deep teal → medium blue → ocean blue (深色) 深青蓝→中蓝→浅蓝灰
//   🌌 Galaxy  — Deep space purple + cyan nebula (深色)  深蓝紫+青色星云
//   ☁️ Sky     — Pastel yellow → lavender → soft purple (浅色) 柔黄→薰衣草→浅紫
//   ✨ Fantasy  — Dreamy white → yellow → pink → purple (浅色) 奶白→暖橙→浅粉→蓝紫
//
// HOW IT WORKS (工作原理):
//   - app/_layout.tsx uses `gradientColors` to render a full-screen LinearGradient
//     (app/_layout.tsx 用 gradientColors 渲染全屏 LinearGradient 渐变背景)
//   - All screens set backgroundColor: "transparent" so the gradient shows through
//     (所有页面设置 backgroundColor: "transparent"，让渐变透出来)
//   - isDarkTheme controls whether StatusBar uses light or dark icon color
//     (isDarkTheme 控制 StatusBar 使用浅色还是深色图标)
//
// IMPORTS (引入):
//   - AsyncStorage    → persist theme choice across app restarts (持久化主题选择)
//   - React           → component + hooks (React 组件与钩子)
//   - createContext, useContext, useEffect, useState → Context API
//
// EXPORTS (导出):
//   - ThemeKey        → type: one of the 5 theme identifiers 
//                        ("tech"|"navy"|"galaxy"|"sky"|"fantasy") (5 个主题标识符的类型)
//   - Theme           → type: full theme object with all color tokens (主题完整对象类型)
//   - THEMES          → const: record of all 5 theme definitions (5个主题的配置表)
//   - ThemeProvider   → component: wrap app to enable theme (包裹 App 的 Provider)
//   - useTheme()      → hook: get { theme, themeKey, setTheme } anywhere (获取主题的 Hook)
// ═══════════════════════════════════════════════════════════════════════════════

import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

/** Union of all valid theme keys (所有主题标识符的联合类型) */
export type ThemeKey = "tech" | "navy" | "galaxy" | "sky" | "fantasy";

/*
   Full theme object — one instance per theme.
   完整主题对象 — 每个主题有一个实例。
  
   Color token guide (颜色令牌说明):
   bg             — fallback solid bg if gradient unavailable (渐变不可用时的纯色背景)
   card           — card / surface background (卡片/面板背景)
   border         — dividers, input borders (分隔线、输入框边框)
   accent         — primary action color: buttons, selected states (主要操作色：按钮/选中)
   green          — free spots, success states (空位/成功状态)
   red            — occupied spots, errors, danger (占用/错误/危险)
   orange         — warnings, OKU indicator (警告/OKU标识)
   blue           — OKU spot color (OKU车位颜色)
   yellow         — "my spot" highlight (我的车位高亮)
   text           — primary body text (正文颜色)
   muted          — secondary / hint text (次要/提示文字)
   tabBar         — tab bar background (Tab 栏背景)
   tabBorder      — tab bar top border (Tab 栏上边框)
   isDarkTheme    — true = dark bg / light text; false = light bg / dark text
                    (true=深色主题浅色文字; false=浅色主题深色文字)
   gradientColors — array of colors for LinearGradient top-to-bottom
                    (LinearGradient 从上到下的渐变色数组)
*/
export interface Theme {
  key:             ThemeKey;
  name:            string;
  emoji:           string;
  desc:            string;
  bg:              string;
  card:            string;
  border:          string;
  accent:          string;
  green:           string;
  red:             string;
  orange:          string;
  blue:            string;
  yellow:          string;
  text:            string;
  muted:           string;
  tabBar:          string;
  tabBorder:       string;
  isDarkTheme:     boolean;
  gradientColors:  string[];
}

/*
   All 5 theme definitions.
   全部 5 个主题的配置。
   Access a theme by key: THEMES["tech"], THEMES["sky"], etc.
   通过 key 访问: THEMES["tech"], THEMES["sky"] 等。
*/
export const THEMES: Record<ThemeKey, Theme> = {

  // ── 1. Tech 科技 ─────────────────────────────────────────────────────────
  // Dark theme: Vivid blue (top) → blue-purple (mid) → pink-purple (bottom)
  // 深色主题：亮蓝（顶）→ 蓝紫（中）→ 粉紫（底）
  tech: {
    key: "tech", name: "Tech", emoji: "🔵", desc: "Vivid blue · Purple · Pink",
    bg:          "#1A35F0",   // Bright blue fallback (亮蓝兜底色)
    card:        "#0A1880",   // Deep blue card (深蓝卡片)
    border:      "#2030A0",
    accent:      "#FF80C0",   // Pink accent — strong contrast with blue (粉色强调，与蓝色强对比)
    green:       "#40E898",   // Bright emerald green (亮翠绿)
    red:         "#FF6080",   // Bright pink-red (亮粉红)
    orange:      "#FFB040",   // Bright amber (亮琥珀橙)
    blue:        "#80D0FF",   // Sky blue for OKU (天蓝OKU)
    yellow:      "#FFE040",   // Bright yellow for my spot (亮黄我的车位)
    text:        "#F0F4FF",   // Near-white text (近白文字)
    muted:       "#A0B0E0",   // Light blue muted (浅蓝次要文字)
    tabBar:      "#0A1060",   // Very dark blue tab bar (极深蓝Tab栏)
    tabBorder:   "#2030A0",
    isDarkTheme: true,
    gradientColors: [
      "#1A35F0",  // Vivid blue top (亮蓝顶部)
      "#3050E8",
      "#5048D0",  // Blue-purple mid (蓝紫中部)
      "#8840B8",
      "#C05890",  // Pink-purple bottom (粉紫底部)
    ],
  },

  // ── 2. Navy 藏青 ─────────────────────────────────────────────────────────
  // Dark theme: Deep teal (top) → mid blue → light blue-grey (bottom)
  // 深色主题：深青蓝（顶）→ 中蓝 → 浅蓝灰（底）
  navy: {
    key: "navy", name: "Navy", emoji: "🌊", desc: "Deep teal · Ocean blue · Light grey",
    bg:          "#0A5878",
    card:        "#083A50",   // Darker than gradient for layering (比渐变深，增加层次感)
    border:      "#1A6080",
    accent:      "#5CDAF0",   // Bright cyan (亮青点缀)
    green:       "#40D8A0",
    red:         "#FF7070",
    orange:      "#FFB060",
    blue:        "#80C8FF",
    yellow:      "#FFE080",
    text:        "#E8F4F8",
    muted:       "#80B0C8",
    tabBar:      "#063040",
    tabBorder:   "#1A6080",
    isDarkTheme: true,
    gradientColors: [
      "#0A5878",  // Deep teal top (深青蓝顶部)
      "#1A78A0",
      "#3090B8",  // Mid blue (中蓝)
      "#60A8C8",
      "#A8D0E0",  // Light blue-grey bottom (浅蓝灰底部)
    ],
  },

  // ── 3. Galaxy 星海 ───────────────────────────────────────────────────────
  // Dark theme: Deep blue-purple + cyan + pink-purple — starfield look
  // 深色主题：深蓝紫+青色+粉紫 — 星空感
  galaxy: {
    key: "galaxy", name: "Galaxy", emoji: "🌌", desc: "Deep space · Cyan · Purple nebula",
    bg:          "#181060",
    card:        "#201878",   // Slightly brighter than bg for depth (比背景稍亮，增加层次)
    border:      "#3828A0",
    accent:      "#50D8F0",   // Bright cyan — starlight feel (亮青，星光感)
    green:       "#50E898",
    red:         "#FF6090",
    orange:      "#FFB040",
    blue:        "#80C8FF",
    yellow:      "#FFE040",
    text:        "#F0ECFF",   // Near-white with slight purple tint (近白微紫)
    muted:       "#9888C8",   // Soft purple muted (淡紫次要文字)
    tabBar:      "#100840",
    tabBorder:   "#3828A0",
    isDarkTheme: true,
    gradientColors: [
      "#181060",  // Deep blue-purple top (深蓝紫顶部)
      "#3040B8",
      "#2898C8",  // Cyan-blue nebula (星云青蓝)
      "#9838A8",  // Purple nebula (星云紫)
      "#1820A0",  // Deep blue bottom (深蓝底部)
    ],
  },

  // ── 4. Sky 天空 ──────────────────────────────────────────────────────────
  // Light theme: Soft yellow → lavender → light blue → soft purple
  // 浅色主题：柔黄 → 薰衣草 → 浅蓝 → 浅紫
  sky: {
    key: "sky", name: "Sky", emoji: "☁️", desc: "Pastel yellow · Lavender · Soft purple",
    bg:          "#D8C8F8",
    card:        "#FFFFFF",   // White card on light bg — maximum clarity (浅色背景用白卡片，最清晰)
    border:      "#D8C8F0",
    accent:      "#7020C8",   // Deep purple — pops on light bg (深紫，在浅色背景上跳出)
    green:       "#1A8040",   // Deep green for light bg (深绿，适合浅色背景)
    red:         "#C82030",
    orange:      "#C06010",
    blue:        "#2060C0",
    yellow:      "#B07010",
    text:        "#2A1050",   // Deep purple-black text (深紫黑色文字)
    muted:       "#7060A0",
    tabBar:      "#EEE8FF",
    tabBorder:   "#D0C0F0",
    isDarkTheme: false,       // Light theme → StatusBar uses dark icons (浅色主题→状态栏深色图标)
    gradientColors: [
      "#F5F5C0",  // Soft yellow top (柔黄顶部)
      "#F5D0E8",  // Blush pink (浅粉)
      "#DDD0F5",  // Lavender (薰衣草)
      "#C8D8F8",  // Light blue (浅蓝)
      "#B8A8F0",
      "#9870D8",  // Soft purple bottom (中紫底部)
    ],
  },

  // ── 5. Fantasy 梦幻 ──────────────────────────────────────────────────────
  // Light theme: Creamy white → warm yellow → pink → blue-purple
  // 浅色主题：奶白 → 暖黄 → 浅粉 → 蓝紫
  fantasy: {
    key: "fantasy", name: "Fantasy", emoji: "✨", desc: "Dreamy white · Yellow · Pink · Purple",
    bg:          "#F0F0FF",
    card:        "#FFFFFF",
    border:      "#E8D8F8",
    accent:      "#9020D0",   // Deep purple on light bg (深紫，浅色背景上跳出)
    green:       "#1A7838",
    red:         "#C02030",
    orange:      "#B85800",
    blue:        "#1858C0",
    yellow:      "#A06010",
    text:        "#1A0A30",   // Very dark purple-black (极深紫黑)
    muted:       "#806090",
    tabBar:      "#FFF8F8",
    tabBorder:   "#EED8F0",
    isDarkTheme: false,       // Light theme (浅色主题)
    gradientColors: [
      "#FFFCE8",  // Creamy white top (奶白顶部)
      "#FFE898",  // Warm yellow (暖黄)
      "#FFCA70",  // Warm amber (暖橙黄)
      "#F8B8D8",  // Blush pink (浅粉)
      "#D8A0E8",  // Soft lilac (浅紫粉)
      "#9090E0",  // Blue-purple bottom (蓝紫底部)
    ],
  },
};

// ─── Context Shape (Context 接口) ────────────────────────────────────────────
interface ThemeContextType {
  theme:    Theme;          // Full theme object for current key (当前主题的完整对象)
  themeKey: ThemeKey;       // Active theme key string (当前激活的主题 Key)
  setTheme: (key: ThemeKey) => void;  // Switch theme (切换主题)
}

// Default context value — used before Provider mounts (Provider 挂载前的默认值)
const ThemeContext = createContext<ThemeContextType>({
  theme:    THEMES.tech,
  themeKey: "tech",
  setTheme: () => {},
});

// ─── ThemeProvider ────────────────────────────────────────────────────────────
/*
   Wrap the entire app with this Provider in app/_layout.tsx.
   在 app/_layout.tsx 中用此 Provider 包裹整个 App。
  
   - Loads saved theme from AsyncStorage on startup (启动时从 AsyncStorage 读取已保存的主题)
   - Persists theme selection when changed (切换主题时持久化到 AsyncStorage)
*/
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeKey, setThemeKey] = useState<ThemeKey>("tech"); // Default theme (默认主题)

  // Load the previously saved theme on startup (启动时读取上次保存的主题)
  useEffect(() => {
    AsyncStorage.getItem("app_theme").then(saved => {
      if (saved && saved in THEMES) setThemeKey(saved as ThemeKey);
    });
  }, []);

  /*
     Switch to a new theme and save it.
     切换到新主题并保存。
     @param key - One of the 5 ThemeKey values (5个主题 Key 之一)
  */
  function setTheme(key: ThemeKey) {
    setThemeKey(key);
    AsyncStorage.setItem("app_theme", key); // Persist choice (持久化选择)
  }

  return (
    <ThemeContext.Provider value={{ theme: THEMES[themeKey], themeKey, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ─── useTheme Hook ────────────────────────────────────────────────────────────
/*
   Custom hook — read the current theme anywhere in the app.
   自定义 Hook — 在 App 任何地方读取当前主题。
  
   Usage / 用法:
     const { theme, themeKey, setTheme } = useTheme();
     <Text style={{ color: theme.text }}>Hello</Text>
     <View style={{ backgroundColor: theme.card }}>...</View>
     setTheme("sky"); // Switch to Sky theme (切换到天空主题)
*/
export function useTheme() {
  return useContext(ThemeContext);
}