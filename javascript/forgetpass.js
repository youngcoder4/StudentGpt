// Firebase password reset, done the way Firebase actually works:
//   1. User enters their email -> sendPasswordResetEmail() emails them a link.
//   2. The link (Firebase's action handler, or this page if you set a custom
//      Action URL in the Firebase Console) reopens with ?mode=resetPassword&oobCode=...
//   3. We verify the oobCode, collect a new password, and confirmPasswordReset().
// There is no 6-digit code: Firebase never sends one for password resets.
// @ts-ignore - URL module declarations are not included with TypeScript.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
// @ts-ignore - URL module declarations are not included with TypeScript.
import {
    getAuth,
    sendPasswordResetEmail,
    verifyPasswordResetCode,
    confirmPasswordReset
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { firebaseConfig, getFriendlyFirebaseError } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// ---- Sections ----
const emailSection = document.getElementById("emailSection");
const emailSentSection = document.getElementById("emailSentSection");
const passwordSection = document.getElementById("passwordSection");
const successSection = document.getElementById("successSection");
const invalidSection = document.getElementById("invalidSection");

// ---- Email step ----
const emailForm = document.getElementById("emailForm");
const resetEmailInput = document.getElementById("resetEmail");
const sendLinkBtn = document.getElementById("sendLinkBtn");
const emailStatus = document.getElementById("emailStatus");
const emailFormError = document.getElementById("emailFormError");
const sentToEmail = document.getElementById("sentToEmail");

// ---- New password step ----
const newPasswordForm = document.getElementById("newPasswordForm");
const resetAccountEmail = document.getElementById("resetAccountEmail");
const newPasswordInput = document.getElementById("newPassword");
const confirmPasswordInput = document.getElementById("confirmPassword");
const showNewPassword = document.getElementById("showNewPassword");
const showConfirmPassword = document.getElementById("showConfirmPassword");
const resetPasswordBtn = document.getElementById("resetPasswordBtn");
const passwordStatus = document.getElementById("passwordStatus");
const passwordError = document.getElementById("passwordError");
const confirmPasswordError = document.getElementById("confirmPasswordError");
const strengthMeter = document.getElementById("strengthMeter");
const strengthText = document.getElementById("strengthText");

// ---- State ----
let activeOobCode = "";

// ============ PASSWORD VALIDATION ============

function checkPasswordRequirements(password) {
    return {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /\d/.test(password),
        special: /[!@#$%^&*()_+\-=\[\]{};:'",.<>?/\\|`~]/.test(password)
    };
}

function getPasswordStrength(password) {
    const metCount = Object.values(checkPasswordRequirements(password)).filter(Boolean).length;
    if (metCount <= 2) return "weak";
    if (metCount <= 3) return "medium";
    return "strong";
}

function isPasswordValid(password) {
    const reqs = checkPasswordRequirements(password);
    return reqs.length && reqs.uppercase && reqs.lowercase && reqs.number && reqs.special;
}

function updateRequirements(reqs) {
    [
        { id: "req-length", met: reqs.length },
        { id: "req-uppercase", met: reqs.uppercase },
        { id: "req-lowercase", met: reqs.lowercase },
        { id: "req-number", met: reqs.number },
        { id: "req-special", met: reqs.special }
    ].forEach((req) => {
        const element = document.getElementById(req.id);
        const icon = document.getElementById(`${req.id}-icon`);
        if (element) {
            element.classList.toggle("met", req.met);
            if (icon) icon.textContent = req.met ? "✓" : "○";
        }
    });
}

function updatePasswordStrength(password) {
    const bars = strengthMeter ? strengthMeter.querySelectorAll(".strength-bar") : [];

    if (!password) {
        if (strengthText) {
            strengthText.textContent = "-";
            strengthText.className = "strength-text";
        }
        bars.forEach((bar) => (bar.className = "strength-bar"));
        updateRequirements(checkPasswordRequirements(""));
        return;
    }

    const strength = getPasswordStrength(password);
    if (strengthText) {
        strengthText.textContent = strength.charAt(0).toUpperCase() + strength.slice(1);
        strengthText.className = `strength-text ${strength}`;
    }
    bars.forEach((bar, index) => {
        bar.className = "strength-bar";
        if (strength === "weak" && index === 0) bar.classList.add("weak");
        else if (strength === "medium" && index <= 1) bar.classList.add("medium");
        else if (strength === "strong" && index <= 2) bar.classList.add("strong");
    });
    updateRequirements(checkPasswordRequirements(password));
}

function refreshResetButton() {
    const password = newPasswordInput?.value || "";
    const confirm = confirmPasswordInput?.value || "";
    if (resetPasswordBtn) {
        resetPasswordBtn.disabled = !isPasswordValid(password) || !confirm || password !== confirm;
    }
}

// ============ SECTION NAVIGATION ============

function showSection(section) {
    [emailSection, emailSentSection, passwordSection, successSection, invalidSection].forEach((s) => {
        s?.classList.remove("active");
    });
    section?.classList.add("active");
}

// ============ STEP 1: SEND RESET LINK ============

emailForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = resetEmailInput?.value.trim();

    if (!email) {
        emailFormError?.classList.remove("d-none");
        if (emailFormError) emailFormError.textContent = "Please enter your email address.";
        return;
    }
    emailFormError?.classList.add("d-none");

    if (sendLinkBtn) sendLinkBtn.disabled = true;
    if (emailStatus) {
        emailStatus.className = "status-message text-muted";
        emailStatus.textContent = "Sending reset link...";
    }

    try {
        await sendPasswordResetEmail(auth, email);
        if (sentToEmail) sentToEmail.textContent = email;
        showSection(emailSentSection);
    } catch (error) {
        if (emailStatus) {
            emailStatus.className = "status-message text-danger";
            emailStatus.textContent = getFriendlyFirebaseError(error);
        }
        if (sendLinkBtn) sendLinkBtn.disabled = false;
    }
});

