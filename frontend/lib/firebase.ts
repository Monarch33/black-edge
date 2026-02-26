"use client";

import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  Auth,
} from "firebase/auth";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyDyIR_7kFhuDZWSUs3xbWtew-e434mctx4",
  authDomain: "black-edge-d4499.firebaseapp.com",
  projectId: "black-edge-d4499",
  storageBucket: "black-edge-d4499.firebasestorage.app",
  messagingSenderId: "122605683564",
  appId: "1:122605683564:web:9ae19c8f4cbbd7935fe949",
  measurementId: "G-RCD6T0FLFY",
};

const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth: Auth = getAuth(app);

let analytics: ReturnType<typeof getAnalytics> | undefined;
if (typeof window !== "undefined") {
  isSupported().then((yes) => {
    if (yes) analytics = getAnalytics(app);
  });
}

export { app, auth, analytics };

/**
 * Sign in with Google.
 */
export async function signInWithGoogle(): Promise<FirebaseUser | null> {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    console.error("Google sign-in error:", error);
    return null;
  }
}

/**
 * Sign out the current user.
 */
export async function signOut(): Promise<void> {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error("Sign-out error:", error);
  }
}

/**
 * Get the current user's ID token.
 */
export async function getIdToken(): Promise<string | null> {
  if (!auth?.currentUser) return null;

  try {
    return await auth.currentUser.getIdToken();
  } catch (error) {
    console.error("Failed to get ID token:", error);
    return null;
  }
}

/**
 * Subscribe to auth state changes.
 */
export function onAuthChange(
  callback: (user: FirebaseUser | null) => void
): () => void {
  return onAuthStateChanged(auth, callback);
}
