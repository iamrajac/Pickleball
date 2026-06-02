import { useState, useEffect } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, googleProvider, firestore } from "../firebase";

const GUEST_KEY = "pkl_guest_mode";

// Called once when a Google user signs in for the first time
async function ensureUserProfile(firebaseUser) {
  const ref = doc(firestore, "users", firebaseUser.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid:       firebaseUser.uid,
      name:      firebaseUser.displayName || "Player",
      email:     firebaseUser.email,
      photoURL:  firebaseUser.photoURL || null,
      joinedAt:  serverTimestamp(),
    });
  }
}

export function useAuth() {
  // null = still loading, false = guest, object = signed-in user
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    // Check if user already chose guest mode
    if (localStorage.getItem(GUEST_KEY) === "1") {
      setIsGuest(true);
      setLoading(false);
    }

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        localStorage.removeItem(GUEST_KEY);
        setIsGuest(false);
        await ensureUserProfile(firebaseUser);
        setUser(firebaseUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      localStorage.removeItem(GUEST_KEY);
      setIsGuest(false);
    } catch (e) {
      console.error("Google sign-in failed", e);
      throw e;
    }
  };

  const signOutUser = async () => {
    await signOut(auth);
    setUser(null);
  };

  const continueAsGuest = () => {
    localStorage.setItem(GUEST_KEY, "1");
    setIsGuest(true);
  };

  const clearGuest = () => {
    localStorage.removeItem(GUEST_KEY);
    setIsGuest(false);
  };

  const isAuthenticated = !!user || isGuest;

  return {
    user,
    loading,
    isGuest,
    isAuthenticated,
    signInWithGoogle,
    signOutUser,
    continueAsGuest,
    clearGuest,
  };
}
