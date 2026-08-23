// Firebase modules are loaded from Firebase's browser CDN.
// @ts-ignore - URL module declarations are not included with TypeScript.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
// @ts-ignore - URL module declarations are not included with TypeScript.
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-analytics.js";
// @ts-ignore - URL module declarations are not included with TypeScript.
import {
    getAuth,
    sendPasswordResetEmail,
    confirmPasswordReset,
    verifyPasswordResetCode,
    updatePassword,
    signInWithEmailAndPassword,
    Auth
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { firebaseConfig, getFriendlyFirebaseError } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

try {
    getAnalytics(app);
} catch (error) {
    console.warn("Firebase Analytics is unavailable in this browser.", error);
}

// DOM Elements
const emailSection = document.getElementById("emailSection");
const codeSection = document.getElementById("codeSection");
const passwordSection = document.getElementById("passwordSection");
const successSection = document.getElementById("successSection");

const emailForm = document.getElementById("emailForm");
const codeForm = document.getElementById("codeForm");
const newPasswordForm = document.getElementById("newPasswordForm");

const resetEmailInput = document.getElementById("resetEmail");
const sendCodeBtn = document.getElementById("sendCodeBtn");
const emailStatus = document.getElementById("emailStatus");
const emailFormError = document.getElementById("emailFormError");

const codeInputs = document.querySelectorAll(".code-input");
const verifyCodeBtn = document.getElementById("verifyCodeBtn");
const codeStatus = document.getElementById("codeStatus");
const codeError = document.getElementById("codeError");
const resendBtn = document.getElementById("resendBtn");
const timerDisplay = document.getElementById("timerDisplay");
const backToEmailBtn = document.getElementById("backToEmailBtn");

const newPasswordInput = document.getElementById("newPassword");
const confirmPasswordInput = document.getElementById("confirmPassword");
const showNewPassword = document.getElementById("showNewPassword");
const showConfirmPassword = document.getElementById("showConfirmPassword");
const resetPasswordBtn = document.getElementById("resetPasswordBtn");
const passwordStatus = document.getElementById("passwordStatus");
const passwordError = document.getElementById("passwordError");
const confirmPasswordError = document.getElementById("confirmPasswordError");
const backToCodeBtn = document.getElementById("backToCodeBtn");

const strengthMeter = document.getElementById("strengthMeter");
const strengthText = document.getElementById("strengthText");

// State
let userEmail = "";
let resetCode = "";
let resendTimer = 0;

// ============ PASSWORD VALIDATION FUNCTIONS ============

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
    const reqs = checkPasswordRequirements(password);
    const metCount = Object.values(reqs).filter(Boolean).length;

    if (metCount <= 2) return "weak";
    if (metCount <= 3) return "medium";
    return "strong";
}

function isPasswordValid(password) {
    const reqs = checkPasswordRequirements(password);
    return reqs.length && reqs.uppercase && reqs.lowercase && reqs.number && reqs.special;
}

function updatePasswordStrength(password) {
    if (!password) {
        strengthText.textContent = "-";
        strengthText.className = "strength-text";
        const bars = strengthMeter.querySelectorAll(".strength-bar");
        bars.forEach(bar => bar.className = "strength-bar");
        return;
    }

    const strength = getPasswordStrength(password);
    const reqs = checkPasswordRequirements(password);

    // Update strength text and color
    strengthText.textContent = strength.charAt(0).toUpperCase() + strength.slice(1);
    strengthText.className = `strength-text ${strength}`;

    // Update strength bars
    const bars = strengthMeter.querySelectorAll(".strength-bar");
    bars.forEach((bar, index) => {
        bar.className = "strength-bar";
        if (strength === "weak" && index === 0) {
            bar.classList.add("weak");
        } else if (strength === "medium" && index <= 1) {
            bar.classList.add("medium");
        } else if (strength === "strong" && index <= 2) {
            bar.classList.add("strong");
        }
    });

    // Update requirements checklist
    updateRequirements(reqs);
}

