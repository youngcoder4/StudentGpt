// If a verified user is already signed in (their session is persisted from a
// previous login), skip the public landing/auth page and go straight to the
// workspace. Included on StartMenu and SignUp; Login handles this in signin.js.
// @ts-ignore - URL module declarations are not included with TypeScript.
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
// @ts-ignore - URL module declarations are not included with TypeScript.
import {
    getAuth,
    onAuthStateChanged,
    setPersistence,
    browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

setPersistence(auth, browserLocalPersistence)
    .catch((error) => console.warn("Auth persistence unavailable.", error))
    .finally(() => {
        onAuthStateChanged(auth, (user) => {
            if (user && user.emailVerified) {
                window.location.replace("./MainMenu.html");
            }
        });
    });
