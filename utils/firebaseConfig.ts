/*
utils/firebaseConfig.ts — Firebase 初始化配置 / Firebase Initialisation Config

初始化 Firebase App，并导出 Firestore 和 Auth 实例供全 App 使用。
Initialises the Firebase App and exports Firestore + Auth instances for use across the app.

注意：React Native 需要用 getReactNativePersistence 搭配 AsyncStorage，
      否则 signInWithEmailAndPassword 会失败或登录状态无法持久化。
Note: React Native requires getReactNativePersistence with AsyncStorage,
      otherwise signInWithEmailAndPassword fails or auth state doesn't persist.

使用方法 / Usage:
  import { db, auth } from "../utils/firebaseConfig";
*/

import AsyncStorage from "@react-native-async-storage/async-storage";
import { initializeApp } from "firebase/app";
import { getReactNativePersistence, initializeAuth } from "firebase/auth";
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

// ─── Firebase Auth 实例 / Firebase Auth instance ─────────────────────────────
// React Native 必须用 initializeAuth + getReactNativePersistence
// 不能用 getAuth()，否则登录状态无法在 AsyncStorage 里持久化，导致登入失败
// Must use initializeAuth + getReactNativePersistence in React Native
// Using getAuth() instead causes login to fail or not persist across app restarts
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

// ─── Firestore 数据库实例 / Firestore database instance ──────────────────────
// 用于实时停车格子状态、用户数据、历史记录等
// Used for real-time spot status, user data, history, etc.
export const db = getFirestore(app);

export default app;