function updateRequirements(reqs) {
    const requirements = [
        { id: "req-length", met: reqs.length },
        { id: "req-uppercase", met: reqs.uppercase },
        { id: "req-lowercase", met: reqs.lowercase },
        { id: "req-number", met: reqs.number },
        { id: "req-special", met: reqs.special }
    ];

    requirements.forEach(req => {
        const element = document.getElementById(req.id);
        const icon = document.getElementById(`${req.id}-icon`);
        if (element) {
            element.classList.toggle("met", req.met);
            if (icon) {
                icon.textContent = req.met ? "✓" : "○";
            }
        }
    });

    // Enable/disable reset button
    const allMet = Object.values(reqs).every(Boolean);
    if (resetPasswordBtn) {
        resetPasswordBtn.disabled = !allMet || !confirmPasswordInput?.value || newPasswordInput?.value !== confirmPasswordInput?.value;
    }
}

// ============ SECTION NAVIGATION ============

function showSection(section) {
    emailSection.classList.remove("active");
    codeSection.classList.remove("active");
    passwordSection.classList.remove("active");
    successSection.classList.remove("active");
    section.classList.add("active");
}

// ============ STEP 1: SEND RESET CODE ============

emailForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = resetEmailInput?.value;

    if (!email) {
        emailFormError?.classList.remove("d-none");
        emailFormError.textContent = "Please enter your email address.";
        return;
    }

    if (sendCodeBtn) sendCodeBtn.disabled = true;
    if (emailStatus) {
        emailStatus.className = "status-message text-muted";
        emailStatus.textContent = "Sending reset code...";
    }

    try {
        await sendPasswordResetEmail(auth, email);
        userEmail = email;

        if (emailStatus) {
            emailStatus.className = "status-message text-success";
            emailStatus.textContent = "Code sent successfully! Check your email.";
        }

        setTimeout(() => {
            showSection(codeSection);
            startResendTimer();
        }, 1500);
    } catch (error) {
        if (emailStatus) {
            emailStatus.className = "status-message text-danger";
            emailStatus.textContent = getFriendlyFirebaseError(error);
        }
        if (sendCodeBtn) sendCodeBtn.disabled = false;
    }
});

// ============ STEP 2: CODE VERIFICATION ============

// Handle code input auto-advance
codeInputs.forEach((input, index) => {
    input.addEventListener("input", (e) => {
        const value = e.target.value;

        // Only allow digits
        if (!/^\d*$/.test(value)) {
            e.target.value = "";
            return;
        }

        if (value.length === 1 && index < codeInputs.length - 1) {
            codeInputs[index + 1].focus();
        }

        // Auto-submit if all fields filled
        if (index === codeInputs.length - 1 && value.length === 1) {
            const fullCode = Array.from(codeInputs).map(inp => inp.value).join("");
            if (fullCode.length === 6) {
                verifyCode();
            }
        }
    });

    input.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && !input.value && index > 0) {
            codeInputs[index - 1].focus();
        }
    });
});

function getFullCode() {
    return Array.from(codeInputs).map(inp => inp.value).join("");
}

async function verifyCode() {
    const code = getFullCode();

    if (code.length !== 6) {
        codeError?.classList.remove("d-none");
        codeError.textContent = "Please enter all 6 digits.";
        return;
    }

    if (verifyCodeBtn) verifyCodeBtn.disabled = true;
    if (codeStatus) {
        codeStatus.className = "status-message text-muted";
        codeStatus.textContent = "Verifying code...";
    }
    codeError?.classList.add("d-none");

    try {
        // Verify the code is valid
        await verifyPasswordResetCode(auth, code);
        resetCode = code;

        if (codeStatus) {
            codeStatus.className = "status-message text-success";
            codeStatus.textContent = "Code verified successfully!";
        }

        setTimeout(() => {
            showSection(passwordSection);
            newPasswordInput?.focus();
        }, 1500);
    } catch (error) {
        if (codeStatus) {
            codeStatus.className = "status-message text-danger";
            codeStatus.textContent = "Invalid or expired code. Please try again.";
        }
        codeError?.classList.remove("d-none");
        codeError.textContent = "The code you entered is incorrect.";
        if (verifyCodeBtn) verifyCodeBtn.disabled = false;
    }
}

codeForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    verifyCode();
});

// ============ RESEND CODE TIMER ============

