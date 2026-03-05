// ─────────────────────────────────────────────────────────────────────────────
// utils/ThemeContext.tsx
//
// 全局主题系统 — 4 种风格
// 颜色参考真实图片重新配色：
//   古风  → 水墨画：薄雾白底 + 青墨色 + 淡红点缀
//   温柔  → 梦幻薰衣草：紫粉云雾，柔和空灵
//   日系  → 樱花：奶白底 + 樱花粉 + 鸟居红 + 富士蓝
// ─────────────────────────────────────────────────────────────────────────────

import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

export type ThemeKey = "tech" | "gentle" | "ancient" | "japanese";

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

  // ── 2. 温柔风 ─────────────────────────────────────────────────────
  // 参考图：梦幻薰衣草天空，紫粉云雾，空灵柔和
  // 主色：#C8BFF0（薰衣草紫）底色偏淡紫白
  gentle: {
    key: "gentle", name: "温柔", emoji: "🌙", desc: "Lavender dream · Soft",
    bg:        "#F0EDF8",   // 极淡薰衣草白
    card:      "#FAFAFF",   // 近白略带紫调
    border:    "#DDD5F0",   // 柔紫边框
    accent:    "#8B72D4",   // 薰衣草紫（主按钮）
    green:     "#72B89A",   // 柔绿
    red:       "#D47290",   // 玫瑰粉红（不刺眼）
    orange:    "#D4976A",   // 暖橙
    blue:      "#7A9FD4",
    yellow:    "#E8A830",   // 我的车位：琥珀黄   // 天蓝
    text:      "#2E2445",   // 深紫灰正文
    muted:     "#9B90BB",   // 淡紫次要文字
    tabBar:    "#F5F0FF",   // 淡紫 Tab 栏
    tabBorder: "#DDD5F0",
    pattern:      "✦",                        // 星点装饰
    patternColor: "rgba(139,114,212,0.07)",    // 极淡紫
  },

  // ── 3. 古风 ───────────────────────────────────────────────────────
  // 参考图：水墨山水画，薄雾白纸底，青墨色建筑，淡朱红点缀
  // 像宣纸上的水彩：不是黑不是白，是那种泛黄的宣纸+青墨
  ancient: {
    key: "ancient", name: "古风", emoji: "🏯", desc: "Ink wash · Classical",
    bg:        "#F4EFE6",   // 宣纸米白
    card:      "#FBF7F0",   // 略白的纸色
    border:    "#C8B89A",   // 淡墨褐边框
    accent:    "#4A7C7E",   // 青墨色（主色）
    green:     "#5A8A6A",   // 青绿
    red:       "#B84040",   // 朱砂红（点缀）
    orange:    "#C87840",   // 赭石橙
    blue:      "#4A6A8A",
    yellow:    "#C9A84C",   // 我的车位：古铜金   // 靛青蓝
    text:      "#2A2018",   // 深墨色正文
    muted:     "#8A7860",   // 淡墨次要文字
    tabBar:    "#EDE6D8",   // 宣纸 Tab 栏
    tabBorder: "#C8B89A",
    pattern:      "水",                        // 水字装饰（水墨感）
    patternColor: "rgba(74,124,126,0.05)",     // 极淡青墨
  },

  // ── 4. 日系风 ─────────────────────────────────────────────────────
  // 参考图：樱花树+鸟居+富士山，奶白底，樱花粉，鸟居朱红
  japanese: {
    key: "japanese", name: "日系", emoji: "⛩️", desc: "Sakura · Torii · Fuji",
    bg:        "#FEF6F6",   // 樱花奶白
    card:      "#FFFFFF",   // 纯白卡片
    border:    "#F0D0D5",   // 淡樱花粉边框
    accent:    "#C94050",   // 鸟居朱红（主色）
    green:     "#6A9E78",   // 嫩竹绿
    red:       "#C94050",   // 朱红
    orange:    "#D4834A",   // 暖橙
    blue:      "#5880A8",
    yellow:    "#D4A030",   // 我的车位：灯笼金   // 富士山蓝灰
    text:      "#2A1018",   // 深墨正文
    muted:     "#A87888",   // 粉灰次要文字
    tabBar:    "#FFF0F2",   // 淡樱花粉 Tab 栏
    tabBorder: "#F0D0D5",
    pattern:      "花",                        // 花字装饰
    patternColor: "rgba(201,64,80,0.05)",      // 极淡朱红
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