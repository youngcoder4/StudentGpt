// Firebase modules are loaded from Firebase's browser CDN.
// @ts-ignore - URL module declarations are not included with TypeScript.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
// @ts-ignore - URL module declarations are not included with TypeScript.
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-analytics.js";
// @ts-ignore - URL module declarations are not included with TypeScript.
import {
    getAuth,
    createUserWithEmailAndPassword,
    sendEmailVerification,
    updateProfile,
    setPersistence,
    browserLocalPersistence,
    GoogleAuthProvider,
    signInWithPopup
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { firebaseConfig, getFriendlyFirebaseError } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Force localStorage-backed sessions so login survives closing the browser,
// even where IndexedDB (Firebase's default) is blocked and would fall back to
// in-memory (which is lost on exit).
function ensureLocalPersistence() {
    return setPersistence(auth, browserLocalPersistence).catch((error) =>
        console.warn("Auth persistence unavailable; session may not survive restart.", error)
    );
}

try {
    getAnalytics(app);
} catch (error) {
    console.warn("Firebase Analytics is unavailable in this browser.", error);
}

const form = document.querySelector("#loginForm");
const usernameInput = document.querySelector("#username");
const emailInput = document.querySelector("#exampleInputEmail1");
const phoneInput = document.querySelector("#phone");
const passwordInput = document.querySelector("#exampleInputPassword1");
const status = document.querySelector("#loginStatus");
const showPasswordButton = document.querySelector("#showPassword");
const usernameError = document.querySelector("#usernameError");
const emailError = document.querySelector("#emailError");
const phoneError = document.querySelector("#phoneError");
const passwordError = document.querySelector("#passwordError");
const passwordGroup = document.querySelector("#passwordGroup");
const googleSignUpButton = document.querySelector("#googleSignUp");

showPasswordButton?.addEventListener("click", () => {
    if (!passwordInput) return;
    const isHidden = passwordInput.type === "password";
    passwordInput.type = isHidden ? "text" : "password";
    showPasswordButton.textContent = isHidden ? "🙈" : "👁";
    showPasswordButton.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
});

const requiredFields = [
    ...(usernameInput && usernameError ? [{ input: usernameInput, outlineTarget: usernameInput, error: usernameError }] : []),
    ...(emailInput && emailError ? [{ input: emailInput, outlineTarget: emailInput, error: emailError }] : []),
    ...(phoneInput && phoneError ? [{ input: phoneInput, outlineTarget: phoneInput, error: phoneError }] : []),
    ...(passwordInput && passwordError && passwordGroup ? [{ input: passwordInput, outlineTarget: passwordGroup, error: passwordError }] : [])
];

function isValidPassword(password) {
    return password.length >= 8 && /[A-Z]/.test(password) && /[^A-Za-z0-9]/.test(password);
}

function validateField(field) {
    const isEmpty = !field.input.value.trim();
    const hasWeakPassword = field.input === passwordInput && !isValidPassword(field.input.value);
    const isInvalid = isEmpty || hasWeakPassword || !field.input.checkValidity();

    field.outlineTarget.classList.toggle("input-missing", isInvalid);
    field.error.classList.toggle("d-none", !isInvalid);
    field.error.textContent = isEmpty
        ? "You didn't fill out this option."
        : hasWeakPassword
            ? "Password must be at least 8 characters and include an uppercase letter and a special character."
            : "Please enter a valid value.";

    return !isInvalid;
}

requiredFields.forEach((field) => {
    field.input.addEventListener("input", () => validateField(field));
});

form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!status || !usernameInput || !emailInput || !passwordInput || !phoneInput) return;

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
    status.textContent = "Creating your account...";

    try {
        await ensureLocalPersistence();
        const userCredential = await createUserWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
        await updateProfile(userCredential.user, { displayName: usernameInput.value });
        localStorage.setItem("userPhone", phoneInput.value);
        await sendEmailVerification(userCredential.user);
        window.location.href = `./VerifyEmail.html?email=${encodeURIComponent(userCredential.user.email || emailInput.value)}`;
    } catch (error) {
        status.className = "status-message text-danger";
        status.textContent = getFriendlyFirebaseError(error);
    }
});

googleSignUpButton?.addEventListener("click", async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    try {
        await ensureLocalPersistence();
        const result = await signInWithPopup(auth, provider);
        await updateProfile(result.user, {
            displayName: result.user.displayName || usernameInput?.value || "Google User"
        });

        if (!result.user.emailVerified) {
            await sendEmailVerification(result.user);
            window.location.href = `./VerifyEmail.html?email=${encodeURIComponent(result.user.email || "your email")}`;
            return;
        }

        window.location.href = "./MainMenu.html";
    } catch (error) {
        if (status) {
            status.className = "status-message text-danger";
            status.textContent = getFriendlyFirebaseError(error);
        }
    }
});
