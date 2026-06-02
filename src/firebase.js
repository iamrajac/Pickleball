import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

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
export const db = getDatabase(app);
