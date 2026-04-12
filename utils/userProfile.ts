import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebaseConfig";

export interface UserProfile {
  name: string;
  course: string;
  year: string;
  phone: string;
  studentId: string;
}

// 读取用户资料
export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return snap.data() as UserProfile;
  }
  return null;
}

// 注册时创建空资料
export async function createUserProfile(uid: string, email: string) {
  const ref = doc(db, "users", uid);
  await setDoc(ref, {
    name: "",
    course: "",
    year: "",
    phone: "",
    studentId: "",
    email: email,
  });
}

// 更新用户资料
export async function updateUserProfile(uid: string, data: Partial<UserProfile>) {
  const ref = doc(db, "users", uid);
  await setDoc(ref, data, { merge: true });
}