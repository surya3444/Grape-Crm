import { initializeApp } from "firebase/app";
// Change the import to include initializeAuth and persistence
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";
import { getReactNativePersistence, initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCg0Zvl4McguQkI5TVi2pvpOw58ooAqcAQ",
  authDomain: "lazytree-crm.firebaseapp.com",
  projectId: "lazytree-crm",
  storageBucket: "lazytree-crm.firebasestorage.app",
  messagingSenderId: "688544539124",
  appId: "1:688544539124:web:e0267f8fe305b4a6f259a1",
};

const app = initializeApp(firebaseConfig);

// --- FIX: Use initializeAuth instead of getAuth ---
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage),
});

const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };
