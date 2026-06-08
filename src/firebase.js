import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyB1itlBl7vdO5JSRTlUifMHZn09fj8LyMI",
  authDomain: "pickleball-srm.firebaseapp.com",
  databaseURL: "https://pickleball-srm-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "pickleball-srm",
  storageBucket: "pickleball-srm.firebasestorage.app",
  messagingSenderId: "1056007468517",
  appId: "1:1056007468517:web:98cb1f355cc0036f3e6b0c"
};

const app = initializeApp(firebaseConfig);

export const db        = getDatabase(app);
export const auth      = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const firestore = getFirestore(app);

// Messaging is not supported in all environments (e.g. Safari without permissions, SSR)
export const messagingPromise = isSupported().then(ok => ok ? getMessaging(app) : null).catch(() => null);
