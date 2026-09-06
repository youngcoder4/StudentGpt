// Firebase modules are loaded from Firebase's browser CDN.
// @ts-ignore - URL module declarations are not included with TypeScript.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
// @ts-ignore - URL module declarations are not included with TypeScript.
import {
    getAuth,
    getRedirectResult,
    GoogleAuthProvider,
    onAuthStateChanged,
    reload,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { firebaseConfig, getFriendlyFirebaseError } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const form = document.querySelector("#loginForm");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const status = document.querySelector("#loginStatus");
const showPasswordButton = document.querySelector("#showPassword");
const emailError = document.querySelector("#emailError");
const passwordError = document.querySelector("#passwordError");
const passwordGroup = document.querySelector("#passwordGroup");
const googleSignInButton = document.querySelector("#googleSignIn");
const rememberMe = document.querySelector("#rememberMe");

// "Keep me signed in" -> local persistence (survives browser restarts).
// Unchecked -> session persistence (signed out when the tab/browser closes).
function applyPersistence() {
    return setPersistence(
        auth,
        rememberMe && rememberMe.checked === false ? browserSessionPersistence : browserLocalPersistence
    );
}

showPasswordButton?.addEventListener("click", () => {
    if (!passwordInput) return;
    const isHidden = passwordInput.type === "password";
    passwordInput.type = isHidden ? "text" : "password";
    showPasswordButton.textContent = isHidden ? "🙈" : "👁";
    showPasswordButton.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
});

const requiredFields = [
    ...(emailInput && emailError ? [{ input: emailInput, outlineTarget: emailInput, error: emailError }] : []),
    ...(passwordInput && passwordError && passwordGroup ? [{ input: passwordInput, outlineTarget: passwordGroup, error: passwordError }] : [])
];

function validateField(field) {
    const isEmpty = !field.input.value.trim();
    const isInvalid = isEmpty || !field.input.checkValidity();
    field.outlineTarget.classList.toggle("input-missing", isInvalid);
    field.error.classList.toggle("d-none", !isInvalid);
    field.error.textContent = isEmpty ? "You didn't fill out this option." : "Please enter a valid value.";
    return !isInvalid;
}

requiredFields.forEach((field) => field.input.addEventListener("input", () => validateField(field)));

form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!status || !emailInput || !passwordInput) return;

    const firstInvalidField = requiredFields.find((field) => !validateField(field));
    if (firstInvalidField) {
        form?.classList.remove("shake");
        void form?.offsetWidth;
        form?.classList.add("shake");
        firstInvalidField.input.focus();
        firstInvalidField.input.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
    }

    status.className = "status-message text-muted";
    status.textContent = "Logging in...";

    try {
        await applyPersistence();
        const userCredential = await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
        await reload(userCredential.user);

        if (!userCredential.user.emailVerified) {
            await signOut(auth);
            status.className = "status-message text-danger";
            status.textContent = "Your email is not verified. Please use the verification link sent to your email before logging in.";
            return;
        }

        status.className = "status-message text-success";
        status.textContent = "You are logged in. Opening the workspace...";
        window.location.href = "./MainMenu.html";
    } catch (error) {
        status.className = "status-message text-danger";
        status.textContent = getFriendlyFirebaseError(error);
    }
});

googleSignInButton?.addEventListener("click", async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    try {
        await applyPersistence();
        const result = await signInWithPopup(auth, provider);

        if (!result.user.emailVerified) {
            await signOut(auth);
            status.className = "status-message text-danger";
            status.textContent = "Google account email is not verified. Please verify the email and try again.";
            return;
        }

        status.className = "status-message text-success";
        status.textContent = "Google sign-in successful. Opening the workspace...";
        window.location.href = "./MainMenu.html";
    } catch (error) {
        if (status) {
            status.className = "status-message text-danger";
            status.textContent = getFriendlyFirebaseError(error);
        }
    }
});

onAuthStateChanged(auth, async (user) => {
    if (!user || !user.emailVerified) {
        if (user) await signOut(auth);
        return;
    }
    document.body.classList.remove("d-none");
});

void getRedirectResult(auth).catch((error) => {
    console.warn("Redirect result unavailable.", error);
});
