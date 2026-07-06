import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

// TODO: 把這裡換成你的 Firebase 專案設定
const firebaseConfig = {
    apiKey: "AIzaSyAKp2q_2D9Dii9peybWjD15lK-iHoTMK0M",
    authDomain: "workout-bd5dc.firebaseapp.com",
    projectId: "workout-bd5dc",
    storageBucket: "workout-bd5dc.firebasestorage.app",
    messagingSenderId: "114840071727",
    appId: "1:114840071727:web:82202b0d42c7ccf473a0da",
    measurementId: "G-L4GPR3PM0L"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);
