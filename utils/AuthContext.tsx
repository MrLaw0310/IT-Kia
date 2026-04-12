/*
utils/AuthContext.tsx — 全局用户身份验证状态 / Global Auth State

使用 Firebase Authentication 管理用户登录/注册/登出状态。
Manages user sign-in, registration, and sign-out via Firebase Authentication.

工作原理 / How it works:
 - onAuthStateChanged 监听 Firebase Auth 状态变化，自动更新 user 对象
   onAuthStateChanged listens for Firebase Auth state changes and updates the user object
 - user 为 null 表示未登录，app/_layout.tsx 据此跳转登录页
   user null = not logged in; app/_layout.tsx redirects to login accordingly
 - 提供 signIn / signUp / signOut 三个方法供全 App 使用
   Provides signIn / signUp / signOut methods for use anywhere in the app

用法 / Usage:
 const { user, signIn, signUp, signOut } = useAuth();
*/

import {
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  User,
} from "firebase/auth";
import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { auth } from "./firebaseConfig";

// ─── Context 接口 / Context shape ────────────────────────────────────────────
interface AuthContextType {
  user: User | null;        // 当前登录用户，null 表示未登录 / current user, null if not logged in
  loading: boolean;         // 是否正在检查登录状态 / whether auth state is still being checked
  signIn: (email: string, password: string) => Promise<void>;   // 登录 / sign in
  signUp: (email: string, password: string) => Promise<void>;   // 注册 / sign up
  signOut: () => Promise<void>;                                  // 登出 / sign out
}

// Provider 挂载前的默认值 / default value before Provider mounts
const AuthContext = createContext<AuthContextType | null>(null);

/*
AuthProvider — 在 app/_layout.tsx 中用此 Provider 包裹整个 App。
Wrap the entire app in app/_layout.tsx.

必须放在 ThemeProvider 内层，ParkingProvider 外层。
Must be placed inside ThemeProvider and outside ParkingProvider.
*/
export function AuthProvider({ children }: { children: ReactNode }) {

  const [user,    setUser]    = useState<User | null>(null);
  const [loading, setLoading] = useState(true); // 启动时检查登录状态 / checking auth state on startup

  // 监听 Firebase Auth 状态变化 / listen for Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);    // null = 未登录 / null = not logged in
      setLoading(false);        // 状态确认后停止 loading / stop loading once state is confirmed
    });

    // 组件卸载时取消监听，防止内存泄漏 / unsubscribe on unmount to prevent memory leaks
    return unsubscribe;
  }, []);

  /*
  用电邮和密码登录。
  Sign in with email and password.

  失败时抛出 Firebase 错误，调用方负责捕获并显示错误信息。
  Throws a Firebase error on failure — caller is responsible for catching and displaying it.
  */
  async function signIn(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
  }

  /*
  用电邮和密码注册新账号。
  Register a new account with email and password.

  注册成功后 Firebase 会自动登录，onAuthStateChanged 会更新 user。
  Firebase auto-signs-in after registration; onAuthStateChanged updates user automatically.
  */
  async function signUp(email: string, password: string) {
    return await createUserWithEmailAndPassword(auth, email, password);
  }

  /*
  登出当前用户。
  Sign out the current user.
  */
  async function signOut() {
    await firebaseSignOut(auth);
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

/*
useAuth — 在 App 任何地方读取当前登录状态的自定义 Hook。
Custom hook to read auth state anywhere in the app.

用法 / Usage:
 const { user, signIn, signOut } = useAuth();
 if (!user) { // 未登录 / not logged in }
*/
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}