// ============ STEP 2: SET NEW PASSWORD (reset-link mode) ============

showNewPassword?.addEventListener("click", () => {
    const isHidden = newPasswordInput?.type === "password";
    if (newPasswordInput) newPasswordInput.type = isHidden ? "text" : "password";
    showNewPassword.textContent = isHidden ? "🙈" : "👁";
});

showConfirmPassword?.addEventListener("click", () => {
    const isHidden = confirmPasswordInput?.type === "password";
    if (confirmPasswordInput) confirmPasswordInput.type = isHidden ? "text" : "password";
    showConfirmPassword.textContent = isHidden ? "🙈" : "👁";
});

newPasswordInput?.addEventListener("input", () => {
    updatePasswordStrength(newPasswordInput.value);
    passwordError?.classList.add("d-none");
    if (confirmPasswordInput?.value && newPasswordInput.value !== confirmPasswordInput.value) {
        confirmPasswordError?.classList.remove("d-none");
        if (confirmPasswordError) confirmPasswordError.textContent = "Passwords do not match.";
    } else {
        confirmPasswordError?.classList.add("d-none");
    }
    refreshResetButton();
});

confirmPasswordInput?.addEventListener("input", () => {
    const password = newPasswordInput?.value || "";
    if (password && confirmPasswordInput.value !== password) {
        confirmPasswordError?.classList.remove("d-none");
        if (confirmPasswordError) confirmPasswordError.textContent = "Passwords do not match.";
    } else {
        confirmPasswordError?.classList.add("d-none");
    }
    refreshResetButton();
});

newPasswordForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = newPasswordInput?.value || "";
    const confirm = confirmPasswordInput?.value || "";

    if (!isPasswordValid(password)) {
        passwordError?.classList.remove("d-none");
        if (passwordError) passwordError.textContent = "Password does not meet all requirements.";
        return;
    }
    if (password !== confirm) {
        confirmPasswordError?.classList.remove("d-none");
        if (confirmPasswordError) confirmPasswordError.textContent = "Passwords do not match.";
        return;
    }

    if (resetPasswordBtn) resetPasswordBtn.disabled = true;
    if (passwordStatus) {
        passwordStatus.className = "status-message text-muted";
        passwordStatus.textContent = "Resetting your password...";
    }

    try {
        await confirmPasswordReset(auth, activeOobCode, password);
        showSection(successSection);
    } catch (error) {
        if (passwordStatus) {
            passwordStatus.className = "status-message text-danger";
            passwordStatus.textContent = getFriendlyFirebaseError(error);
        }
        if (resetPasswordBtn) resetPasswordBtn.disabled = false;
    }
});

// ============ ROUTING: email step vs reset-link step ============

async function init() {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode");
    const oobCode = params.get("oobCode");

    // Arrived from the reset email link.
    if (mode === "resetPassword" && oobCode) {
        try {
            const email = await verifyPasswordResetCode(auth, oobCode);
            activeOobCode = oobCode;
            if (resetAccountEmail) resetAccountEmail.textContent = email;
            updatePasswordStrength("");
            refreshResetButton();
            showSection(passwordSection);
            newPasswordInput?.focus();
        } catch (error) {
            console.warn("Invalid or expired reset link.", error);
            showSection(invalidSection);
        }
        return;
    }

    // Normal entry: ask for the email address.
    showSection(emailSection);
}

init();
