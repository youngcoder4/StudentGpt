// Firebase modules are loaded from Firebase's browser CDN.
// @ts-ignore - URL module declarations are not included with TypeScript.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
// @ts-ignore - URL module declarations are not included with TypeScript.
import {
    getAuth,
    onAuthStateChanged,
    signOut,
    setPersistence,
    browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const auth = getAuth(initializeApp(firebaseConfig));
const logoutButton = document.querySelector("#logoutButton");

function watchAuth() {
    onAuthStateChanged(auth, async (user) => {
        if (!user || !user.emailVerified) {
            if (user) {
                await signOut(auth);
            }
            window.location.replace("./Login.html");
            return;
        }

        document.body.classList.remove("d-none");
    });
}

// Use localStorage-backed persistence so a restored session is read from the
// same place sign-in wrote it, then start watching auth state.
setPersistence(auth, browserLocalPersistence)
    .catch((error) => console.warn("Auth persistence unavailable.", error))
    .finally(watchAuth);

logoutButton?.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "./Login.html";
});
