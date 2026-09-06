// In-browser AI chat powered by WebLLM (WebGPU). No server, no API key.
// The model runs entirely in the visitor's browser; weights are downloaded
// from the WebLLM/Hugging Face CDN on first use and cached locally afterwards.
// Conversations are stored per-browser in localStorage (create/switch/delete).
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

const GREETING =
    "Hello. I am StudentGPT, running locally in your browser. Ask me about research, " +
    "math, coding, or documentation. Pick a model on the right and press Send — the " +
    "first run downloads the model into your browser and caches it.";

const STORAGE_KEY = "studentgpt.conversations";
const ACTIVE_KEY = "studentgpt.activeConversation";

// ---- DOM ----
const messagesEl = document.querySelector("#messages");
const promptInput = document.querySelector("#promptInput");
const sendButton = document.querySelector("#sendButton");
const newChatButton = document.querySelector("#newChatButton");
const historyList = document.querySelector("#historyList");
const modelSelect = document.querySelector("#modelSelect");
const loadModelButton = document.querySelector("#loadModelButton");
const progressWrap = document.querySelector("#loadProgressWrap");
const progressBar = document.querySelector("#loadProgressBar");
const progressText = document.querySelector("#loadProgressText");
const statusPill = document.querySelector("#statusPill");
const statusDot = document.querySelector("#statusDot");
const statusText = document.querySelector("#statusText");
const currentModelLabel = document.querySelector("#currentModelLabel");

// ---- WebLLM state ----
let engine = null;
let currentModelId = null;
let isLoading = false;
let isGenerating = false;

// ---- Conversation state ----
let conversations = []; // [{ id, title, messages: [{role, content}], updatedAt }]
let activeId = null;

// ============ STORAGE ============

function loadConversations() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        conversations = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(conversations)) conversations = [];
    } catch {
        conversations = [];
    }
    try {
        activeId = localStorage.getItem(ACTIVE_KEY);
    } catch {
        activeId = null;
    }
}

function saveConversations() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
        if (activeId) localStorage.setItem(ACTIVE_KEY, activeId);
    } catch {
        // storage unavailable (private mode / disabled) — run without persistence
    }
}

function activeConversation() {
    return conversations.find((c) => c.id === activeId) || null;
}

function newId() {
    return "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function titleFrom(text) {
    const t = text.trim().replace(/\s+/g, " ");
    return t.length > 34 ? t.slice(0, 34) + "…" : t;
}

// ============ CONVERSATION MANAGEMENT ============

function createConversation() {
    const convo = { id: newId(), title: "New chat", messages: [], updatedAt: Date.now() };
    conversations.unshift(convo);
    activeId = convo.id;
    saveConversations();
    renderHistory();
    renderMessages();
    promptInput?.focus();
}

function selectConversation(id) {
    if (id === activeId) return;
    activeId = id;
    saveConversations();
    renderHistory();
    renderMessages();
}

function deleteConversation(id) {
    conversations = conversations.filter((c) => c.id !== id);
    if (activeId === id) activeId = conversations[0]?.id || null;
    if (!conversations.length) {
        createConversation(); // always keep one conversation around
        return;
    }
    saveConversations();
    renderHistory();
    renderMessages();
}

// ============ RENDERING ============

