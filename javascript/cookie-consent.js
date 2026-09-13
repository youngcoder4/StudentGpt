// Lightweight, self-contained cookie-consent banner. No dependencies.
// Shows once until the visitor chooses Accept or Decline; the choice is stored
// in a first-party cookie (shared across pages via path=/), so it won't reappear.
(function () {
    "use strict";

    var KEY = "studentgpt_cookie_consent";

    function getConsent() {
        var match = document.cookie.split("; ").filter(function (row) {
            return row.indexOf(KEY + "=") === 0;
        })[0];
        return match ? match.split("=")[1] : null;
    }

    function setConsent(value) {
        var oneYear = 60 * 60 * 24 * 365;
        document.cookie = KEY + "=" + value + "; path=/; max-age=" + oneYear + "; SameSite=Lax";
    }

    // Already decided — do nothing.
    if (getConsent()) return;

    function injectStyles() {
        var style = document.createElement("style");
        style.textContent =
            ".cookie-banner{position:fixed;left:16px;right:16px;bottom:16px;z-index:9999;" +
            "display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:12px 18px;" +
            "max-width:960px;margin:0 auto;padding:16px 20px;border-radius:16px;" +
            "background:rgba(15,23,42,0.96);border:1px solid rgba(148,163,184,0.22);" +
            "box-shadow:0 18px 48px rgba(2,6,23,0.5);color:#e5edf7;" +
            "font-family:Inter,'Segoe UI',sans-serif;font-size:0.92rem;line-height:1.6;" +
            "opacity:0;transform:translateY(12px);transition:opacity .3s ease,transform .3s ease;}" +
            ".cookie-banner.show{opacity:1;transform:translateY(0);}" +
            ".cookie-banner p{margin:0;flex:1 1 260px;color:#cbd5e1;}" +
            ".cookie-actions{display:flex;gap:10px;flex:0 0 auto;}" +
            ".cookie-btn{border-radius:10px;padding:9px 16px;font-weight:600;cursor:pointer;" +
            "border:1px solid rgba(148,163,184,0.25);font-size:0.9rem;}" +
            ".cookie-accept{background:linear-gradient(135deg,#3b82f6,#2563eb);border:none;color:#fff;}" +
            ".cookie-decline{background:rgba(148,163,184,0.08);color:#e5edf7;}" +
            "@media(max-width:520px){.cookie-banner{flex-direction:column;align-items:stretch;text-align:center;}" +
            ".cookie-actions{justify-content:center;}}";
        document.head.appendChild(style);
    }

    function build() {
        injectStyles();

        var banner = document.createElement("div");
        banner.className = "cookie-banner";
        banner.setAttribute("role", "dialog");
        banner.setAttribute("aria-label", "Cookie consent");
        banner.innerHTML =
            "<p>We use cookies and local storage to keep you signed in and remember your " +
            "conversations and preferences on this device. No tracking or advertising cookies.</p>" +
            '<div class="cookie-actions">' +
            '<button type="button" class="cookie-btn cookie-decline" id="cookieDecline">Decline</button>' +
            '<button type="button" class="cookie-btn cookie-accept" id="cookieAccept">Accept</button>' +
            "</div>";
        document.body.appendChild(banner);
        requestAnimationFrame(function () {
            banner.classList.add("show");
        });

        function dismiss(value) {
            setConsent(value);
            banner.classList.remove("show");
            setTimeout(function () {
                if (banner.parentNode) banner.parentNode.removeChild(banner);
            }, 300);
        }

        var accept = banner.querySelector("#cookieAccept");
        var decline = banner.querySelector("#cookieDecline");
        if (accept) accept.addEventListener("click", function () { dismiss("accepted"); });
        if (decline) decline.addEventListener("click", function () { dismiss("declined"); });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", build);
    } else {
        build();
    }
})();
