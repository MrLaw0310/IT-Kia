/*
utils/firebaseConfig.ts — Firebase 初始化配置 / Firebase Initialisation Config

初始化 Firebase App，并导出 Firestore 和 Auth 实例供全 App 使用。
Initialises the Firebase App and exports Firestore + Auth instances for use across the app.

使用方法 / Usage:
  import { db, auth } from "../utils/firebaseConfig";
*/

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// ─── Firebase 项目配置 / Firebase project config ──────────────────────────────
// 这些值来自 Firebase 控制台 → Project Settings → Your apps
// These values come from Firebase Console → Project Settings → Your apps
const firebaseConfig = {
  apiKey:            "AIzaSyCo39Zt7e31mvXqzpLtYmpJB2mDy67YjpM",
  authDomain:        "parking-system-c2317.firebaseapp.com",
  projectId:         "parking-system-c2317",
  storageBucket:     "parking-system-c2317.firebasestorage.app",
  messagingSenderId: "1067629755415",
  appId:             "1:1067629755415:web:6575b78146c188564bb052",
  measurementId:     "G-1RBCJS0LLT",
};

// ─── 初始化 Firebase App / Initialise Firebase App ────────────────────────────
const app = initializeApp(firebaseConfig);

// ─── Firestore 数据库实例 / Firestore database instance ──────────────────────
// 用于实时停车格子状态、用户数据、历史记录等
// Used for real-time spot status, user data, history, etc.
export const db = getFirestore(app);

// ─── Firebase Auth 实例 / Firebase Auth instance ─────────────────────────────
// 用于用户登录、注册、登出
// Used for user sign-in, registration, and sign-out
export const auth = getAuth(app);

export default app;
