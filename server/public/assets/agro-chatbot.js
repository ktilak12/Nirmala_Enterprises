/**
 * Kisan Mitra - Nirmala Enterprises Agro AI Chatbot
 * Floating Interactive Agricultural Assistant
 */

(function () {
  // Prevent duplicate initialization
  if (document.getElementById('agro-chatbot-root')) return;

  const STORAGE_KEY = 'nirmala_agro_chat_history_v1';
  const LANG_KEY = 'nirmala_agro_chat_lang_v1';

  let currentLang = localStorage.getItem(LANG_KEY) || 'en';
  let isOpen = false;
  let isSending = false;

  const quickChips = {
    en: [
      { label: '🌽 Maize & FAW Pest', query: 'How to control Fall Armyworm on Maize?' },
      { label: '🌱 DAP & Urea Dose', query: 'What is the recommended fertilizer schedule?' },
      { label: '🌾 Paddy Care & BPH', query: 'How to control Brown Plant Hopper on Paddy?' },
      { label: '💰 Mandi & MSP Rates', query: 'What are the latest government MSP rates in Odisha?' },
      { label: '🏢 Store & Contact', query: 'Where is Nirmala Enterprises located in Umarkote?' }
    ],
    or: [
      { label: '🌽 ମକା ଓ ସେନା ପୋକ', query: 'ମକାରେ ସେନା ପୋକ (FAW) କିପରି ଦମନ କରିବେ?' },
      { label: '🌱 ସାର ପ୍ରୟୋଗ ନିୟମ', query: 'ମକା ଓ ଧାନ ପାଇଁ ୟୁରିଆ ଓ DAP କେତେ ଦେବା?' },
      { label: '🌾 ଧାନ ଓ ଗୁଣ୍ଡି ପୋକ', query: 'ଧାନରେ ମାଟିଆ ଗୁଣ୍ଡି ପୋକ ନିୟନ୍ତ୍ରଣ କିପରି କରିବେ?' },
      { label: '💰 ଆଜିର ମଣ୍ଡି ଓ MSP ଦର', query: 'ଓଡ଼ିଶାରେ ଆଜି ମକା ଓ ଧାନର ସରକାରୀ MSP ଦର କେତେ?' },
      { label: '🏢 ଦୋକାନ ଯୋଗାଯୋଗ', query: 'ନିର୍ମଳା ଏଣ୍ଟରପ୍ରାଇଜେସ୍ ଠିକଣା ଓ ଫୋନ୍ ନମ୍ବର କଣ?' }
    ],
    hi: [
      { label: '🌽 मक्का व सैनिक कीट', query: 'मक्का में फॉल आर्मीवॉर्म (सैनिक कीट) कैसे रोकें?' },
      { label: '🌱 खाद की उचित मात्रा', query: 'डीएपी और यूरिया का सही प्रयोग कैसे करें?' },
      { label: '🌾 धान की सुरक्षा', query: 'धान में भूरा फुदका (BPH) कैसे नियंत्रित करें?' },
      { label: '💰 मंडी भाव व MSP', query: 'ओडिशा में मक्का व धान का सरकारी समर्थन मूल्य क्या है?' },
      { label: '🏢 केंद्र की जानकारी', query: 'निर्मला एंटरप्राइजेज का पता और फोन नंबर क्या है?' }
    ]
  };

  const initialGreetings = {
    en: `🌾 **Namaskar! I am Kisan Mitra, your Agro AI Assistant at Nirmala Enterprises.**

I am here to help you with:
• **Crops:** Maize & Paddy cultivation, seed varieties, and pest alerts (FAW).
• **Fertilizers:** Balanced NPK, DAP, Urea, and Micronutrient doses.
• **Mandi Rates:** Government MSP and procurement prices in Odisha.
• **Nirmala Support:** Grain selling, passbook balances, and store info.

*How can I help your farm today?*`,
    or: `🌾 **ନମସ୍କାର! ମୁଁ ଆପଣଙ୍କ 'କିଷାନ ମିତ୍ର' କୃଷି ସହାୟକ, ନିର୍ମଳା ଏଣ୍ଟରପ୍ରାଇଜେସ୍.**

ମୁଁ ଆପଣଙ୍କୁ ସାହାଯ୍ୟ କରିପାରିବି:
• **ଫସଲ:** ମକା ଓ ଧାନ ଚାଷ, ବିହନ ଏବଂ ସେନା ପୋକ (FAW) ଦମନ.
• **ସାର:** ୟୁରିଆ, DAP, ପଟାସ ଓ ଜିଙ୍କର ଉପଯୁକ୍ତ ମାତ୍ରା.
• **ମଣ୍ଡି ଦର:** ଆଜିର ସରକାରୀ MSP ଓ ମକା/ଧାନ କ୍ରୟ ମୂଲ୍ୟ.
• **ଷ୍ଟୋର ସେବା:** ଉମରକୋଟ କେନ୍ଦ୍ର ଯୋଗାଯୋଗ ଓ କ୍ରେଡିଟ୍ ପାସବୁକ୍.

*ଆଜି ଆପଣ କଣ ଜାଣିବାକୁ ଚାହାଁନ୍ତି?*`,
    hi: `🌾 **नमस्ते! मैं निर्मला एंटरप्राइजेज का 'किसान मित्र' एग्रो एआई सहायक हूँ.**

मैं आपकी इन विषयों में सहायता कर सकता हूँ:
• **फसल:** मक्का व धान की खेती, हाइब्रिड बीज और सैनिक कीट रोकथाम.
• **खाद:** यूरिया, डीएपी, पोटाश व जिंक का संतुलित प्रयोग.
• **मंडी भाव:** ओडिशा में मक्का और धान का सरकारी समर्थन मूल्य (MSP).
• **निर्मला केंद्र:** उमरकोट में सीधी फसल खरीद, बीज-खाद व पासबुक खाता.

*आज आपकी खेती से जुड़ी क्या सहायता करूँ?*`
  };

  // Create root element
  const root = document.createElement('div');
  root.id = 'agro-chatbot-root';
  root.innerHTML = `
    <!-- Launcher Button -->
    <div id="agro-launcher-btn" class="agro-launcher-btn" role="button" title="Chat with Kisan Mitra Agro AI">
      <div class="agro-launcher-icon">🌾</div>
      <div class="agro-launcher-label">
        <span>Kisan Mitra AI</span>
        <span class="agro-launcher-sub">Agro Support 24/7</span>
      </div>
      <span class="agro-pulse-badge"></span>
    </div>

    <!-- Chat Window Dialog -->
    <div id="agro-chat-window" class="agro-chat-window" role="dialog" aria-label="Kisan Mitra Agro AI Assistant">
      <!-- Header -->
      <div class="agro-chat-header">
        <div class="agro-header-left">
          <div class="agro-avatar">🌾</div>
          <div class="agro-header-info">
            <h3>Kisan Mitra <span class="agro-badge-ai">AI Agro</span></h3>
            <p><span class="agro-status-dot"></span> Online • Nirmala Enterprises</p>
          </div>
        </div>
        <div class="agro-header-actions">
          <button id="agro-close-btn" class="agro-close-btn" title="Close chat">✕</button>
        </div>
      </div>

      <!-- Language Switcher Bar -->
      <div class="agro-lang-bar">
        <span class="agro-lang-label">🌐 Language / ଭାଷା:</span>
        <div class="agro-lang-buttons">
          <button class="agro-lang-btn ${currentLang === 'en' ? 'active' : ''}" data-lang="en">EN</button>
          <button class="agro-lang-btn ${currentLang === 'or' ? 'active' : ''}" data-lang="or">ଓଡ଼ିଆ</button>
          <button class="agro-lang-btn ${currentLang === 'hi' ? 'active' : ''}" data-lang="hi">हिंदी</button>
        </div>
      </div>

      <!-- Messages Area -->
      <div id="agro-messages-area" class="agro-messages-area"></div>

      <!-- Quick Chips -->
      <div id="agro-chips-container" class="agro-chips-container"></div>

      <!-- Input Area -->
      <form id="agro-chat-form" class="agro-input-container">
        <input 
          id="agro-input-box" 
          type="text" 
          class="agro-input-box" 
          placeholder="Ask crop advice, fertilizers, rates..." 
          autocomplete="off"
        />
        <button id="agro-send-btn" type="submit" class="agro-send-btn" title="Send message">
          ➤
        </button>
      </form>

      <!-- Footer WhatsApp CTA -->
      <div class="agro-footer-cta">
        <span>Need human agro expert?</span>
        <a href="https://wa.me/919777986964?text=Hello%20Nirmala%20Enterprises,%20I%20need%20farming%20support" target="_blank" rel="noopener">
          <span>💬 WhatsApp Help</span>
        </a>
      </div>
    </div>
  `;

  document.body.appendChild(root);

  const launcherBtn = document.getElementById('agro-launcher-btn');
  const chatWindow = document.getElementById('agro-chat-window');
  const closeBtn = document.getElementById('agro-close-btn');
  const messagesArea = document.getElementById('agro-messages-area');
  const chipsContainer = document.getElementById('agro-chips-container');
  const chatForm = document.getElementById('agro-chat-form');
  const inputBox = document.getElementById('agro-input-box');
  const sendBtn = document.getElementById('agro-send-btn');
  const langButtons = root.querySelectorAll('.agro-lang-btn');

  // Load chat history from localStorage or set initial welcome
  let messages = [];
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) messages = JSON.parse(saved);
  } catch (e) {}

  if (!Array.isArray(messages) || messages.length === 0) {
    messages = [
      {
        role: 'bot',
        text: initialGreetings[currentLang] || initialGreetings.en,
        time: formatTime(new Date())
      }
    ];
  }

  function renderMessages() {
    messagesArea.innerHTML = '';
    messages.forEach(msg => {
      const bubble = document.createElement('div');
      bubble.className = `agro-msg-bubble ${msg.role === 'user' ? 'agro-msg-user' : 'agro-msg-bot'}`;
      bubble.innerHTML = formatMarkdown(msg.text) + `<div class="agro-msg-meta">${msg.time}</div>`;
      messagesArea.appendChild(bubble);
    });
    messagesArea.scrollTop = messagesArea.scrollHeight;
  }

  function renderChips() {
    chipsContainer.innerHTML = '';
    const chips = quickChips[currentLang] || quickChips.en;
    chips.forEach(chip => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'agro-chip';
      btn.textContent = chip.label;
      btn.addEventListener('click', () => {
        inputBox.value = chip.query;
        handleSendMessage();
      });
      chipsContainer.appendChild(btn);
    });
  }

  function toggleChat(open) {
    isOpen = typeof open === 'boolean' ? open : !isOpen;
    if (isOpen) {
      chatWindow.classList.add('open');
      launcherBtn.style.display = 'none';
      renderMessages();
      renderChips();
      setTimeout(() => inputBox.focus(), 200);
    } else {
      chatWindow.classList.remove('open');
      launcherBtn.style.display = 'flex';
    }
  }

  launcherBtn.addEventListener('click', () => toggleChat(true));
  closeBtn.addEventListener('click', () => toggleChat(false));

  // Language buttons
  langButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      langButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentLang = btn.dataset.lang;
      localStorage.setItem(LANG_KEY, currentLang);
      renderChips();
      
      // Add language acknowledgement
      const langAcks = {
        en: 'Switched to English. How can I help you?',
        or: 'ଓଡ଼ିଆ ଭାଷା ଚୟନ କରାଗଲା. କିପରି ସାହାଯ୍ୟ କରିବି?',
        hi: 'हिंदी भाषा चुनी गई. मैं आपकी क्या सहायता कर सकता हूँ?'
      };
      appendMessage('bot', langAcks[currentLang] || langAcks.en);
    });
  });

  // Handle Form Submit
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSendMessage();
  });

  async function handleSendMessage() {
    const text = (inputBox.value || '').trim();
    if (!text || isSending) return;

    inputBox.value = '';
    appendMessage('user', text);

    // Show typing indicator
    isSending = true;
    sendBtn.disabled = true;
    const typingIndicator = showTyping();

    try {
      // Build conversation history for context
      const history = messages.slice(-6).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        text: m.text
      }));

      const res = await fetch('/api/chatbot/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          language: currentLang,
          history
        })
      });

      removeTyping(typingIndicator);

      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      const reply = data.reply || "Sorry, I couldn't process your request. Please try again or WhatsApp our helpline at +91 9777986964.";
      appendMessage('bot', reply);
    } catch (err) {
      removeTyping(typingIndicator);
      console.warn('Chatbot fetch error:', err.message);
      appendMessage('bot', '⚠️ Connection note: Store server responded with an error. For immediate assistance, please call/WhatsApp +91 9777986964.');
    } finally {
      isSending = false;
      sendBtn.disabled = false;
      inputBox.focus();
    }
  }

  function appendMessage(role, text) {
    const msg = {
      role,
      text,
      time: formatTime(new Date())
    };
    messages.push(msg);
    // Keep max 30 messages in storage
    if (messages.length > 30) messages = messages.slice(-30);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch (e) {}

    renderMessages();
  }

  function showTyping() {
    const typing = document.createElement('div');
    typing.className = 'agro-typing';
    typing.id = 'agro-typing-indicator';
    typing.innerHTML = `
      <span class="agro-dot"></span>
      <span class="agro-dot"></span>
      <span class="agro-dot"></span>
    `;
    messagesArea.appendChild(typing);
    messagesArea.scrollTop = messagesArea.scrollHeight;
    return typing;
  }

  function removeTyping(el) {
    if (el && el.parentNode) {
      el.parentNode.removeChild(el);
    }
  }

  function formatTime(d) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function formatMarkdown(str) {
    if (!str) return '';
    return str
      // Escape basic html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Bullet points
      .replace(/^[•*-]\s+(.+)$/gm, '<li>$1</li>')
      // Wrap consecutive li in ul
      .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
      // Clean duplicate uls
      .replace(/<\/ul>\s*<ul>/g, '')
      // Line breaks
      .replace(/\n/g, '<br/>')
      // Clean excessive br after ul
      .replace(/<\/ul><br\/>/g, '</ul>');
  }

  // Keyboard shortcut: Esc to close
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) {
      toggleChat(false);
    }
  });

})();
