// In-browser AI chat powered by WebLLM (WebGPU). No server, no API key.
// The model runs entirely in the visitor's browser; weights are downloaded
// from the WebLLM/Hugging Face CDN on first use and cached locally afterwards.
// @ts-ignore - URL module declarations are not included with TypeScript.
import * as webllm from "https://esm.run/@mlc-ai/web-llm@0.2.84";

// Curated models, ordered from lightest to heaviest. Sizes are approximate
// first-download sizes; everything is cached in the browser after that.
const MODELS = [
    { id: "Qwen3-1.7B-q4f16_1-MLC", label: "Qwen3 1.7B · fast (~1.2 GB)" },
    { id: "Qwen3-4B-q4f16_1-MLC", label: "Qwen3 4B · balanced (~2.5 GB)" },
    { id: "Qwen3-8B-q4f16_1-MLC", label: "Qwen3 8B · best · needs strong GPU (~5 GB)" },
    { id: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC", label: "Qwen2.5 0.5B · tiny/testing (~0.4 GB)" }
];
const DEFAULT_MODEL = "Qwen3-4B-q4f16_1-MLC";

const SYSTEM_PROMPT =
    "You are StudentGPT, a helpful local AI assistant for research, mathematics, " +
    "coding, documentation, and everyday problem solving. Answer clearly and concisely.";

// ---- DOM ----
const messagesEl = document.querySelector("#messages");
const promptInput = document.querySelector("#promptInput");
const sendButton = document.querySelector("#sendButton");
const newChatButton = document.querySelector("#newChatButton");
const modelSelect = document.querySelector("#modelSelect");
const loadModelButton = document.querySelector("#loadModelButton");
const progressWrap = document.querySelector("#loadProgressWrap");
const progressBar = document.querySelector("#loadProgressBar");
const progressText = document.querySelector("#loadProgressText");
const statusPill = document.querySelector("#statusPill");
const statusDot = document.querySelector("#statusDot");
const statusText = document.querySelector("#statusText");
const currentModelLabel = document.querySelector("#currentModelLabel");

// ---- State ----
let engine = null;
let currentModelId = null;
let isLoading = false;
let isGenerating = false;
let conversation = [{ role: "system", content: SYSTEM_PROMPT }];

// ---- Helpers ----
function setStatus(state, text) {
    if (statusText) statusText.textContent = text;
    if (statusPill) statusPill.className = "status-pill" + (state ? " " + state : "");
    if (statusDot) statusDot.className = "status-dot" + (state ? " " + state : "");
}

function scrollToBottom() {
    if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
}

function appendBubble(role, text) {
    const row = document.createElement("div");
    row.className = "message-row " + role;
    const bubble = document.createElement("div");
    bubble.className = "bubble " + role;
    bubble.textContent = text;
    row.appendChild(bubble);
    messagesEl?.appendChild(row);
    scrollToBottom();
    return bubble;
}

// Qwen3 can emit <think>...</think> reasoning. Hide it from the chat display.
function stripThink(text) {
    return text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}
function renderForDisplay(text) {
    if (text.includes("</think>")) {
        const after = text.slice(text.lastIndexOf("</think>") + "</think>".length).trim();
        return after || "…";
    }
    if (text.includes("<think>")) return "Thinking…";
    return text;
}

function setInputEnabled(enabled) {
    if (promptInput) promptInput.disabled = !enabled;
    if (sendButton) sendButton.disabled = !enabled;
}

// ---- Model loading ----
async function loadModel(modelId) {
    if (isLoading || isGenerating) return;
    if (engine && modelId === currentModelId) return;

    isLoading = true;
    setInputEnabled(false);
    if (loadModelButton) loadModelButton.disabled = true;
    if (progressWrap) progressWrap.style.display = "block";
    setStatus("loading", "Loading model…");

    try {
        // If switching models, release the previous engine first.
        if (engine) {
            await engine.unload();
            engine = null;
            currentModelId = null;
        }

        engine = await webllm.CreateMLCEngine(modelId, {
            initProgressCallback: (report) => {
                if (progressText) progressText.textContent = report.text || "";
                if (progressBar) {
                    const pct = Math.round((report.progress || 0) * 100);
                    progressBar.style.width = pct + "%";
                }
            }
        });

        currentModelId = modelId;
        const label = MODELS.find((m) => m.id === modelId)?.label || modelId;
        if (currentModelLabel) currentModelLabel.textContent = label.split(" · ")[0];
        setStatus("ready", "Model ready · runs in your browser");
        if (progressWrap) progressWrap.style.display = "none";
        setInputEnabled(true);
        promptInput?.focus();
    } catch (error) {
        console.error("Model load failed", error);
        setStatus("error", "Model failed to load");
        if (progressText) {
            progressText.textContent =
                (error && error.message ? error.message : String(error)) +
                " — try a smaller model, or a WebGPU browser (Chrome/Edge).";
        }
    } finally {
        isLoading = false;
        if (loadModelButton) loadModelButton.disabled = false;
    }
}

// ---- Sending a message ----
async function sendMessage() {
    if (!promptInput || isGenerating || isLoading) return;
    const text = promptInput.value.trim();
    if (!text) return;

    if (!engine) {
        // Lazy-load the selected model on first send.
        await loadModel(modelSelect?.value || DEFAULT_MODEL);
        if (!engine) return;
    }

    appendBubble("user", text);
    conversation.push({ role: "user", content: text });
    promptInput.value = "";

    isGenerating = true;
    setInputEnabled(false);
    setStatus("loading", "Thinking…");
    const bubble = appendBubble("assistant", "…");

    try {
        const stream = await engine.chat.completions.create({
            messages: conversation,
            stream: true,
            temperature: 0.7
        });

        let raw = "";
        for await (const chunk of stream) {
            raw += chunk.choices?.[0]?.delta?.content || "";
            bubble.textContent = renderForDisplay(raw);
            scrollToBottom();
        }
        conversation.push({ role: "assistant", content: stripThink(raw) });
        setStatus("ready", "Model ready · runs in your browser");
    } catch (error) {
        console.error("Generation failed", error);
        bubble.textContent = "Error: " + (error && error.message ? error.message : String(error));
        setStatus("error", "Generation failed");
    } finally {
        isGenerating = false;
        setInputEnabled(true);
        promptInput.focus();
    }
}

function newChat() {
    if (isGenerating || isLoading) return;
    conversation = [{ role: "system", content: SYSTEM_PROMPT }];
    if (messagesEl) messagesEl.innerHTML = "";
    appendBubble(
        "assistant",
        "Hello. I am StudentGPT, running locally in your browser. Ask me about research, math, coding, or documentation."
    );
}

// ---- Init ----
function init() {
    // Populate the model dropdown.
    if (modelSelect) {
        modelSelect.innerHTML = "";
        MODELS.forEach((model) => {
            const option = document.createElement("option");
            option.value = model.id;
            option.textContent = model.label;
            if (model.id === DEFAULT_MODEL) option.selected = true;
            modelSelect.appendChild(option);
        });
    }

    // WebGPU support gate.
    if (!("gpu" in navigator)) {
        setStatus("error", "WebGPU not supported");
        setInputEnabled(false);
        if (loadModelButton) loadModelButton.disabled = true;
        if (progressWrap) progressWrap.style.display = "block";
        if (progressText) {
            progressText.textContent =
                "This browser has no WebGPU. Use a recent Chrome or Edge (desktop) to run the model.";
        }
        return;
    }

    setStatus("", "Model not loaded");
    setInputEnabled(true); // send will lazy-load on first use

    loadModelButton?.addEventListener("click", () => loadModel(modelSelect?.value || DEFAULT_MODEL));
    sendButton?.addEventListener("click", sendMessage);
    newChatButton?.addEventListener("click", newChat);

    promptInput?.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    });
}

init();