function renderHistory() {
    if (!historyList) return;
    historyList.innerHTML = "";

    if (!conversations.length) {
        const empty = document.createElement("li");
        empty.className = "history-empty";
        empty.textContent = "No conversations yet";
        historyList.appendChild(empty);
        return;
    }

    conversations.forEach((convo) => {
        const li = document.createElement("li");
        if (convo.id === activeId) li.classList.add("active");

        const title = document.createElement("span");
        title.className = "history-title";
        title.textContent = convo.title || "New chat";
        li.appendChild(title);

        const del = document.createElement("button");
        del.className = "history-delete";
        del.type = "button";
        del.textContent = "×";
        del.title = "Delete conversation";
        del.setAttribute("aria-label", "Delete conversation");
        li.appendChild(del);

        li.addEventListener("click", () => selectConversation(convo.id));
        del.addEventListener("click", (event) => {
            event.stopPropagation();
            deleteConversation(convo.id);
        });

        historyList.appendChild(li);
    });
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

function renderMessages() {
    if (!messagesEl) return;
    messagesEl.innerHTML = "";
    const convo = activeConversation();
    if (!convo || !convo.messages.length) {
        appendBubble("assistant", GREETING);
        return;
    }
    convo.messages.forEach((m) => appendBubble(m.role, m.content));
    scrollToBottom();
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

// ============ STATUS / INPUT ============

function setStatus(state, text) {
    if (statusText) statusText.textContent = text;
    if (statusPill) statusPill.className = "status-pill" + (state ? " " + state : "");
    if (statusDot) statusDot.className = "status-dot" + (state ? " " + state : "");
}

function setInputEnabled(enabled) {
    if (promptInput) promptInput.disabled = !enabled;
    if (sendButton) sendButton.disabled = !enabled;
}

// ============ MODEL LOADING ============

async function loadModel(modelId) {
    if (isLoading || isGenerating) return;
    if (engine && modelId === currentModelId) return;

    isLoading = true;
    setInputEnabled(false);
    if (loadModelButton) loadModelButton.disabled = true;
    if (progressWrap) progressWrap.style.display = "block";
    setStatus("loading", "Loading model…");

    try {
        if (engine) {
            await engine.unload();
            engine = null;
            currentModelId = null;
        }

        engine = await webllm.CreateMLCEngine(modelId, {
            initProgressCallback: (report) => {
                if (progressText) progressText.textContent = report.text || "";
                if (progressBar) progressBar.style.width = Math.round((report.progress || 0) * 100) + "%";
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

// ============ SENDING ============

async function sendMessage() {
    if (!promptInput || isGenerating || isLoading) return;
    const text = promptInput.value.trim();
    if (!text) return;

    if (!engine) {
        await loadModel(modelSelect?.value || DEFAULT_MODEL);
        if (!engine) return;
    }

    let convo = activeConversation();
    if (!convo) {
        createConversation();
        convo = activeConversation();
    }

    // Clear the greeting placeholder on the first real message.
    if (!convo.messages.length && messagesEl) messagesEl.innerHTML = "";

    appendBubble("user", text);
    convo.messages.push({ role: "user", content: text });
    if (convo.messages.filter((m) => m.role === "user").length === 1) {
        convo.title = titleFrom(text);
    }
    convo.updatedAt = Date.now();
    // Move the active conversation to the top of the list.
    conversations = [convo, ...conversations.filter((c) => c.id !== convo.id)];
    saveConversations();
    renderHistory();

    promptInput.value = "";
    isGenerating = true;
    setInputEnabled(false);
    setStatus("loading", "Thinking…");
    const bubble = appendBubble("assistant", "…");

    try {
        const stream = await engine.chat.completions.create({
            messages: [{ role: "system", content: SYSTEM_PROMPT }, ...convo.messages],
            stream: true,
            temperature: 0.7
        });

        let raw = "";
        for await (const chunk of stream) {
            raw += chunk.choices?.[0]?.delta?.content || "";
            bubble.textContent = renderForDisplay(raw);
            scrollToBottom();
        }
        convo.messages.push({ role: "assistant", content: stripThink(raw) });
        convo.updatedAt = Date.now();
        saveConversations();
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

// ============ INIT ============

function initConversations() {
    loadConversations();
    if (!conversations.length) {
        createConversation();
    } else {
        if (!activeConversation()) activeId = conversations[0].id;
        renderHistory();
        renderMessages();
    }
}

function init() {
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

    // Conversation UI is always available, even without WebGPU (read saved chats).
    initConversations();
    newChatButton?.addEventListener("click", createConversation);

    if (!("gpu" in navigator)) {
        setStatus("error", "WebGPU not supported");
        setInputEnabled(false);
        if (loadModelButton) loadModelButton.disabled = true;
        if (progressWrap) progressWrap.style.display = "block";
        if (progressText) {
            progressText.textContent =
                "This browser has no WebGPU. Use a recent Chrome or Edge (desktop) to run the model. " +
                "You can still read and delete saved conversations.";
        }
        return;
    }

    setStatus("", "Model not loaded");
    setInputEnabled(true); // send lazy-loads the model on first use

    loadModelButton?.addEventListener("click", () => loadModel(modelSelect?.value || DEFAULT_MODEL));
    sendButton?.addEventListener("click", sendMessage);
    promptInput?.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    });
}

init();
