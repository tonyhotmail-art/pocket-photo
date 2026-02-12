

// Start of polyfill
import "xhr2";
// @ts-ignore
if (typeof window === "undefined" && typeof global.XMLHttpRequest === "undefined") {
    // @ts-ignore
    global.XMLHttpRequest = require("xhr2");
}
// End of polyfill
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { firebaseConfig } from "./config";

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { app, db, storage, auth, googleProvider };