function startResendTimer() {
    resendTimer = 60;
    if (resendBtn) resendBtn.disabled = true;

    const updateTimer = () => {
        if (timerDisplay) {
            timerDisplay.textContent = `Resend code in ${resendTimer}s`;
        }

        resendTimer--;
        if (resendTimer < 0) {
            if (resendBtn) resendBtn.disabled = false;
            if (timerDisplay) timerDisplay.textContent = "";
        } else {
            setTimeout(updateTimer, 1000);
        }
    };

    updateTimer();
}

resendBtn?.addEventListener("click", async () => {
    if (resendBtn) resendBtn.disabled = true;
    if (codeStatus) {
        codeStatus.className = "status-message text-muted";
        codeStatus.textContent = "Resending code...";
    }

    try {
        await sendPasswordResetEmail(auth, userEmail);
        if (codeStatus) {
            codeStatus.className = "status-message text-success";
            codeStatus.textContent = "Code resent successfully!";
        }
        startResendTimer();
    } catch (error) {
        if (codeStatus) {
            codeStatus.className = "status-message text-danger";
            codeStatus.textContent = getFriendlyFirebaseError(error);
        }
        if (resendBtn) resendBtn.disabled = false;
    }
});

// ============ STEP 3: RESET PASSWORD ============

// Show/hide password buttons
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

// Password strength tracking
newPasswordInput?.addEventListener("input", () => {
    const password = newPasswordInput.value;
    updatePasswordStrength(password);
    passwordError?.classList.add("d-none");

    // Check if passwords match
    if (confirmPasswordInput?.value && password !== confirmPasswordInput.value) {
        confirmPasswordError?.classList.remove("d-none");
        confirmPasswordError.textContent = "Passwords do not match.";
    } else {
        confirmPasswordError?.classList.add("d-none");
    }
});

confirmPasswordInput?.addEventListener("input", () => {
    const password = newPasswordInput?.value || "";
    const confirm = confirmPasswordInput.value;

    if (password && confirm !== password) {
        confirmPasswordError?.classList.remove("d-none");
        confirmPasswordError.textContent = "Passwords do not match.";
    } else {
        confirmPasswordError?.classList.add("d-none");
    }

    // Check if button should be enabled
    const passwordValid = isPasswordValid(password);
    const passwordsMatch = password === confirm;
    if (resetPasswordBtn) {
        resetPasswordBtn.disabled = !passwordValid || !passwordsMatch || !password || !confirm;
    }
});

newPasswordForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const password = newPasswordInput?.value || "";
    const confirm = confirmPasswordInput?.value || "";

    // Final validation
    if (!isPasswordValid(password)) {
        passwordError?.classList.remove("d-none");
        passwordError.textContent = "Password does not meet all requirements.";
        return;
    }

    if (password !== confirm) {
        confirmPasswordError?.classList.remove("d-none");
        confirmPasswordError.textContent = "Passwords do not match.";
        return;
    }

    if (resetPasswordBtn) resetPasswordBtn.disabled = true;
    if (passwordStatus) {
        passwordStatus.className = "status-message text-muted";
        passwordStatus.textContent = "Resetting your password...";
    }

    try {
        // Confirm the password reset with the code
        await confirmPasswordReset(auth, resetCode, password);

        if (passwordStatus) {
            passwordStatus.className = "status-message text-success";
            passwordStatus.textContent = "Password reset successfully!";
        }

        setTimeout(() => {
            showSection(successSection);
        }, 1500);
    } catch (error) {
        if (passwordStatus) {
            passwordStatus.className = "status-message text-danger";
            passwordStatus.textContent = getFriendlyFirebaseError(error);
        }
        if (resetPasswordBtn) resetPasswordBtn.disabled = false;
    }
});

// ============ BACK BUTTONS ============

backToEmailBtn?.addEventListener("click", () => {
    // Clear code inputs
    codeInputs.forEach(input => input.value = "");
    showSection(emailSection);
    clearTimers();
});

backToCodeBtn?.addEventListener("click", () => {
    // Clear password inputs
    if (newPasswordInput) newPasswordInput.value = "";
    if (confirmPasswordInput) confirmPasswordInput.value = "";
    updatePasswordStrength("");
    showSection(codeSection);
});

function clearTimers() {
    // Stop any active timers
    resendTimer = -1;
}
