(() => {
  const THEME_KEY = "job-research.theme";
  const NAV_OPEN_KEY = "job-research.navOpen";
  const PREVIEW_DETACHED_KEY = "job-research.previewDetached";
  const SPEECH_VOICE_KEY = "job-research.speechVoice";

  const STATUS_LANES = [
    { id: "active", label: "Active" },
    { id: "in_progress", label: "In progress" },
    { id: "applied", label: "Applied" },
    { id: "interview", label: "Interview" },
    { id: "dead", label: "Dead" },
  ];
  const STATUS_LABELS = {
    active: "Active",
    in_progress: "In progress",
    applied: "Applied",
    interview: "Interview",
    dead: "Dead",
  };
  const PROTECTED_STATUSES = new Set(["in_progress", "applied", "interview"]);

  // Keep in sync with sites.md / scripts/serve_leads.py SOURCE_CATALOG
  const SOURCE_CATALOG = [
    { id: "linkedin", label: "LinkedIn Jobs", group: "Aggregators" },
    { id: "indeed", label: "Indeed", group: "Aggregators" },
    { id: "google-jobs", label: "Google Jobs", group: "Aggregators" },
    { id: "trueup", label: "TrueUp", group: "Aggregators" },
    { id: "levels", label: "Levels.fyi Jobs", group: "Aggregators" },
    { id: "dice", label: "Dice", group: "Aggregators" },
    { id: "greenhouse", label: "Greenhouse", group: "ATS" },
    { id: "lever", label: "Lever", group: "ATS" },
    { id: "ashby", label: "Ashby", group: "ATS" },
    { id: "workday", label: "Workday", group: "ATS" },
    { id: "smartrecruiters", label: "SmartRecruiters", group: "ATS" },
    { id: "workable", label: "Workable", group: "ATS" },
    { id: "company", label: "Company career pages", group: "ATS" },
    { id: "remoteok", label: "RemoteOK", group: "Remote" },
    { id: "weworkremotely", label: "We Work Remotely", group: "Remote" },
    { id: "himalayas", label: "Himalayas", group: "Remote" },
    { id: "wellfound", label: "Wellfound", group: "Startup / community" },
    { id: "yc", label: "YC Work at a Startup", group: "Startup / community" },
    { id: "otta", label: "Otta / Welcome to the Jungle", group: "Startup / community" },
    { id: "builtin", label: "Built In", group: "Startup / community" },
    { id: "hackernews", label: "HN Who’s Hiring", group: "Startup / community" },
  ];
  const SOURCE_IDS = new Set(SOURCE_CATALOG.map((s) => s.id));

  const state = {
    manifest: { updated_at: null, leads: [] },
    metas: new Map(),
    companyBriefs: new Map(),
    companyIndex: [],
    selectedId: null,
    selectedCompanySlug: null,
    view: "leads",
    writeMode: null, // 'api' | 'agent-only'
    theme: readTheme(),
    navOpen: readNavOpen(),
    previewDetached: readPreviewDetached(),
    disabledSources: new Set(),
    dragLeadId: null,
    applyingRoute: false,
    speech: {
      text: "",
      chunks: [],
      index: 0,
      active: false,
      paused: false,
      sourceKey: null,
      root: null,
    },
  };

  function readTheme() {
    try {
      const raw = localStorage.getItem(THEME_KEY);
      if (raw === "dark" || raw === "light") return raw;
    } catch {
      /* private mode / unavailable */
    }
    const attr = document.documentElement.getAttribute("data-theme");
    return attr === "dark" ? "dark" : "light";
  }

  function readNavOpen() {
    try {
      const raw = localStorage.getItem(NAV_OPEN_KEY);
      if (raw === "0") return false;
      if (raw === "1") return true;
    } catch {
      /* ignore */
    }
    return document.documentElement.dataset.nav !== "closed";
  }

  function readPreviewDetached() {
    try {
      const raw = localStorage.getItem(PREVIEW_DETACHED_KEY);
      if (raw === "1") return true;
      if (raw === "0") return false;
    } catch {
      /* ignore */
    }
    return document.documentElement.dataset.preview === "detached";
  }

  function readSpeechVoiceURI() {
    try {
      return localStorage.getItem(SPEECH_VOICE_KEY) || "";
    } catch {
      return "";
    }
  }

  function writeSpeechVoiceURI(uri) {
    try {
      if (uri) localStorage.setItem(SPEECH_VOICE_KEY, uri);
      else localStorage.removeItem(SPEECH_VOICE_KEY);
    } catch {
      /* ignore */
    }
  }

  function speechSupported() {
    return typeof window.speechSynthesis !== "undefined" && typeof window.SpeechSynthesisUtterance !== "undefined";
  }

  const TTS_ACRONYMS = {
    AI: "A I",
    API: "A P I",
    AR: "augmented reality",
    ATS: "A T S",
    AWS: "A W S",
    BNPL: "buy now pay later",
    CD: "continuous delivery",
    CDP: "customer data platform",
    CEO: "C E O",
    CEP: "C E P",
    CFO: "C F O",
    CI: "continuous integration",
    CRM: "C R M",
    CTO: "C T O",
    CV: "C V",
    EM: "engineering manager",
    ETL: "extract transform load",
    GCP: "G C P",
    GPT: "G P T",
    HTML: "H T M L",
    HTTP: "H T T P",
    HTTPS: "H T T P S",
    IOT: "internet of things",
    JD: "job description",
    JSON: "jason",
    K8S: "kubernetes",
    LLM: "large language model",
    LLMS: "large language models",
    ML: "machine learning",
    MMS: "M M S",
    MVP: "M V P",
    NLP: "N L P",
    NYC: "New York City",
    OKR: "O K R",
    OKRS: "O K Rs",
    PDF: "P D F",
    PM: "product manager",
    QA: "Q A",
    RAG: "retrieval augmented generation",
    RCS: "R C S",
    ROI: "return on investment",
    SDK: "S D K",
    SEO: "S E O",
    SLA: "S L A",
    SMS: "S M S",
    SQL: "sequel",
    SRE: "site reliability engineer",
    SSO: "single sign-on",
    SSR: "server-side rendering",
    SWE: "software engineer",
    TL: "tech lead",
    TPM: "technical program manager",
    TTS: "text to speech",
    UI: "U I",
    US: "United States",
    USA: "United States",
    UX: "U X",
    VP: "V P",
    VR: "virtual reality",
    WIP: "work in progress",
    YC: "Y Combinator",
  };

  function spellLetters(token) {
    return [...String(token).toUpperCase()].join(" ");
  }

  function expandAcronymToken(raw) {
    const text = String(raw || "");
    // True plurals look like APIs / SDKs (caps stem + lowercase s)
    const pluralMatch = text.match(/^([A-Z]{2,6})s$/);
    if (pluralMatch) {
      const stem = pluralMatch[1];
      const expansion = TTS_ACRONYMS[stem] || spellLetters(stem);
      return `${expansion} s`;
    }

    const upper = text.toUpperCase();
    if (TTS_ACRONYMS[upper]) return TTS_ACRONYMS[upper];

    // ALL-CAPS tokens (SMS, RCS, …): spell every letter — never strip a trailing S
    if (/^[A-Z]{2,6}$/.test(text)) return spellLetters(text);

    return text;
  }

  const ONES = [
    "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
    "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
    "seventeen", "eighteen", "nineteen",
  ];
  const TENS = [
    "", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety",
  ];

  function numberToWords(n) {
    const num = Math.floor(Math.abs(Number(n)));
    if (!Number.isFinite(num)) return String(n);
    if (num < 20) return ONES[num];
    if (num < 100) {
      const t = Math.floor(num / 10);
      const o = num % 10;
      return o ? `${TENS[t]}-${ONES[o]}` : TENS[t];
    }
    if (num < 1000) {
      const h = Math.floor(num / 100);
      const rest = num % 100;
      return rest ? `${ONES[h]} hundred ${numberToWords(rest)}` : `${ONES[h]} hundred`;
    }
    if (num < 1000000) {
      const th = Math.floor(num / 1000);
      const rest = num % 1000;
      return rest
        ? `${numberToWords(th)} thousand ${numberToWords(rest)}`
        : `${numberToWords(th)} thousand`;
    }
    if (num < 1000000000) {
      const m = Math.floor(num / 1000000);
      const rest = num % 1000000;
      return rest
        ? `${numberToWords(m)} million ${numberToWords(rest)}`
        : `${numberToWords(m)} million`;
    }
    return String(num);
  }

  function numberToOrdinalWords(n) {
    const num = Math.floor(Math.abs(Number(n)));
    const special = {
      1: "first",
      2: "second",
      3: "third",
      4: "fourth",
      5: "fifth",
      8: "eighth",
      9: "ninth",
      12: "twelfth",
      20: "twentieth",
      30: "thirtieth",
      40: "fortieth",
      50: "fiftieth",
      60: "sixtieth",
      70: "seventieth",
      80: "eightieth",
      90: "ninetieth",
    };
    if (special[num]) return special[num];
    if (num < 20) return `${numberToWords(num)}th`;
    if (num < 100) {
      const t = Math.floor(num / 10) * 10;
      const o = num % 10;
      if (!o) return special[t] || `${numberToWords(num)}th`;
      return `${TENS[t / 10]}-${numberToOrdinalWords(o)}`;
    }
    const words = numberToWords(num);
    if (words.endsWith("one")) return `${words.slice(0, -3)}first`;
    if (words.endsWith("two")) return `${words.slice(0, -3)}second`;
    if (words.endsWith("three")) return `${words.slice(0, -5)}third`;
    if (words.endsWith("y")) return `${words.slice(0, -1)}ieth`;
    return `${words}th`;
  }

  function yearToWords(year) {
    const y = Number(year);
    if (!Number.isFinite(y) || y < 1000 || y > 9999) return String(year);
    const top = Math.floor(y / 100);
    const bottom = y % 100;
    if (bottom === 0) return `${numberToWords(top)} hundred`;
    if (bottom < 10) return `${numberToWords(top)} oh ${ONES[bottom]}`;
    return `${numberToWords(top)} ${numberToWords(bottom)}`;
  }

  function moneyAmountToWords(raw) {
    const cleaned = String(raw).replace(/[$,\s]/g, "").toLowerCase();
    const m = cleaned.match(/^(\d+(?:\.\d+)?)([km])?$/i);
    if (!m) return String(raw);
    let value = Number(m[1]);
    const suffix = (m[2] || "").toLowerCase();
    if (suffix === "k") value *= 1000;
    if (suffix === "m") value *= 1000000;
    if (!Number.isFinite(value)) return String(raw);
    if (value >= 1000000 && value % 1000000 === 0) {
      return `${numberToWords(value / 1000000)} million dollars`;
    }
    if (value >= 1000 && value % 1000 === 0) {
      return `${numberToWords(value / 1000)} thousand dollars`;
    }
    return `${numberToWords(Math.round(value))} dollars`;
  }

  /** Rewrite prose so browser TTS reads numbers, money, and acronyms cleanly. */
  function normalizeSpeechForTts(text) {
    let s = String(text || "");

    s = s
      .replace(/\r\n/g, "\n")
      .replace(/[–—]/g, " to ")
      .replace(/\u2192|→/g, " to ")
      .replace(/\u00d7|×/g, " by ")
      .replace(/&/g, " and ")
      .replace(/\bN\/A\b/gi, "not available")
      .replace(/\//g, " and ");

    // Currency ranges first, then single amounts
    s = s.replace(
      /\$\s*(\d+(?:\.\d+)?\s*[km]?)\s+to\s+\$\s*(\d+(?:\.\d+)?\s*[km]?)/gi,
      (_, a, b) => `${moneyAmountToWords(a)} to ${moneyAmountToWords(b)}`
    );
    s = s.replace(
      /\$\s*(\d+(?:\.\d+)?\s*[km]?)\s*(?:to|-)\s*\$?\s*(\d+(?:\.\d+)?\s*[km]?)/gi,
      (_, a, b) => `${moneyAmountToWords(a)} to ${moneyAmountToWords(b)}`
    );
    s = s.replace(/\$\s*(\d+(?:\.\d+)?\s*[km]?)\b/gi, (_, a) => moneyAmountToWords(a));

    // Bare salary-style ranges without dollar signs: 195k to 255k
    s = s.replace(
      /\b(\d+(?:\.\d+)?[km])\s+to\s+(\d+(?:\.\d+)?[km])\b/gi,
      (_, a, b) => `${moneyAmountToWords(a)} to ${moneyAmountToWords(b)}`
    );

    // Percents
    s = s.replace(/\b(\d+(?:\.\d+)?)\s*%/g, (_, n) => {
      const num = Number(n);
      if (!Number.isFinite(num)) return `${n} percent`;
      if (Number.isInteger(num)) return `${numberToWords(num)} percent`;
      const [whole, frac] = String(n).split(".");
      return `${numberToWords(whole)} point ${[...frac].map((d) => ONES[Number(d)] || d).join(" ")} percent`;
    });

    // Ordinals before plain numbers
    s = s.replace(/\b(\d+)(st|nd|rd|th)\b/gi, (_, n) => numberToOrdinalWords(n));

    // Years 1900-2099
    s = s.replace(/\b((?:19|20)\d{2})\b/g, (_, y) => yearToWords(y));

    // Remaining small integers
    s = s.replace(/\b(\d{1,4})\b/g, (_, n) => numberToWords(n));

    // Known acronyms / initialisms.
    // Plurals must be "APIs" (lowercase s), not "SMS" (trailing S is part of the acronym).
    s = s.replace(/\b[A-Z]{2,6}s?\b/g, (raw) => expandAcronymToken(raw));

    // Collapse any remaining dotted initialisms into spaced letters
    s = s.replace(/\b(?:[A-Za-z]\.){1,8}[A-Za-z]?\.?/g, (m) => {
      const letters = m.replace(/\./g, "").toUpperCase();
      return letters ? spellLetters(letters) : m;
    });

    s = s.replace(/\b0 to 1\b/gi, "zero to one");

    return s.replace(/\s+/g, " ").trim();
  }

  function splitSpeechChunks(text) {
    let cleaned = normalizeSpeechForTts(text)
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{2,}/g, "\n")
      .trim();
    if (!cleaned) return [];

    // Only treat .!? as sentence ends when followed by whitespace + capital
    // (or end of string). Avoids splitting "A.I." / "Dr." style tokens.
    const parts = [];
    let buf = "";
    for (let i = 0; i < cleaned.length; i += 1) {
      const ch = cleaned[i];
      buf += ch;
      if (!/[.!?]/.test(ch)) continue;
      // Consume trailing quotes/brackets after the stop
      while (i + 1 < cleaned.length && /["')\]]/.test(cleaned[i + 1])) {
        i += 1;
        buf += cleaned[i];
      }
      const rest = cleaned.slice(i + 1);
      const isEnd = !rest.trim();
      const nextSentence = /^\s+[A-Z"']/.test(rest);
      if (isEnd || nextSentence) {
        const piece = buf.replace(/\s+/g, " ").trim();
        if (piece) parts.push(piece);
        buf = "";
      }
    }
    const tail = buf.replace(/\s+/g, " ").trim();
    if (tail) parts.push(tail);
    // Drop tiny fragments (single letter / initial leftovers)
    return parts.filter((p) => p.replace(/[^A-Za-z0-9]/g, "").length > 1);
  }

  function listSpeechVoices() {
    if (!speechSupported()) return [];
    return window.speechSynthesis.getVoices() || [];
  }

  function resolveSpeechVoice(preferredURI) {
    const voices = listSpeechVoices();
    if (!voices.length) return null;
    const uri = preferredURI || readSpeechVoiceURI();
    if (uri) {
      const match = voices.find((v) => v.voiceURI === uri);
      if (match) return match;
    }
    const en = voices.find((v) => /^en(-|_)/i.test(v.lang)) || voices.find((v) => /en/i.test(v.lang));
    return en || voices[0];
  }

  function populateVoiceSelect(select) {
    if (!select) return;
    const voices = listSpeechVoices();
    const preferred = readSpeechVoiceURI();
    const prev = select.value || preferred;
    select.innerHTML = "";
    if (!voices.length) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "Default voice";
      select.appendChild(opt);
      return;
    }
    for (const voice of voices) {
      const opt = document.createElement("option");
      opt.value = voice.voiceURI;
      opt.textContent = `${voice.name} (${voice.lang})`;
      select.appendChild(opt);
    }
    const pick =
      (prev && voices.some((v) => v.voiceURI === prev) && prev) ||
      (preferred && voices.some((v) => v.voiceURI === preferred) && preferred) ||
      (resolveSpeechVoice(preferred)?.voiceURI ?? voices[0].voiceURI);
    select.value = pick;
  }

  function syncSpeechTransportUI() {
    const root = state.speech.root;
    if (!root) return;
    const player = root.querySelector(".speech-player");
    const transport = root.querySelector(".speech-transport");
    const speakBtn = root.querySelector(".speech-speak");
    const playBtn = root.querySelector('[data-speech="play"]');
    const transcript = root.querySelector(".speech-transcript");
    const caption = root.querySelector(".speech-caption");
    const captionMeta = root.querySelector(".speech-caption-meta");
    const captionPrev = root.querySelector(".speech-caption-prev");
    const captionNext = root.querySelector(".speech-caption-next");
    const active = state.speech.active;
    const paused = state.speech.paused;
    const chunks = state.speech.chunks;
    const index = state.speech.index;
    const current = chunks[index] || "";

    if (player) player.classList.toggle("is-active", active);
    if (transport) transport.hidden = !active;
    if (transcript) transcript.hidden = !active;
    if (speakBtn) {
      speakBtn.setAttribute("aria-pressed", String(active));
      speakBtn.textContent = !active ? "Speak" : paused ? "Paused" : "Speaking…";
    }
    if (playBtn) {
      playBtn.textContent = paused ? "Play" : "Pause";
      playBtn.setAttribute("aria-label", paused ? "Play" : "Pause");
      playBtn.disabled = !active;
    }
    root.querySelector('[data-speech="back"]')?.toggleAttribute("disabled", !active);
    root.querySelector('[data-speech="forward"]')?.toggleAttribute("disabled", !active);
    root.querySelector('[data-speech="stop"]')?.toggleAttribute("disabled", !active);

    if (captionMeta) {
      captionMeta.textContent = active && chunks.length
        ? `${index + 1} / ${chunks.length}`
        : "";
    }
    if (caption) {
      const next = active ? current : "";
      if (caption.textContent !== next) {
        caption.textContent = next;
        caption.classList.remove("is-fresh");
        void caption.offsetWidth;
        if (next) caption.classList.add("is-fresh");
      }
    }
    if (captionPrev) {
      captionPrev.textContent = active && index > 0 ? chunks[index - 1] : "";
      captionPrev.hidden = !captionPrev.textContent;
    }
    if (captionNext) {
      captionNext.textContent =
        active && index < chunks.length - 1 ? chunks[index + 1] : "";
      captionNext.hidden = !captionNext.textContent;
    }
  }

  let speechSpeakToken = 0;
  let speechSpeakTimer = null;
  let speechCurrentUtterance = null;

  function detachCurrentUtterance() {
    if (!speechCurrentUtterance) return;
    try {
      speechCurrentUtterance.onend = null;
      speechCurrentUtterance.onerror = null;
      speechCurrentUtterance.onboundary = null;
    } catch {
      /* ignore */
    }
    speechCurrentUtterance = null;
  }

  function cancelSpeechSynthesis() {
    if (speechSpeakTimer != null) {
      clearTimeout(speechSpeakTimer);
      speechSpeakTimer = null;
    }
    detachCurrentUtterance();
    if (!speechSupported()) return;
    try {
      // Chrome often ignores a single cancel(); pause+cancel+empty sink is more reliable.
      window.speechSynthesis.pause();
      window.speechSynthesis.cancel();
      const sink = new SpeechSynthesisUtterance("");
      sink.volume = 0;
      sink.rate = 10;
      window.speechSynthesis.speak(sink);
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }

  function invalidateSpeechUtterance() {
    speechSpeakToken += 1;
    cancelSpeechSynthesis();
  }

  function stopSpeech({ keepRoot = false } = {}) {
    invalidateSpeechUtterance();
    state.speech.active = false;
    state.speech.paused = false;
    state.speech.index = 0;
    state.speech.sourceKey = null;
    syncSpeechTransportUI();
    if (!keepRoot) state.speech.root = null;
    // Belt-and-suspenders: Chrome sometimes restarts a queued utterance after cancel.
    if (speechSupported()) {
      setTimeout(() => {
        try {
          window.speechSynthesis.cancel();
        } catch {
          /* ignore */
        }
      }, 0);
      setTimeout(() => {
        try {
          window.speechSynthesis.cancel();
        } catch {
          /* ignore */
        }
      }, 75);
    }
  }

  function speakCurrentChunk() {
    if (!speechSupported() || !state.speech.active || state.speech.paused) return;
    const chunk = state.speech.chunks[state.speech.index];
    if (!chunk) {
      stopSpeech({ keepRoot: true });
      return;
    }
    const expectedIndex = state.speech.index;
    const expectedKey = state.speech.sourceKey;
    const token = ++speechSpeakToken;

    // Cancel any in-flight utterance, then defer speak(). Chrome often drops
    // speak() when it runs in the same turn as cancel().
    cancelSpeechSynthesis();
    syncSpeechTransportUI();

    speechSpeakTimer = setTimeout(() => {
      speechSpeakTimer = null;
      if (token !== speechSpeakToken) return;
      if (!state.speech.active || state.speech.paused) return;
      if (state.speech.sourceKey !== expectedKey) return;
      if (state.speech.index !== expectedIndex) return;

      const utter = new SpeechSynthesisUtterance(chunk);
      const select = state.speech.root?.querySelector(".speech-voice");
      const voice = resolveSpeechVoice(select?.value || readSpeechVoiceURI());
      if (voice) utter.voice = voice;
      utter.rate = 1;
      utter.pitch = 1;
      utter.onend = () => {
        if (speechCurrentUtterance === utter) speechCurrentUtterance = null;
        if (token !== speechSpeakToken) return;
        if (!state.speech.active || state.speech.paused) return;
        if (state.speech.sourceKey !== expectedKey) return;
        if (state.speech.index !== expectedIndex) return;
        if (state.speech.index + 1 >= state.speech.chunks.length) {
          stopSpeech({ keepRoot: true });
          return;
        }
        state.speech.index += 1;
        syncSpeechTransportUI();
        speakCurrentChunk();
      };
      utter.onerror = (event) => {
        if (speechCurrentUtterance === utter) speechCurrentUtterance = null;
        if (token !== speechSpeakToken) return;
        const err = event?.error;
        // Intentional cancel/skip — don't tear down the player.
        if (err === "interrupted" || err === "canceled") return;
        stopSpeech({ keepRoot: true });
      };
      try {
        speechCurrentUtterance = utter;
        window.speechSynthesis.speak(utter);
        if (window.speechSynthesis.paused) window.speechSynthesis.resume();
      } catch {
        speechCurrentUtterance = null;
        stopSpeech({ keepRoot: true });
      }
    }, 60);
  }

  function startSpeech(text, { root, sourceKey } = {}) {
    if (!speechSupported()) {
      alert("Speech synthesis is not supported in this browser.");
      return;
    }
    const chunks = splitSpeechChunks(text);
    if (!chunks.length) {
      alert("No speech script found for this item yet. Re-run /job-search or /job-company-detail to generate speech.txt.");
      return;
    }
    invalidateSpeechUtterance();
    state.speech.text = text;
    state.speech.chunks = chunks;
    state.speech.index = 0;
    state.speech.active = true;
    state.speech.paused = false;
    state.speech.sourceKey = sourceKey || null;
    state.speech.root = root || null;
    populateVoiceSelect(root?.querySelector(".speech-voice"));
    syncSpeechTransportUI();
    speakCurrentChunk();
  }

  function speechPause() {
    if (!state.speech.active || state.speech.paused) return;
    // Don't trust speechSynthesis.pause() — broken in Chrome/Safari.
    // Cancel the current utterance and keep the chunk index for resume.
    invalidateSpeechUtterance();
    state.speech.paused = true;
    syncSpeechTransportUI();
  }

  function speechResume() {
    if (!state.speech.active || !state.speech.paused) return;
    state.speech.paused = false;
    syncSpeechTransportUI();
    speakCurrentChunk();
  }

  function speechPlayPause() {
    if (!speechSupported() || !state.speech.active) return;
    if (state.speech.paused) speechResume();
    else speechPause();
  }

  function speechForward() {
    if (!state.speech.active || !state.speech.chunks.length) return;
    if (state.speech.index >= state.speech.chunks.length - 1) {
      stopSpeech({ keepRoot: true });
      return;
    }
    invalidateSpeechUtterance();
    state.speech.index += 1;
    state.speech.paused = false;
    syncSpeechTransportUI();
    speakCurrentChunk();
  }

  function speechBackward() {
    if (!state.speech.active || !state.speech.chunks.length) return;
    invalidateSpeechUtterance();
    state.speech.index = Math.max(0, state.speech.index - 1);
    state.speech.paused = false;
    syncSpeechTransportUI();
    speakCurrentChunk();
  }

  function buildSpeechControls({ hasSpeech }) {
    const player = document.createElement("div");
    player.className = "speech-player";

    const bar = document.createElement("div");
    bar.className = "speech-bar";

    const speakBtn = document.createElement("button");
    speakBtn.type = "button";
    speakBtn.className = "btn ghost small speech-speak";
    speakBtn.textContent = "Speak";
    if (!hasSpeech) {
      speakBtn.disabled = true;
      speakBtn.title = "No speech.txt yet — re-run /job-search or /job-company-detail";
    } else if (!speechSupported()) {
      speakBtn.disabled = true;
      speakBtn.title = "Speech synthesis not supported in this browser";
    } else {
      speakBtn.title = "Play spoken summary";
    }
    bar.appendChild(speakBtn);

    const transport = document.createElement("div");
    transport.className = "speech-transport";
    transport.hidden = true;
    transport.innerHTML = `
      <button type="button" class="btn ghost small" data-speech="play" aria-label="Pause">Pause</button>
      <button type="button" class="btn ghost small" data-speech="back" aria-label="Previous sentence">Back</button>
      <button type="button" class="btn ghost small" data-speech="forward" aria-label="Next sentence">Fwd</button>
      <button type="button" class="btn ghost small" data-speech="stop" aria-label="Stop">Stop</button>
      <label class="speech-voice-wrap">
        <span class="speech-voice-label">Voice</span>
        <select class="speech-voice" aria-label="Browser voice"></select>
      </label>
    `;
    bar.appendChild(transport);
    player.appendChild(bar);

    const transcript = document.createElement("div");
    transcript.className = "speech-transcript";
    transcript.hidden = true;
    transcript.setAttribute("aria-live", "polite");
    transcript.innerHTML = `
      <div class="speech-caption-meta"></div>
      <p class="speech-caption-prev" hidden></p>
      <p class="speech-caption"></p>
      <p class="speech-caption-next" hidden></p>
    `;
    player.appendChild(transcript);

    populateVoiceSelect(transport.querySelector(".speech-voice"));
    return player;
  }

  function wireSpeechControls(root, { text, sourceKey, hasSpeech }) {
    if (!root) return;
    const speakBtn = root.querySelector(".speech-speak");
    const transport = root.querySelector(".speech-transport");
    const voiceSelect = root.querySelector(".speech-voice");
    if (!speakBtn || !transport) return;

    if (state.speech.root && state.speech.root !== root) {
      stopSpeech();
    }

    speakBtn.addEventListener("click", () => {
      if (!hasSpeech || !text?.trim()) {
        alert("No speech.txt yet. Re-run /job-search or /job-company-detail to generate it.");
        return;
      }
      if (state.speech.active && state.speech.sourceKey === sourceKey) {
        stopSpeech({ keepRoot: true });
        return;
      }
      startSpeech(text, { root, sourceKey });
    });

    transport.querySelector('[data-speech="play"]')?.addEventListener("click", () => {
      if (!state.speech.active) {
        startSpeech(text, { root, sourceKey });
        return;
      }
      speechPlayPause();
    });
    transport.querySelector('[data-speech="back"]')?.addEventListener("click", speechBackward);
    transport.querySelector('[data-speech="forward"]')?.addEventListener("click", speechForward);
    transport.querySelector('[data-speech="stop"]')?.addEventListener("click", () => {
      stopSpeech({ keepRoot: true });
    });

    voiceSelect?.addEventListener("change", () => {
      writeSpeechVoiceURI(voiceSelect.value || "");
      if (state.speech.active && state.speech.root === root && !state.speech.paused) {
        invalidateSpeechUtterance();
        speakCurrentChunk();
      }
    });
  }

  function applyTheme(theme) {
    const next = theme === "dark" ? "dark" : "light";
    state.theme = next;
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* ignore */
    }
    if (els.btnTheme) {
      const toDark = next === "light";
      els.btnTheme.setAttribute(
        "aria-label",
        toDark ? "Switch to dark theme" : "Switch to light theme"
      );
      els.btnTheme.title = toDark
        ? "Switch to dark theme"
        : "Switch to light theme";
      const label =
        els.btnTheme.querySelector(".settings-row-name") ||
        els.btnTheme.querySelector(":scope > span:first-child");
      if (label) label.textContent = toDark ? "Theme · Light" : "Theme · Dark";
    }
  }

  function toggleTheme() {
    applyTheme(state.theme === "dark" ? "light" : "dark");
  }

  const WORK_MODE_LABELS = {
    remote: "Fully remote",
    hybrid: "Hybrid",
    "local-office": "Local office",
    other: "Other location",
  };

  const ICON_RESUME = `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><path fill="currentColor" d="M3.5 1.5A1.5 1.5 0 0 1 5 0h4.793L14 4.207V14.5A1.5 1.5 0 0 1 12.5 16h-7A1.5 1.5 0 0 1 4 14.5v-13zm5.293.5H5a.5.5 0 0 0-.5.5v13a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5V5.207L9.793 2z"/><path fill="currentColor" d="M5.75 7.25h4.5v1h-4.5zm0 2.5h4.5v1h-4.5zm0 2.5h3v1h-3z"/></svg>`;
  const ICON_COVER = `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><path fill="currentColor" d="M1.5 3A1.5 1.5 0 0 1 3 1.5h10A1.5 1.5 0 0 1 14.5 3v10a1.5 1.5 0 0 1-1.5 1.5H3A1.5 1.5 0 0 1 1.5 13V3zm1 .5v.348l5.146 3.217a.75.75 0 0 0 .708 0L13.5 3.848V3.5a.5.5 0 0 0-.5-.5H3a.5.5 0 0 0-.5.5zm0 1.902V13a.5.5 0 0 0 .5.5h10a.5.5 0 0 0 .5-.5V5.402L8.854 8.62a1.75 1.75 0 0 1-1.708 0L2.5 5.402z"/></svg>`;
  const COMPANY_ICON_FILES = [
    "icon.png",
    "icon.webp",
    "icon.jpg",
    "icon.jpeg",
    "icon.svg",
    "icon.ico",
    "icon.gif",
  ];

  const els = {
    app: document.getElementById("app"),
    sideNav: document.getElementById("side-nav"),
    navBackdrop: document.getElementById("nav-backdrop"),
    kanbanBoard: document.getElementById("kanban-board"),
    listEmpty: document.getElementById("list-empty"),
    detailPane: document.getElementById("detail-pane"),
    detail: document.getElementById("detail"),
    detailEmpty: document.getElementById("detail-empty"),
    viewTitle: document.getElementById("view-title"),
    viewProfile: document.getElementById("view-profile"),
    viewLeads: document.getElementById("view-leads"),
    viewCompanies: document.getElementById("view-companies"),
    viewSources: document.getElementById("view-sources"),
    viewSettings: document.getElementById("view-settings"),
    btnMenu: document.getElementById("btn-menu"),
    btnPreviewMode: document.getElementById("btn-preview-mode"),
    sourcesList: document.getElementById("sources-list"),
    sourcesSummary: document.getElementById("sources-summary"),
    btnSourcesEnableAll: document.getElementById("btn-sources-enable-all"),
    btnSourcesDisableAll: document.getElementById("btn-sources-disable-all"),
    btnSourcesRefresh: document.getElementById("btn-sources-refresh"),
    filterStatus: document.getElementById("filter-status"),
    filterFraud: document.getElementById("filter-fraud"),
    filterLocation: document.getElementById("filter-location"),
    filterRecency: document.getElementById("filter-recency"),
    filterCompany: document.getElementById("filter-company"),
    filterSource: document.getElementById("filter-source"),
    filterQ: document.getElementById("filter-q"),
    btnReset: document.getElementById("btn-reset"),
    btnRefresh: document.getElementById("btn-refresh"),
    btnTheme: document.getElementById("btn-theme"),
    linkCandidate: document.getElementById("link-candidate"),
    linkResumePdf: document.getElementById("link-resume-pdf"),
    linkResumeHtml: document.getElementById("link-resume-html"),
    linkResumeMd: document.getElementById("link-resume-md"),
    filterCompanyBrief: document.getElementById("filter-company-brief"),
    filterCompanyQ: document.getElementById("filter-company-q"),
    btnCompanyReset: document.getElementById("btn-company-reset"),
    btnCompanyRefresh: document.getElementById("btn-company-refresh"),
    companyList: document.getElementById("company-list"),
    companyListEmpty: document.getElementById("company-list-empty"),
    companyDetailPane: document.getElementById("company-detail-pane"),
    companyDetail: document.getElementById("company-detail"),
    companyDetailEmpty: document.getElementById("company-detail-empty"),
    fsNote: document.getElementById("fs-note"),
    dialog: document.getElementById("confirm-dialog"),
    dialogTitle: document.getElementById("dialog-title"),
    dialogBody: document.getElementById("dialog-body"),
    dialogConfirm: document.getElementById("dialog-confirm"),
    previewLightbox: document.getElementById("preview-lightbox"),
    previewLightboxTitle: document.getElementById("preview-lightbox-title"),
    previewLightboxBody: document.getElementById("preview-lightbox-body"),
    previewLightboxClose: document.getElementById("preview-lightbox-close"),
    btnDockPreview: document.getElementById("btn-dock-preview"),
    docLightbox: document.getElementById("doc-lightbox"),
    docLightboxTitle: document.getElementById("doc-lightbox-title"),
    docLightboxBody: document.getElementById("doc-lightbox-body"),
    docLightboxClose: document.getElementById("doc-lightbox-close"),
  };

  function setNavOpen(open) {
    state.navOpen = Boolean(open);
    if (els.app) els.app.classList.toggle("nav-open", state.navOpen);
    document.documentElement.dataset.nav = state.navOpen ? "open" : "closed";
    try {
      localStorage.setItem(NAV_OPEN_KEY, state.navOpen ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (els.navBackdrop) els.navBackdrop.hidden = !state.navOpen;
    if (els.btnMenu) {
      els.btnMenu.setAttribute("aria-expanded", String(state.navOpen));
      els.btnMenu.setAttribute(
        "aria-label",
        state.navOpen ? "Hide navigation" : "Show navigation"
      );
    }
  }

  function toggleNav() {
    setNavOpen(!state.navOpen);
  }

  function restoreDetailArticlesHome() {
    if (els.detail && els.detailPane && els.detail.parentElement !== els.detailPane) {
      els.detailPane.appendChild(els.detail);
    }
    if (
      els.companyDetail &&
      els.companyDetailPane &&
      els.companyDetail.parentElement !== els.companyDetailPane
    ) {
      els.companyDetailPane.appendChild(els.companyDetail);
    }
  }

  function closePreviewLightbox({ restore = true } = {}) {
    if (els.previewLightbox?.open) els.previewLightbox.close();
    if (restore) restoreDetailArticlesHome();
  }

  function openPreviewLightbox(article, title) {
    if (!els.previewLightbox || !els.previewLightboxBody || !article) return;
    if (els.detail && els.detail !== article && els.detailPane) {
      els.detailPane.appendChild(els.detail);
    }
    if (els.companyDetail && els.companyDetail !== article && els.companyDetailPane) {
      els.companyDetailPane.appendChild(els.companyDetail);
    }
    els.previewLightboxBody.appendChild(article);
    article.classList.remove("hidden");
    if (els.previewLightboxTitle) {
      els.previewLightboxTitle.textContent = title || "Preview";
    }
    if (!els.previewLightbox.open) els.previewLightbox.showModal();
  }

  function syncPreviewPresentation() {
    if (state.view !== "leads" || !state.previewDetached) {
      closePreviewLightbox({ restore: true });
      return;
    }
    if (state.selectedId && els.detail && !els.detail.classList.contains("hidden")) {
      const title = els.detail.querySelector("h2")?.textContent || "Lead preview";
      openPreviewLightbox(els.detail, title);
    } else {
      closePreviewLightbox({ restore: true });
    }
  }

  function setPreviewDetached(detached) {
    state.previewDetached = Boolean(detached);
    if (els.app) els.app.classList.toggle("preview-detached", state.previewDetached);
    document.documentElement.dataset.preview = state.previewDetached
      ? "detached"
      : "docked";
    try {
      localStorage.setItem(PREVIEW_DETACHED_KEY, state.previewDetached ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (els.btnPreviewMode) {
      els.btnPreviewMode.setAttribute("aria-pressed", String(state.previewDetached));
      els.btnPreviewMode.textContent = state.previewDetached
        ? "Dock preview"
        : "Detach preview";
      els.btnPreviewMode.title = state.previewDetached
        ? "Show preview in the side panel again"
        : "Show preview in a lightbox instead of the side panel";
    }
    syncPreviewPresentation();
  }

  function togglePreviewDetached() {
    setPreviewDetached(!state.previewDetached);
  }

  async function fetchJson(path) {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
    return res.json();
  }

  async function fetchText(path) {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) return "";
    return res.text();
  }

  async function fileExists(path) {
    try {
      const head = await fetch(path, { method: "HEAD", cache: "no-store" });
      if (head.ok) return true;
      // Some static servers mishandle HEAD; fall back to GET.
      if (head.status === 405 || head.status === 501) {
        const get = await fetch(path, {
          method: "GET",
          cache: "no-store",
          headers: { Range: "bytes=0-0" },
        });
        return get.ok || get.status === 206;
      }
      return false;
    } catch {
      return false;
    }
  }

  function leadBasePath(lead) {
    const raw = lead?.path || (lead?.id ? `leads/${lead.id}/` : "");
    if (!raw) return "";
    return raw.endsWith("/") ? raw : `${raw}/`;
  }

  function openInNewTabAttrs(a) {
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    return a;
  }

  function makeExternalLink(href, text) {
    const a = document.createElement("a");
    a.href = href;
    openInNewTabAttrs(a);
    a.textContent = text;
    return a;
  }

  function normalizeLeadDocFlags() {
    // Trust has_resume / has_cover_letter from leads/index.json (kept in sync by
    // generate skills + serve_leads). Avoid HEAD probes — missing files 404 in
    // the browser console for every lead without docs.
    for (const lead of state.manifest.leads || []) {
      lead.has_resume = Boolean(lead.has_resume);
      lead.has_cover_letter = Boolean(lead.has_cover_letter);
    }
  }

  function buildDocLinks(lead, { className = "doc-links" } = {}) {
    const wrap = document.createElement("span");
    wrap.className = className;
    const base = leadBasePath(lead);
    if (!base) return wrap;

    if (lead.has_resume) {
      const a = openInNewTabAttrs(document.createElement("a"));
      a.className = "doc-link doc-link-resume";
      a.href = `${base}resume.pdf`;
      a.title = "Open resume PDF";
      a.setAttribute("aria-label", "Open resume PDF");
      a.innerHTML = ICON_RESUME;
      a.addEventListener("click", (e) => e.stopPropagation());
      wrap.appendChild(a);
    }
    if (lead.has_cover_letter) {
      const a = openInNewTabAttrs(document.createElement("a"));
      a.className = "doc-link doc-link-cover";
      a.href = `${base}cover-letter.txt`;
      a.title = "Open cover letter";
      a.setAttribute("aria-label", "Open cover letter");
      a.innerHTML = ICON_COVER;
      a.addEventListener("click", (e) => e.stopPropagation());
      wrap.appendChild(a);
    }
    return wrap;
  }

  async function probeWriteApi() {
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      if (res.ok) {
        state.writeMode = "api";
        els.fsNote.classList.add("hidden");
        return;
      }
    } catch {
      /* static server */
    }
    state.writeMode = "agent-only";
    els.fsNote.textContent =
      "Set status / mark dead need python3 scripts/serve_leads.py — this static page cannot write files under file:// or plain http.server.";
    els.fsNote.classList.remove("hidden");
  }

  function leadStatus(lead) {
    const raw = lead?.status || "active";
    if (STATUS_LABELS[raw]) return raw;
    // Legacy: applied boolean before Applied was a swim lane
    if (lead?.applied) return "applied";
    return "active";
  }

  function isProtectedLead(lead) {
    return PROTECTED_STATUSES.has(leadStatus(lead));
  }

  function formatWhen(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return iso;
    }
  }

  function formatAppliedDate(iso) {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return null;
    }
  }

  function leadInterviews(lead) {
    const raw = lead?.interviews;
    if (!Array.isArray(raw)) return [];
    return raw.filter((iv) => iv && typeof iv === "object");
  }

  function interviewTimeMs(iv) {
    if (!iv?.at) return NaN;
    const t = new Date(iv.at).getTime();
    return Number.isNaN(t) ? NaN : t;
  }

  /** Upcoming soonest first, then past most-recent first. */
  function sortInterviews(list) {
    const now = Date.now();
    const upcoming = [];
    const past = [];
    for (const iv of list) {
      const t = interviewTimeMs(iv);
      if (Number.isNaN(t) || t >= now) upcoming.push(iv);
      else past.push(iv);
    }
    upcoming.sort((a, b) => interviewTimeMs(a) - interviewTimeMs(b));
    past.sort((a, b) => interviewTimeMs(b) - interviewTimeMs(a));
    return [...upcoming, ...past];
  }

  function nextUpcomingInterview(lead) {
    const now = Date.now();
    const upcoming = leadInterviews(lead)
      .filter((iv) => {
        const t = interviewTimeMs(iv);
        return !Number.isNaN(t) && t >= now;
      })
      .sort((a, b) => interviewTimeMs(a) - interviewTimeMs(b));
    return upcoming[0] || null;
  }

  function formatInterviewShort(iv) {
    if (!iv?.at) return "";
    try {
      const when = new Date(iv.at).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
      const label = String(iv.label || "").trim();
      return label ? `${label} · ${when}` : when;
    } catch {
      return String(iv.label || iv.at || "");
    }
  }

  /** datetime-local value from ISO string (local timezone). */
  function toDatetimeLocalValue(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  /** ISO string with local offset from datetime-local value. */
  function fromDatetimeLocalValue(value) {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    const pad = (n) => String(n).padStart(2, "0");
    const offsetMin = -d.getTimezoneOffset();
    const sign = offsetMin >= 0 ? "+" : "-";
    const abs = Math.abs(offsetMin);
    const oh = pad(Math.floor(abs / 60));
    const om = pad(abs % 60);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00${sign}${oh}:${om}`;
  }

  function newInterviewId() {
    const stamp = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 6);
    return `iv-${stamp}-${rand}`;
  }

  const HOUR_MS = 3600e3;
  const DAY_MS = 24 * HOUR_MS;
  const WEEK_MS = 7 * DAY_MS;
  const MONTH_MS = 30 * DAY_MS;
  const RECENCY_BUCKETS = [
    { key: "1h", maxMs: HOUR_MS, label: "NEW 1h", isNew: true },
    { key: "1d", maxMs: DAY_MS, label: "NEW 1d", isNew: true },
    { key: "3d", maxMs: 3 * DAY_MS, label: "3d" },
    { key: "1w", maxMs: WEEK_MS, label: "1w" },
    { key: "2w", maxMs: 14 * DAY_MS, label: "2w" },
    { key: "30d", maxMs: MONTH_MS, label: "30d" },
  ];

  function listingAgeMs(lead) {
    const raw = lead?.posted_at || lead?.found_at;
    if (!raw) return null;
    const t = new Date(raw).getTime();
    if (Number.isNaN(t)) return null;
    return Date.now() - t;
  }

  function listingAgeDays(lead) {
    const ms = listingAgeMs(lead);
    if (ms == null) return null;
    return Math.max(1, Math.floor(ms / DAY_MS));
  }

  /** Recency badge: NEW 1h | NEW 1d | 3d | 1w | 2w | 30d | stale ({n}d old) | null if unknown */
  function recencyInfo(lead) {
    const ms = listingAgeMs(lead);
    if (ms == null) return null;
    if (ms > MONTH_MS) {
      const days = listingAgeDays(lead);
      return {
        key: "stale",
        label: `${days}d old`,
        stale: true,
        title: `Listing is ${days} day${days === 1 ? "" : "s"} old`,
      };
    }
    for (const b of RECENCY_BUCKETS) {
      if (ms <= b.maxMs) {
        return {
          key: b.key,
          label: b.label,
          stale: false,
          isNew: Boolean(b.isNew),
          title: b.isNew
            ? `New — posted within the last ${b.key}`
            : `Posted within the last ${b.label}`,
        };
      }
    }
    return null;
  }

  function compensationLabel(lead) {
    const raw = lead?.compensation;
    if (raw == null || String(raw).trim() === "") {
      return { missing: true, text: "comp missing" };
    }
    return { missing: false, text: String(raw).trim() };
  }

  function formatRecency(raw) {
    if (!raw) return null;
    const s = String(raw).trim().toLowerCase();
    const map = {
      "3h": "Last 3 hours",
      "1h": "Last 1 hour",
      "24h": "Last 24 hours",
      "1d": "Last 1 day",
      "3d": "Last 3 days",
      "2d": "Last 2 days",
      "7d": "Last 7 days",
      "1w": "Last 1 week",
      "2w": "Last 2 weeks",
      "14d": "Last 14 days",
      "30d": "Last 30 days",
      "1m": "Last 30 days",
    };
    if (map[s]) return map[s];
    const m = s.match(/^(\d+)\s*(h|hour|hours|d|day|days|w|week|weeks|m|mo|month|months)$/);
    if (m) {
      const n = Number(m[1]);
      const unit =
        m[2].startsWith("h") ? (n === 1 ? "hour" : "hours") :
        m[2].startsWith("w") ? (n === 1 ? "week" : "weeks") :
        m[2].startsWith("m") ? (n === 1 ? "month" : "months") :
        n === 1 ? "day" : "days";
      return `Last ${n} ${unit}`;
    }
    if (/^last\b/i.test(raw)) return raw;
    return `Last ${raw}`;
  }

  function formatAge(ms) {
    if (ms < 0) ms = 0;
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m`;
    const hr = Math.floor(min / 60);
    const remMin = min % 60;
    if (hr < 48) return remMin ? `${hr}h ${remMin}m` : `${hr}h`;
    const days = Math.floor(hr / 24);
    const remHr = hr % 24;
    return remHr ? `${days}d ${remHr}h` : `${days}d`;
  }

  function isApplied(lead) {
    return leadStatus(lead) === "applied" || Boolean(lead?.applied);
  }

  function leadSources(lead) {
    const fromList = Array.isArray(lead?.sources)
      ? lead.sources
          .map((s) => String(s || "").trim().toLowerCase())
          .filter(Boolean)
      : [];
    const primary = String(lead?.source || "").trim().toLowerCase();
    const seen = new Set();
    const out = [];
    for (const s of [...fromList, primary]) {
      if (!s || seen.has(s)) continue;
      seen.add(s);
      out.push(s);
    }
    return out.length ? out : ["unknown"];
  }

  function isSourceEnabled(id) {
    const key = String(id || "").trim().toLowerCase();
    if (!key || key === "unknown") return true;
    return !state.disabledSources.has(key);
  }

  function leadPassesSourceGate(lead) {
    const sources = leadSources(lead).filter((s) => s && s !== "unknown");
    if (!sources.length) return true;
    // Keep leads that still have at least one enabled discovery source.
    return sources.some((s) => isSourceEnabled(s));
  }

  function applyDisabledSources(disabled) {
    state.disabledSources = new Set(
      (disabled || [])
        .map((s) => String(s || "").trim().toLowerCase())
        .filter(Boolean)
    );
  }

  async function loadSourcesConfig() {
    try {
      const payload = await fetchJson("/api/sources");
      applyDisabledSources(payload.disabled || []);
      return payload;
    } catch {
      /* fall through */
    }
    try {
      const payload = await fetchJson("leads/sources.json");
      applyDisabledSources(payload.disabled || []);
      return {
        ...payload,
        sources: SOURCE_CATALOG.map((item) => ({
          ...item,
          enabled: isSourceEnabled(item.id),
        })),
      };
    } catch {
      applyDisabledSources([]);
      return {
        updated_at: null,
        disabled: [],
        sources: SOURCE_CATALOG.map((item) => ({ ...item, enabled: true })),
      };
    }
  }

  async function persistSources(action, extra = {}) {
    if (state.writeMode === "api") {
      const res = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      const payload = await res.json();
      applyDisabledSources(payload.disabled || []);
      return payload;
    }

    // Static / agent-only fallback: session-only until serve_leads.py can write.
    if (action === "set") {
      const id = String(extra.id || "").trim().toLowerCase();
      if (!id) throw new Error("id required");
      if (extra.enabled) state.disabledSources.delete(id);
      else state.disabledSources.add(id);
    } else if (action === "enable_all") {
      state.disabledSources.clear();
    } else if (action === "disable_all") {
      state.disabledSources = new Set(SOURCE_IDS);
    } else if (action === "set_disabled" || action === "replace") {
      applyDisabledSources(extra.disabled || []);
    }
    if (els.fsNote) {
      els.fsNote.textContent =
        "Source toggles are session-only without the API helper — run python3 scripts/serve_leads.py to persist leads/sources.json.";
      els.fsNote.classList.remove("hidden");
    }
    return {
      disabled: [...state.disabledSources],
      sources: SOURCE_CATALOG.map((item) => ({
        ...item,
        enabled: isSourceEnabled(item.id),
      })),
    };
  }

  function sourceLeadCounts() {
    const counts = new Map();
    for (const lead of state.manifest.leads || []) {
      for (const source of leadSources(lead)) {
        if (!source || source === "unknown") continue;
        counts.set(source, (counts.get(source) || 0) + 1);
      }
    }
    return counts;
  }

  function renderSourcesView() {
    if (!els.sourcesList) return;
    const counts = sourceLeadCounts();
    const enabledCount = SOURCE_CATALOG.filter((s) => isSourceEnabled(s.id)).length;
    if (els.sourcesSummary) {
      els.sourcesSummary.textContent = `${enabledCount} of ${SOURCE_CATALOG.length} sources enabled · ${state.disabledSources.size} disabled`;
    }

    const groups = [];
    const byGroup = new Map();
    for (const item of SOURCE_CATALOG) {
      if (!byGroup.has(item.group)) {
        byGroup.set(item.group, []);
        groups.push(item.group);
      }
      byGroup.get(item.group).push(item);
    }

    els.sourcesList.innerHTML = "";
    for (const group of groups) {
      const section = document.createElement("section");
      section.className = "sources-group";
      section.setAttribute("aria-label", group);
      const heading = document.createElement("h2");
      heading.className = "sources-group-title";
      heading.textContent = group;
      section.appendChild(heading);

      const list = document.createElement("div");
      list.className = "sources-group-list";
      list.setAttribute("role", "list");

      for (const item of byGroup.get(group)) {
        const enabled = isSourceEnabled(item.id);
        const row = document.createElement("label");
        row.className = `sources-row${enabled ? "" : " is-disabled"}`;
        row.setAttribute("role", "listitem");

        const text = document.createElement("span");
        text.className = "sources-row-text";
        const name = document.createElement("span");
        name.className = "sources-row-name";
        name.textContent = item.label;
        const meta = document.createElement("span");
        meta.className = "sources-row-meta muted mono";
        const leadCount = counts.get(item.id) || 0;
        meta.textContent = `${item.id}${leadCount ? ` · ${leadCount} lead${leadCount === 1 ? "" : "s"}` : ""}`;
        text.appendChild(name);
        text.appendChild(meta);

        const toggle = document.createElement("input");
        toggle.type = "checkbox";
        toggle.className = "sources-toggle";
        toggle.checked = enabled;
        toggle.setAttribute("aria-label", `${enabled ? "Disable" : "Enable"} ${item.label}`);
        toggle.addEventListener("change", async () => {
          try {
            await persistSources("set", { id: item.id, enabled: toggle.checked });
            renderSourcesView();
            populateSourceFilter();
            renderList();
          } catch (err) {
            toggle.checked = !toggle.checked;
            alert(`Could not update source: ${err.message || err}`);
          }
        });

        row.appendChild(text);
        row.appendChild(toggle);
        list.appendChild(row);
      }
      section.appendChild(list);
      els.sourcesList.appendChild(section);
    }
  }

  function workMode(lead) {
    const raw = (lead?.work_mode || "").trim().toLowerCase();
    if (WORK_MODE_LABELS[raw]) return raw;
    // Fallback for older manifests without work_mode
    const tags = new Set((lead?.tags || []).map((t) => String(t).toLowerCase()));
    const loc = String(lead?.location || "").toLowerCase();
    if (tags.has("hybrid") || loc.includes("hybrid")) return "hybrid";
    if (
      (tags.has("local-office") || tags.has("onsite")) &&
      /\bonsite|on-site|in[- ]office\b/.test(loc)
    ) {
      return "local-office";
    }
    if (lead?.remote || tags.has("remote") || /\bremote\b/.test(loc)) return "remote";
    if (tags.has("local-office") || /\bonsite|on-site|in[- ]office\b/.test(loc)) {
      return "local-office";
    }    return "other";
  }

  function workModeLabel(mode) {
    return WORK_MODE_LABELS[mode] || WORK_MODE_LABELS.other;
  }

  function companySlug(name) {
    return String(name || "unknown")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-") || "unknown";
  }

  function companyInitials(name) {
    const parts = String(name || "?")
      .trim()
      .split(/[\s._-]+/)
      .filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function companyIconPath(slugOrName, brief = null) {
    const slug = companySlug(slugOrName);
    const entry = state.companyIndex.find((c) => c.slug === slug);
    if (entry?.icon) return entry.icon;
    const iconName =
      (brief && typeof brief.icon === "string" && brief.icon.trim()) ||
      (state.companyBriefs.get(slug) || {})?.icon;
    if (typeof iconName === "string" && iconName.trim()) {
      return iconName.includes("/")
        ? iconName.trim()
        : `companies/${slug}/${iconName.trim()}`;
    }
    return null;
  }

  function buildCompanyIcon(name, { slug = null, icon = null, size = "md" } = {}) {
    const resolvedSlug = slug || companySlug(name);
    const wrap = document.createElement("span");
    wrap.className = `company-icon company-icon-${size}`;
    wrap.setAttribute("aria-hidden", "true");

    const fallback = document.createElement("span");
    fallback.className = "company-icon-fallback";
    fallback.textContent = companyInitials(name);

    const src = icon || companyIconPath(resolvedSlug);
    if (!src) {
      wrap.appendChild(fallback);
      return wrap;
    }

    const img = document.createElement("img");
    img.className = "company-icon-img";
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    img.src = src;
    img.addEventListener("error", () => {
      img.remove();
      if (!wrap.contains(fallback)) wrap.appendChild(fallback);
    });
    wrap.appendChild(img);
    return wrap;
  }

  function companyKey(lead) {
    return String(lead?.company || "Unknown")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function compareLeads(a, b) {
    const ar = a.rank == null ? Number.POSITIVE_INFINITY : a.rank;
    const br = b.rank == null ? Number.POSITIVE_INFINITY : b.rank;
    if (ar !== br) return ar - br;
    return (b.hire_likelihood ?? 0) - (a.hire_likelihood ?? 0);
  }

  function populateSourceFilter() {
    const current = els.filterSource.value || "all";
    const sources = [
      ...new Set(
        (state.manifest.leads || []).flatMap((lead) =>
          leadSources(lead).filter(
            (s) => s && s !== "unknown" && isSourceEnabled(s)
          )
        )
      ),
    ].sort((a, b) => a.localeCompare(b));

    els.filterSource.innerHTML = "";
    const allOpt = document.createElement("option");
    allOpt.value = "all";
    allOpt.textContent = "All";
    els.filterSource.appendChild(allOpt);

    for (const source of sources) {
      const opt = document.createElement("option");
      opt.value = source;
      opt.textContent = source;
      els.filterSource.appendChild(opt);
    }

    els.filterSource.value = sources.includes(current) ? current : "all";
  }

  function populateCompanyFilter() {
    if (!els.filterCompany) return;
    const current = els.filterCompany.value || "all";
    const byKey = new Map();

    for (const lead of state.manifest.leads || []) {
      const key = companyKey(lead);
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, {
          key,
          label: lead.company || "Unknown",
          best: lead,
        });
        continue;
      }
      if (compareLeads(lead, existing.best) < 0) {
        existing.best = lead;
        existing.label = lead.company || existing.label;
      }
    }

    const companies = [...byKey.values()].sort((a, b) =>
      compareLeads(a.best, b.best)
    );

    els.filterCompany.innerHTML = "";
    const allOpt = document.createElement("option");
    allOpt.value = "all";
    allOpt.textContent = "All";
    els.filterCompany.appendChild(allOpt);

    for (const company of companies) {
      const opt = document.createElement("option");
      opt.value = company.key;
      const rank =
        company.best.rank != null ? `#${company.best.rank}` : "unranked";
      opt.textContent = `${company.label} (${rank})`;
      els.filterCompany.appendChild(opt);
    }

    const keys = companies.map((c) => c.key);
    els.filterCompany.value = keys.includes(current) ? current : "all";
  }

  const RECENCY_FILTERS = {
    "1h": { maxMs: 1 * HOUR_MS },
    "3h": { maxMs: 3 * HOUR_MS },
    "1d": { maxMs: 1 * DAY_MS },
    "3d": { maxMs: 3 * DAY_MS },
    "7d": { maxMs: 7 * DAY_MS },
    "14d": { maxMs: 14 * DAY_MS },
    "30d": { maxMs: MONTH_MS },
  };

  function matchesRecencyFilter(lead, recency) {
    if (recency === "all") return true;
    const ageMs = listingAgeMs(lead);
    if (recency === "unknown") return ageMs == null;
    if (ageMs == null) return false;
    if (recency === "older") return ageMs > MONTH_MS;
    const bound = RECENCY_FILTERS[recency];
    return bound ? ageMs <= bound.maxMs : true;
  }

  function filteredLeads() {
    const status = els.filterStatus.value;
    const fraud = els.filterFraud.value;
    const location = els.filterLocation?.value || "all";
    const recency = els.filterRecency?.value || "all";
    const company = els.filterCompany?.value || "all";
    const source = els.filterSource.value;
    const q = els.filterQ.value.trim().toLowerCase();

    const filtered = state.manifest.leads.filter((lead) => {
      if (!leadPassesSourceGate(lead)) return false;
      if (status !== "all" && leadStatus(lead) !== status) return false;
      if (fraud !== "all" && (lead.fraud_flag || "clear") !== fraud) return false;
      if (location !== "all" && workMode(lead) !== location) return false;
      if (!matchesRecencyFilter(lead, recency)) return false;
      if (company !== "all" && companyKey(lead) !== company) return false;
      if (source !== "all" && !leadSources(lead).includes(source)) return false;
      if (q) {
        const hay = `${lead.title} ${lead.company} ${lead.location || ""} ${workModeLabel(workMode(lead))} ${leadSources(lead).join(" ")} ${(lead.tags || []).join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    // Always show hire-likelihood order (#1 first), even if manifest order drifts.
    return filtered.sort(compareLeads);
  }

  function appendBadges(container, lead) {
    const mode = workMode(lead);
    const modeEl = document.createElement("span");
    modeEl.className = `badge work-mode ${mode}`;
    modeEl.textContent = workModeLabel(mode);
    if (lead.location) modeEl.title = lead.location;
    container.appendChild(modeEl);

    const recency = recencyInfo(lead);
    if (recency) {
      const showStale = recency.stale && isProtectedLead(lead);
      if (!recency.stale || showStale) {
        const ageEl = document.createElement("span");
        ageEl.className = `badge recency ${recency.key}${
          recency.isNew ? " new" : ""
        }${showStale ? " stale-warn" : ""}`;
        ageEl.textContent = recency.label;
        ageEl.title = recency.title;
        container.appendChild(ageEl);
      }
    }

    const comp = compensationLabel(lead);
    if (!comp.missing) {
      const compEl = document.createElement("span");
      compEl.className = "badge compensation";
      compEl.textContent = comp.text;
      compEl.title = comp.text;
      container.appendChild(compEl);
    }

    const flag = lead.fraud_flag || "clear";
    if (flag === "caution" || flag === "suspicious") {
      const flagEl = document.createElement("span");
      flagEl.className = `badge ${flag}`;
      flagEl.textContent = flag;
      container.appendChild(flagEl);
    }

    if (isApplied(lead) && leadStatus(lead) !== "applied") {
      const appliedEl = document.createElement("span");
      appliedEl.className = "badge applied";
      const when = formatAppliedDate(lead.applied_at);
      appliedEl.textContent = when ? `applied ${when}` : "applied";
      if (when) appliedEl.title = `Marked applied ${formatWhen(lead.applied_at)}`;
      container.appendChild(appliedEl);
    }

    const nextIv = nextUpcomingInterview(lead);
    if (nextIv) {
      const ivEl = document.createElement("span");
      ivEl.className = "badge interview";
      ivEl.textContent = formatInterviewShort(nextIv);
      ivEl.title = [
        nextIv.label || "Interview",
        formatWhen(nextIv.at),
        nextIv.notes || "",
      ]
        .filter(Boolean)
        .join(" · ");
      container.appendChild(ivEl);
    }

    for (const source of leadSources(lead)) {
      if (!source || source === "unknown") continue;
      const sourceEl = document.createElement("span");
      sourceEl.className = "badge source";
      sourceEl.textContent = source;
      container.appendChild(sourceEl);
    }
  }

  function rankLabel(lead) {
    if (lead.rank != null) return `#${lead.rank} · ${lead.hire_likelihood ?? "—"}`;
    return `score ${lead.hire_likelihood ?? "—"}`;
  }

  function buildKanbanCard(lead) {
    const card = document.createElement("div");
    card.className = "kanban-card";
    card.draggable = true;
    card.dataset.id = lead.id;
    card.setAttribute("role", "listitem");
    if (lead.id === state.selectedId) card.classList.add("is-selected");

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "lead-item";
    btn.setAttribute("aria-selected", String(lead.id === state.selectedId));
    btn.dataset.id = lead.id;
    btn.innerHTML = `
      <div class="row">
        <span class="title"></span>
        <span class="rank-pill"></span>
      </div>
      <div class="company-row">
        <span class="company-icon-slot"></span>
        <span class="company-line"></span>
      </div>
      <div class="badges"></div>
    `;
    btn.querySelector(".title").textContent = lead.title || "Untitled";
    btn.querySelector(".rank-pill").textContent = rankLabel(lead);
    const companyName = lead.company || "Unknown";
    btn.querySelector(".company-line").textContent = companyName;
    btn.querySelector(".company-icon-slot").replaceWith(
      buildCompanyIcon(companyName, { size: "sm" })
    );
    appendBadges(btn.querySelector(".badges"), lead);
    btn.addEventListener("click", () => selectLead(lead.id));

    card.appendChild(btn);
    const docs = buildDocLinks(lead, { className: "doc-links doc-links-list" });
    if (docs.childNodes.length) card.appendChild(docs);

    card.addEventListener("dragstart", (e) => {
      state.dragLeadId = lead.id;
      card.classList.add("is-dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", lead.id);
    });
    card.addEventListener("dragend", () => {
      state.dragLeadId = null;
      card.classList.remove("is-dragging");
      for (const col of els.kanbanBoard?.querySelectorAll(".kanban-column") || []) {
        col.classList.remove("is-drag-over");
      }
    });

    return card;
  }

  function wireKanbanDnd() {
    if (!els.kanbanBoard || els.kanbanBoard.dataset.dndWired === "1") return;
    els.kanbanBoard.dataset.dndWired = "1";

    for (const column of els.kanbanBoard.querySelectorAll(".kanban-column")) {
      const dropZone = column.querySelector(".kanban-cards");
      if (!dropZone) continue;

      const onDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        column.classList.add("is-drag-over");
      };
      const onDragLeave = (e) => {
        if (!column.contains(e.relatedTarget)) {
          column.classList.remove("is-drag-over");
        }
      };
      const onDrop = (e) => {
        e.preventDefault();
        column.classList.remove("is-drag-over");
        const id =
          e.dataTransfer.getData("text/plain") || state.dragLeadId;
        const nextStatus = dropZone.dataset.dropStatus;
        if (!id || !nextStatus) return;
        setLeadStatus(id, nextStatus);
      };

      column.addEventListener("dragover", onDragOver);
      dropZone.addEventListener("dragover", onDragOver);
      column.addEventListener("dragleave", onDragLeave);
      dropZone.addEventListener("drop", onDrop);
      column.addEventListener("drop", onDrop);
    }
  }

  function renderList() {
    const leads = filteredLeads();
    if (!els.kanbanBoard) return;

    wireKanbanDnd();

    for (const lane of STATUS_LANES) {
      const stack = els.kanbanBoard.querySelector(
        `.kanban-cards[data-drop-status="${lane.id}"]`
      );
      const countEl = els.kanbanBoard.querySelector(
        `.kanban-count[data-count-for="${lane.id}"]`
      );
      if (!stack) continue;
      stack.innerHTML = "";
      const laneLeads = leads.filter((lead) => leadStatus(lead) === lane.id);
      if (countEl) countEl.textContent = String(laneLeads.length);
      for (const lead of laneLeads) {
        stack.appendChild(buildKanbanCard(lead));
      }
    }

    if (!leads.length) {
      els.listEmpty.classList.remove("hidden");
      els.kanbanBoard.hidden = true;
    } else {
      els.listEmpty.classList.add("hidden");
      els.kanbanBoard.hidden = false;
    }
  }

  async function loadMeta(id) {
    if (state.metas.has(id)) return state.metas.get(id);
    const entry = state.manifest.leads.find((l) => l.id === id);
    const base = entry?.path || `leads/${id}/`;
    const meta = await fetchJson(`${base}meta.json`);
    state.metas.set(id, meta);
    return meta;
  }

  async function loadCompanyBrief(company) {
    const slug = companySlug(company);
    if (state.companyBriefs.has(slug)) return state.companyBriefs.get(slug);
    try {
      const brief = await fetchJson(`companies/${slug}/brief.json`);
      state.companyBriefs.set(slug, brief);
      return brief;
    } catch {
      state.companyBriefs.set(slug, null);
      return null;
    }
  }

  async function selectLead(id, { history = true } = {}) {
    const entry = state.manifest.leads.find((l) => l.id === id);
    if (!entry) return;
    stopSpeech();
    const same = state.selectedId === id && state.view === "leads";
    state.selectedId = id;
    if (state.view !== "leads") {
      setView("leads", { updateHash: false, fromUser: false });
    }
    renderList();
    if (!state.previewDetached) {
      closePreviewLightbox({ restore: true });
    }
    els.detailEmpty.classList.add("hidden");
    els.detail.classList.remove("hidden");
    els.detail.innerHTML = `<p class="muted">Loading…</p>`;
    if (state.previewDetached) {
      openPreviewLightbox(els.detail, entry?.title || "Lead preview");
    }

    if (history && !same) commitRoute({ push: true });

    try {
      const meta = await loadMeta(id);
      const base = entry?.path || `leads/${id}/`;
      const [posting, speech] = await Promise.all([
        fetchText(`${base}posting.md`),
        fetchText(`${base}speech.txt`),
      ]);
      if (state.selectedId !== id) return;
      renderDetail(meta, posting, base, speech);
      if (state.previewDetached) {
        openPreviewLightbox(els.detail, meta.title || entry?.title || "Lead preview");
      }
    } catch (err) {
      if (state.selectedId !== id) return;
      els.detail.innerHTML = `<p class="muted">Could not load lead: ${escapeHtml(String(err.message || err))}</p>`;
      if (state.previewDetached) {
        openPreviewLightbox(els.detail, entry?.title || "Lead preview");
      }
    }
  }

  function clearLeadSelection({ history = false } = {}) {
    if (!state.selectedId) {
      if (history) commitRoute({ push: true });
      return;
    }
    stopSpeech();
    state.selectedId = null;
    renderList();
    closePreviewLightbox({ restore: true });
    if (els.detail) {
      els.detail.classList.add("hidden");
      els.detail.innerHTML = "";
    }
    els.detailEmpty?.classList.remove("hidden");
    if (history) commitRoute({ push: true });
    else if (!state.applyingRoute) commitRoute({ push: false });
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  let menuCloser = null;

  function closeDetailMenu() {
    if (typeof menuCloser === "function") {
      menuCloser();
      menuCloser = null;
    }
  }

  function wireDetailMenu(root) {
    const toggle = root.querySelector(".menu-toggle");
    const panel = root.querySelector(".menu-panel");
    if (!toggle || !panel) return;

    const setOpen = (open) => {
      toggle.setAttribute("aria-expanded", String(open));
      panel.hidden = !open;
    };

    setOpen(false);

    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const next = toggle.getAttribute("aria-expanded") !== "true";
      if (!next) {
        closeDetailMenu();
        return;
      }

      closeDetailMenu();
      setOpen(true);

      const onDoc = (ev) => {
        if (!root.contains(ev.target)) closeDetailMenu();
      };
      const onKey = (ev) => {
        if (ev.key === "Escape") closeDetailMenu();
      };

      menuCloser = () => {
        setOpen(false);
        document.removeEventListener("click", onDoc);
        document.removeEventListener("keydown", onKey);
        menuCloser = null;
      };

      setTimeout(() => {
        document.addEventListener("click", onDoc);
        document.addEventListener("keydown", onKey);
      }, 0);
    });

    panel.addEventListener("click", (e) => {
      const item = e.target.closest(".menu-item");
      if (!item || item.dataset.skill) return;
      closeDetailMenu();
    });
  }

  function addMenuItem(panel, { label, className, href, onClick }) {
    if (href) {
      const a = makeExternalLink(href, label);
      a.className = `menu-item${className ? ` ${className}` : ""}`;
      a.role = "menuitem";
      panel.appendChild(a);
      return a;
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `menu-item${className ? ` ${className}` : ""}`;
    btn.setAttribute("role", "menuitem");
    btn.textContent = label;
    if (onClick) btn.addEventListener("click", onClick);
    panel.appendChild(btn);
    return btn;
  }

  function addMenuSep(panel) {
    const sep = document.createElement("div");
    sep.className = "menu-sep";
    sep.setAttribute("role", "separator");
    panel.appendChild(sep);
  }

  function openCompanyInResearch(companyName) {
    const slug = companySlug(companyName || "Unknown");
    setView("companies", { updateHash: false, fromUser: true });
    selectCompany(slug, { history: true });
  }

  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      /* fall through */
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }

  function leadFolderPath(meta, path) {
    return leadBasePath({ id: meta?.id, path: path || meta?.path });
  }

  function skillCommand(skill, folderPath, extraArgs = "") {
    const base = `/${skill} ${folderPath}`;
    const extra = String(extraArgs || "").trim();
    return extra ? `${base} ${extra}` : base;
  }

  function wireSkillCopyControls(root, folderPath, { onCopied } = {}) {
    for (const btn of root.querySelectorAll("[data-skill]")) {
      const label = btn.dataset.label || btn.textContent.trim();
      const skill = btn.getAttribute("data-skill");
      if (!skill) continue;
      const args = btn.getAttribute("data-skill-args") || "";
      btn.dataset.label = label;
      btn.textContent = label;
      btn.title = skillCommand(skill, folderPath, args);
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const cmd = skillCommand(skill, folderPath, args);
        const ok = await copyToClipboard(cmd);
        if (ok) {
          btn.textContent = "Copied!";
          setTimeout(() => {
            btn.textContent = label;
            onCopied?.();
          }, 900);
        } else {
          onCopied?.();
          window.prompt("Copy this skill command:", cmd);
        }
      });
    }
  }

  function wireSkillCopyMenuItems(root, folderPath) {
    wireSkillCopyControls(root, folderPath, { onCopied: closeDetailMenu });
  }

  function collectInterviewsFromEditor(root) {
    const rows = [...root.querySelectorAll(".interview-row")];
    const out = [];
    for (const row of rows) {
      const atLocal = row.querySelector('[data-field="at"]')?.value || "";
      const at = fromDatetimeLocalValue(atLocal);
      if (!at) continue;
      out.push({
        id: row.dataset.id || newInterviewId(),
        at,
        label: (row.querySelector('[data-field="label"]')?.value || "").trim(),
        notes: (row.querySelector('[data-field="notes"]')?.value || "").trim(),
      });
    }
    return out;
  }

  function buildInterviewRow(iv = {}) {
    const row = document.createElement("div");
    row.className = "interview-row";
    row.dataset.id = iv.id || newInterviewId();

    const at = document.createElement("input");
    at.type = "datetime-local";
    at.dataset.field = "at";
    at.value = toDatetimeLocalValue(iv.at) || toDatetimeLocalValue(new Date().toISOString());
    at.setAttribute("aria-label", "Interview date and time");

    const label = document.createElement("input");
    label.type = "text";
    label.dataset.field = "label";
    label.placeholder = "Label (e.g. HM screen)";
    label.value = iv.label || "";
    label.setAttribute("aria-label", "Interview label");

    const notes = document.createElement("textarea");
    notes.dataset.field = "notes";
    notes.placeholder = "Notes";
    notes.rows = 2;
    notes.value = iv.notes || "";
    notes.setAttribute("aria-label", "Interview notes");

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "btn ghost interview-remove";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      row.remove();
    });

    const top = document.createElement("div");
    top.className = "interview-row-top";
    top.appendChild(at);
    top.appendChild(label);
    top.appendChild(remove);

    row.appendChild(top);
    row.appendChild(notes);
    return row;
  }

  function wireInterviewsEditor(root, meta) {
    const block = root.querySelector(".block-interviews");
    if (!block) return;
    const list = block.querySelector(".interviews-list");
    const actions = block.querySelector(".interviews-actions");
    const interviews = sortInterviews(leadInterviews(meta));
    const show =
      leadStatus(meta) === "interview" || interviews.length > 0;
    block.hidden = !show;
    if (!show) return;

    list.replaceChildren();
    actions.replaceChildren();

    if (!interviews.length) {
      const empty = document.createElement("p");
      empty.className = "muted interview-empty";
      empty.textContent = "No interviews scheduled yet.";
      list.appendChild(empty);
    } else {
      for (const iv of interviews) {
        list.appendChild(buildInterviewRow(iv));
      }
    }

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "btn ghost";
    addBtn.textContent = "Add interview";
    addBtn.addEventListener("click", () => {
      list.querySelector(".interview-empty")?.remove();
      list.appendChild(buildInterviewRow({}));
    });

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "btn";
    saveBtn.textContent = "Save interviews";
    saveBtn.addEventListener("click", async () => {
      const payload = collectInterviewsFromEditor(block);
      saveBtn.disabled = true;
      try {
        await saveLeadInterviews(meta.id, payload);
      } finally {
        saveBtn.disabled = false;
      }
    });

    actions.appendChild(addBtn);
    actions.appendChild(saveBtn);
  }

  async function saveLeadInterviews(id, interviews) {
    if (state.writeMode !== "api") {
      agentHint("Save interviews", id);
      return;
    }
    await apiMutation({
      action: "set_interviews",
      id,
      interviews,
    });
    await reload();
    if (state.selectedId === id) selectLead(id, { history: false });
  }

  function renderDetail(meta, posting, path, speechText = "") {
    const status = leadStatus(meta);
    const applied = isApplied(meta);
    const notes = Array.isArray(meta.fraud_notes) ? meta.fraud_notes : [];
    const tags = Array.isArray(meta.tags) ? meta.tags : [];
    const mode = workMode(meta);
    const folderPath = leadFolderPath(meta, path);
    const companyName = meta.company || "Unknown";
    const speech = String(speechText || "").trim();
    const hasSpeech = Boolean(speech);
    const manifestLead =
      state.manifest.leads.find((l) => l.id === meta.id) || meta;
    const docsLead = {
      ...manifestLead,
      ...meta,
      path: folderPath,
      has_resume: Boolean(manifestLead.has_resume ?? meta.has_resume),
      has_cover_letter: Boolean(
        manifestLead.has_cover_letter ?? meta.has_cover_letter
      ),
    };

    stopSpeech();
    closeDetailMenu();

    els.detail.innerHTML = `
      <header class="detail-header">
        <div class="detail-heading">
          <div class="detail-title-row">
            <span class="company-icon-slot"></span>
            <div class="detail-title-text">
              <h2></h2>
              <p class="sub"></p>
            </div>
          </div>
        </div>
        <div class="detail-header-actions">
          <div class="detail-menu">
            <button type="button" class="menu-toggle" aria-label="Lead actions" aria-haspopup="menu" aria-expanded="false" aria-controls="lead-actions-menu">
              <span class="bar" aria-hidden="true"></span>
              <span class="bar" aria-hidden="true"></span>
              <span class="bar" aria-hidden="true"></span>
            </button>
            <div class="menu-panel" id="lead-actions-menu" role="menu" hidden></div>
          </div>
        </div>
      </header>
      <div class="speech-slot"></div>
      <div class="block block-company">
        <a href="#companies" class="company-research-link"></a>
      </div>
      <div class="score-row">
        <span class="score"></span>
        <span class="detail-docs"></span>
        <span class="detail-badges"></span>
      </div>
      <div class="block block-fit">
        <h3>Why it fits</h3>
        <p class="fit"></p>
      </div>
      <div class="block block-gaps">
        <h3>Missing gaps</h3>
        <div class="gaps"></div>
      </div>
      <div class="block block-facts meta-grid">
        <h3>Facts</h3>
        <ul class="facts"></ul>
      </div>
      <div class="block block-interviews interviews-block" hidden>
        <h3>Interviews</h3>
        <div class="interviews-list"></div>
        <div class="interviews-actions"></div>
      </div>
      <div class="block block-fraud fraud-block">
        <h3>Fact check</h3>
        <div class="fraud-body"></div>
      </div>
      <div class="block block-notes">
        <h3>Notes</h3>
        <div class="posting md-body"></div>
      </div>
    `;

    const speechSlot = els.detail.querySelector(".speech-slot");
    speechSlot.replaceWith(buildSpeechControls({ hasSpeech }));
    wireSpeechControls(els.detail, {
      text: speech,
      sourceKey: `lead:${meta.id}`,
      hasSpeech,
    });

    els.detail.querySelector("h2").textContent = meta.title || "Untitled";
    els.detail.querySelector(".sub").textContent = [
      companyName,
      meta.location,
      workModeLabel(mode),
    ]
      .filter(Boolean)
      .join(" · ");

    const iconSlot = els.detail.querySelector(".company-icon-slot");
    iconSlot.replaceWith(
      buildCompanyIcon(companyName, {
        slug: companySlug(companyName),
        size: "lg",
      })
    );

    const companyLink = els.detail.querySelector(".company-research-link");
    companyLink.replaceChildren();
    companyLink.appendChild(
      buildCompanyIcon(companyName, {
        slug: companySlug(companyName),
        size: "sm",
      })
    );
    const companyLinkLabel = document.createElement("span");
    companyLinkLabel.textContent = `Open in Company Research · ${companyName}`;
    companyLink.appendChild(companyLinkLabel);
    companyLink.addEventListener("click", (e) => {
      e.preventDefault();
      openCompanyInResearch(companyName);
    });

    els.detail.querySelector(".score").textContent =
      meta.hire_likelihood != null
        ? `${meta.rank != null ? `#${meta.rank} · ` : ""}${meta.hire_likelihood}/100 hire likelihood`
        : "Unscored";

    const detailDocs = els.detail.querySelector(".detail-docs");
    detailDocs.appendChild(
      buildDocLinks(docsLead, { className: "doc-links doc-links-detail" })
    );

    const detailBadges = els.detail.querySelector(".detail-badges");
    appendBadges(detailBadges, meta);
    const statusEl = document.createElement("span");
    statusEl.className = `badge ${
      status === "dead"
        ? "dead"
        : status === "in_progress"
          ? "in-progress"
          : status === "interview"
            ? "interview"
            : status === "applied"
              ? "applied"
              : ""
    }`.trim();
    statusEl.textContent = STATUS_LABELS[status] || status;
    detailBadges.appendChild(statusEl);
    const bucketEl = document.createElement("span");
    bucketEl.className = "badge";
    bucketEl.textContent = meta.target_bucket || "similar";
    detailBadges.appendChild(bucketEl);

    els.detail.querySelector(".fit").textContent =
      meta.fit_summary || "No fit summary.";

    const gapsEl = els.detail.querySelector(".gaps");
    const gaps = Array.isArray(meta.missing_gaps)
      ? meta.missing_gaps.filter((g) => typeof g === "string" && g.trim())
      : [];
    if (!gaps.length) {
      gapsEl.textContent = "None noted.";
    } else {
      const ul = document.createElement("ul");
      for (const g of gaps) {
        const li = document.createElement("li");
        li.textContent = g;
        ul.appendChild(li);
      }
      gapsEl.appendChild(ul);
    }

    const facts = els.detail.querySelector(".facts");
    const comp = compensationLabel(meta);
    const recency = recencyInfo(meta);
    const factRows = [
      ["Posted", formatWhen(meta.posted_at)],
      ["Found", formatWhen(meta.found_at)],
      ["Recency", recency ? recency.title || recency.label : "—"],
      ["Compensation", comp.missing ? "—" : comp.text],
      ["Location", meta.location || "—"],
      ["Work mode", workModeLabel(mode)],
      ["Applied", applied ? (meta.applied_at ? formatWhen(meta.applied_at) : "Yes (date unknown)") : "Not yet"],
      ["Sources", leadSources(meta).filter((s) => s !== "unknown").join(", ") || meta.source || "—"],
      ["URL", meta.url || "—"],
      ["Tags", tags.length ? tags.join(", ") : "—"],
      ["Dead reason", meta.dead_reason || "—"],
    ];
    for (const [k, v] of factRows) {
      if (v == null) continue;
      const li = document.createElement("li");
      if (k === "URL" && meta.url) {
        li.innerHTML = `<strong>${k}:</strong> `;
        li.appendChild(makeExternalLink(meta.url, meta.url));
      } else {
        li.innerHTML = `<strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}`;
      }
      facts.appendChild(li);
    }

    wireInterviewsEditor(els.detail, meta);

    const fraudBody = els.detail.querySelector(".fraud-body");
    if (!notes.length) {
      fraudBody.textContent = "No issues noted.";
    } else {
      const ul = document.createElement("ul");
      for (const n of notes) {
        const li = document.createElement("li");
        li.textContent = n;
        ul.appendChild(li);
      }
      fraudBody.appendChild(ul);
    }

    const postingEl = els.detail.querySelector(".posting");
    if (typeof window.renderMarkdown === "function") {
      postingEl.innerHTML = window.renderMarkdown(posting || "");
    } else {
      postingEl.textContent = posting || "(No posting.md)";
    }

    const panel = els.detail.querySelector(".menu-panel");
    addMenuItem(panel, {
      label: "Close",
      onClick: () => clearLeadSelection({ history: true }),
    });
    addMenuSep(panel);
    if (meta.url) {
      addMenuItem(panel, { label: "Open posting", href: meta.url });
      addMenuSep(panel);
    }
    if (docsLead.has_resume) {
      addMenuItem(panel, {
        label: "Open resume PDF",
        href: `${folderPath}resume.pdf`,
      });
    }
    if (docsLead.has_cover_letter) {
      addMenuItem(panel, {
        label: "Open cover letter",
        href: `${folderPath}cover-letter.txt`,
      });
    }
    if (docsLead.has_resume || docsLead.has_cover_letter) {
      addMenuSep(panel);
    }
    const resumeItem = addMenuItem(panel, {
      label: "Copy generate resume",
      onClick: null,
    });
    resumeItem.dataset.skill = "job-generate-resume";
    resumeItem.title = skillCommand("job-generate-resume", folderPath);
    const coverItem = addMenuItem(panel, {
      label: "Copy generate cover letter",
      onClick: null,
    });
    coverItem.dataset.skill = "job-generate-cover-letter";
    coverItem.title = skillCommand("job-generate-cover-letter", folderPath);
    addMenuSep(panel);
    for (const lane of STATUS_LANES) {
      const isCurrent = status === lane.id;
      const item = addMenuItem(panel, {
        label: isCurrent ? `Status · ${lane.label}` : `Move to ${lane.label}`,
        className: isCurrent ? "current-status" : "",
        onClick: isCurrent ? null : () => setLeadStatus(meta.id, lane.id),
      });
      if (isCurrent) item.disabled = true;
    }
    addMenuSep(panel);
    addMenuItem(panel, {
      label: "Mark dead",
      className: "danger",
      onClick: () => confirmMarkDead(meta.id, meta.title),
    });

    wireDetailMenu(els.detail.querySelector(".detail-menu"));
    wireSkillCopyMenuItems(panel, folderPath);
  }

  function confirmDialog({ title, body, confirmLabel, danger }) {
    return new Promise((resolve) => {
      els.dialogTitle.textContent = title;
      els.dialogBody.textContent = body;
      els.dialogConfirm.textContent = confirmLabel || "Confirm";
      els.dialogConfirm.className = danger ? "btn danger" : "btn";
      const onClose = () => {
        els.dialog.removeEventListener("close", onClose);
        resolve(els.dialog.returnValue === "confirm");
      };
      els.dialog.addEventListener("close", onClose);
      els.dialog.showModal();
    });
  }

  async function apiMutation(payload) {
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || res.statusText);
    }
    return res.json();
  }

  function agentHint(action, id) {
    alert(
      `This viewer is read-only without the API helper.\n\nAsk the agent (job-search skill):\n"${action} lead ${id}"\n\nOr run: python3 scripts/serve_leads.py`
    );
  }

  async function setLeadStatus(id, nextStatus) {
    const lead = state.manifest.leads.find((l) => l.id === id);
    const current = leadStatus(lead || state.metas.get(id));
    if (!STATUS_LABELS[nextStatus] || current === nextStatus) return;

    let deadReason = null;
    if (nextStatus === "dead") {
      const ok = await confirmDialog({
        title: "Mark dead?",
        body: "The lead stays on disk and moves to the Dead swim lane.",
        confirmLabel: "Mark dead",
        danger: false,
      });
      if (!ok) return;
      deadReason = window.prompt("Optional reason:", "") || null;
    }

    if (state.writeMode !== "api") {
      agentHint(`Set status to ${nextStatus}`, id);
      return;
    }

    await apiMutation({
      action: "set_status",
      id,
      status: nextStatus,
      dead_reason: deadReason,
    });
    await reload();
    if (state.selectedId === id) selectLead(id, { history: false });
  }

  async function confirmMarkDead(id, title) {
    const ok = await confirmDialog({
      title: "Mark lead dead?",
      body: `Move “${title || id}” to Dead. The lead folder is kept so you can revive it later.`,
      confirmLabel: "Mark dead",
      danger: true,
    });
    if (!ok) return;

    if (state.writeMode !== "api") {
      agentHint("Mark dead", id);
      return;
    }

    await apiMutation({
      action: "mark_dead",
      id,
      dead_reason: "Marked dead via UI (folders are never deleted)",
    });
    if (state.selectedId === id) selectLead(id, { history: false });
    closePreviewLightbox({ restore: true });
    await reload();
  }

  async function reload() {
    state.metas.clear();
    state.companyBriefs.clear();
    try {
      state.manifest = await fetchJson("leads/index.json");
    } catch (err) {
      state.manifest = { updated_at: null, leads: [] };
      console.error(err);
    }

    await loadSourcesConfig();
    normalizeLeadDocFlags();
    populateCompanyFilter();
    populateSourceFilter();
    await refreshCompanyIndex();

    renderList();
    renderCompanyList();
    if (state.view === "sources") renderSourcesView();
    // Selection restore comes from the URL route (boot / back-forward), not reload.
    if (!state.applyingRoute) {
      if (
        state.view === "leads" &&
        state.selectedId &&
        state.manifest.leads.some((l) => l.id === state.selectedId)
      ) {
        await selectLead(state.selectedId, { history: false });
      } else if (state.view === "companies" && state.selectedCompanySlug) {
        await selectCompany(state.selectedCompanySlug, { history: false });
      } else {
        commitRoute({ push: false });
      }
    }
  }

  function resetFilters() {
    els.filterStatus.value = "all";
    els.filterFraud.value = "all";
    if (els.filterLocation) els.filterLocation.value = "all";
    if (els.filterRecency) els.filterRecency.value = "all";
    if (els.filterCompany) els.filterCompany.value = "all";
    els.filterSource.value = "all";
    els.filterQ.value = "";
    renderList();
  }

  const VIEW_META = {
    profile: { title: "Profile", documentTitle: "Profile · Job Research" },
    leads: { title: "Leads board", documentTitle: "Leads board · Job Research" },
    companies: {
      title: "Company Research",
      documentTitle: "Company Research · Job Research",
    },
    sources: { title: "Sources", documentTitle: "Sources · Job Research" },
    settings: { title: "Settings", documentTitle: "Settings · Job Research" },
  };
  const KNOWN_VIEWS = new Set(Object.keys(VIEW_META));

  function normalizeView(view) {
    return KNOWN_VIEWS.has(view) ? view : "leads";
  }

  function setView(view, { updateHash = true, fromUser = false } = {}) {
    const next = normalizeView(view);
    const changed = state.view !== next;
    if (changed) stopSpeech();
    state.view = next;

    const panels = {
      profile: els.viewProfile,
      leads: els.viewLeads,
      companies: els.viewCompanies,
      sources: els.viewSources,
      settings: els.viewSettings,
    };
    for (const [name, panel] of Object.entries(panels)) {
      if (!panel) continue;
      const show = name === next;
      panel.classList.toggle("hidden", !show);
      panel.hidden = !show;
    }

    if (els.btnPreviewMode) {
      els.btnPreviewMode.hidden = next !== "leads";
    }

    const meta = VIEW_META[next];
    if (els.viewTitle) els.viewTitle.textContent = meta.title;
    document.title = meta.documentTitle;

    for (const link of document.querySelectorAll("[data-view]")) {
      link.classList.toggle("is-active", link.dataset.view === next);
    }

    if (updateHash && (changed || fromUser)) {
      commitRoute({ push: fromUser });
    }

    // On narrow screens, close the drawer after navigating.
    if (fromUser && window.matchMedia("(max-width: 960px)").matches) {
      setNavOpen(false);
    }
    if (next === "sources") {
      closePreviewLightbox({ restore: true });
      renderSourcesView();
    } else if (next === "profile" || next === "settings") {
      closePreviewLightbox({ restore: true });
    } else {
      syncPreviewPresentation();
    }
  }

  function currentRoute() {
    return {
      view: state.view,
      leadId: state.view === "leads" ? state.selectedId : null,
      companySlug: state.view === "companies" ? state.selectedCompanySlug : null,
    };
  }

  function routeToHash(route) {
    const view = normalizeView(route?.view);
    if (view === "profile") return "#profile";
    if (view === "settings") return "#settings";
    if (view === "sources") return "#sources";
    if (view === "companies") {
      return route.companySlug
        ? `#companies/${encodeURIComponent(route.companySlug)}`
        : "#companies";
    }
    return route.leadId
      ? `#leads/${encodeURIComponent(route.leadId)}`
      : "#leads";
  }

  function parseHash(hash) {
    const raw = String(hash || "#leads").replace(/^#/, "").trim();
    if (!raw) return { view: "leads", leadId: null, companySlug: null };
    const slash = raw.indexOf("/");
    const head = (slash === -1 ? raw : raw.slice(0, slash)).toLowerCase();
    const rest = slash === -1 ? "" : raw.slice(slash + 1);
    let id = null;
    if (rest) {
      try {
        id = decodeURIComponent(rest);
      } catch {
        id = rest;
      }
    }
    if (head === "profile" || head === "settings" || head === "sources") {
      return { view: head, leadId: null, companySlug: null };
    }
    if (head === "companies") {
      return { view: "companies", leadId: null, companySlug: id || null };
    }
    // `#leads/<id>` or legacy bare `#leads`
    if (head === "leads") {
      return { view: "leads", leadId: id || null, companySlug: null };
    }
    return { view: "leads", leadId: null, companySlug: null };
  }

  function viewFromHash() {
    return parseHash(location.hash).view;
  }

  function commitRoute({ push = false } = {}) {
    if (state.applyingRoute) return;
    const hash = routeToHash(currentRoute());
    if ((location.hash || "#leads") === hash) return;
    if (push) history.pushState({ route: currentRoute() }, "", hash);
    else history.replaceState({ route: currentRoute() }, "", hash);
  }

  async function applyRouteFromLocation() {
    if (state.applyingRoute) return;
    const route = parseHash(location.hash);
    state.applyingRoute = true;
    try {
      setView(route.view, { updateHash: false, fromUser: false });

      if (route.view === "leads") {
        if (
          route.leadId &&
          state.manifest.leads.some((l) => l.id === route.leadId)
        ) {
          if (state.selectedId !== route.leadId) {
            await selectLead(route.leadId, { history: false });
          }
        } else if (state.selectedId) {
          clearLeadSelection({ history: false });
        }
      } else if (route.view === "companies") {
        if (route.companySlug) {
          if (state.selectedCompanySlug !== route.companySlug) {
            await selectCompany(route.companySlug, { history: false });
          }
        } else if (state.selectedCompanySlug) {
          clearCompanySelection({ history: false });
        }
      }
    } finally {
      state.applyingRoute = false;
    }
  }

  async function refreshCompanyIndex() {
    const bySlug = new Map();

    for (const lead of state.manifest.leads || []) {
      const name = lead.company || "Unknown";
      const slug = companySlug(name);
      const existing = bySlug.get(slug);
      if (!existing) {
        bySlug.set(slug, {
          slug,
          company: name,
          leadCount: 1,
          hasBrief: null,
          hasSpeech: null,
          updated_at: null,
          icon: null,
          domain: null,
        });
      } else {
        existing.leadCount += 1;
        if (!existing.company || existing.company === "Unknown") {
          existing.company = name;
        }
      }
    }

    try {
      const payload = await fetchJson("/api/companies");
      for (const item of payload.companies || []) {
        const slug = item.slug || companySlug(item.company);
        const existing = bySlug.get(slug) || {
          slug,
          company: item.company || slug,
          leadCount: 0,
          hasBrief: true,
          hasSpeech: null,
          updated_at: item.updated_at || null,
          icon: null,
          domain: null,
        };
        existing.hasBrief = true;
        if (typeof item.has_speech === "boolean") {
          existing.hasSpeech = item.has_speech;
        }
        existing.updated_at = item.updated_at || existing.updated_at;
        existing.company = item.company || existing.company;
        existing.icon = item.icon || existing.icon;
        existing.domain = item.domain || existing.domain;
        bySlug.set(slug, existing);
      }
    } catch {
      /* static server — probe from leads below */
    }

    const entries = [...bySlug.values()].sort((a, b) =>
      String(a.company).localeCompare(String(b.company))
    );

    await Promise.all(
      entries.map(async (entry) => {
        if (entry.hasBrief !== true) {
          const exists = await fileExists(`companies/${entry.slug}/brief.json`);
          entry.hasBrief = exists;
        }
        if (entry.icon || !entry.hasBrief) return;
        for (const name of COMPANY_ICON_FILES) {
          const path = `companies/${entry.slug}/${name}`;
          if (await fileExists(path)) {
            entry.icon = path;
            break;
          }
        }
      })
    );

    state.companyIndex = entries;
  }

  function filteredCompanies() {
    const brief = els.filterCompanyBrief?.value || "all";
    const q = (els.filterCompanyQ?.value || "").trim().toLowerCase();
    return state.companyIndex.filter((entry) => {
      if (brief === "yes" && !entry.hasBrief) return false;
      if (brief === "no" && entry.hasBrief) return false;
      if (q && !String(entry.company || "").toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }

  function renderCompanyList() {
    if (!els.companyList) return;
    const companies = filteredCompanies();
    els.companyList.innerHTML = "";

    if (!companies.length) {
      els.companyListEmpty?.classList.remove("hidden");
    } else {
      els.companyListEmpty?.classList.add("hidden");
    }

    for (const entry of companies) {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "company-research-item";
      btn.setAttribute(
        "aria-selected",
        String(entry.slug === state.selectedCompanySlug)
      );
      btn.dataset.slug = entry.slug;
      btn.innerHTML = `
        <span class="company-icon-slot"></span>
        <span class="company-research-copy">
          <span class="name"></span>
          <span class="meta"></span>
        </span>
      `;
      btn.querySelector(".company-icon-slot").replaceWith(
        buildCompanyIcon(entry.company || entry.slug, {
          slug: entry.slug,
          icon: entry.icon,
          size: "md",
        })
      );
      btn.querySelector(".name").textContent = entry.company || entry.slug;
      const meta = btn.querySelector(".meta");
      const briefBadge = document.createElement("span");
      briefBadge.className = `badge ${entry.hasBrief ? "clear" : "caution"}`;
      briefBadge.textContent = entry.hasBrief ? "brief" : "no brief";
      meta.appendChild(briefBadge);
      if (entry.leadCount) {
        const count = document.createElement("span");
        count.className = "badge";
        count.textContent = `${entry.leadCount} lead${entry.leadCount === 1 ? "" : "s"}`;
        meta.appendChild(count);
      }
      if (entry.updated_at) {
        const updated = document.createElement("span");
        updated.className = "badge";
        updated.textContent = formatWhen(entry.updated_at);
        meta.appendChild(updated);
      }
      btn.addEventListener("click", () => selectCompany(entry.slug, { history: true }));
      li.appendChild(btn);
      els.companyList.appendChild(li);
    }
  }

  function companyBriefToMarkdown(brief, companyName) {
    if (!brief) {
      const slug = companySlug(companyName);
      return `# ${companyName || "Company"}\n\nNo brief yet. Expected at \`companies/${slug}/brief.json\`.`;
    }
    const lines = [`# ${brief.company || companyName || "Company"}`, ""];
    const sections = [
      ["Products", brief.products],
      ["Fiscal outlook", brief.fiscal_outlook],
      ["Hiring trends", brief.hiring_trends],
      ["Similar-role hires", brief.similar_role_hires],
      ["Hiring profile", brief.hiring_profile],
    ];
    for (const [label, text] of sections) {
      if (!text || !String(text).trim()) continue;
      lines.push(`## ${label}`, "", String(text).trim(), "");
    }
    if (Array.isArray(brief.sources) && brief.sources.length) {
      lines.push("## Sources", "");
      for (const src of brief.sources) {
        lines.push(`- ${src}`);
      }
      lines.push("");
    }
    if (brief.updated_at) {
      lines.push(`_Updated ${formatWhen(brief.updated_at)}_`);
    }
    return lines.join("\n");
  }

  function companyBriefToSpeech(brief, companyName) {
    if (!brief) return "";
    const name = brief.company || companyName || "This company";
    const parts = [`Here's a quick briefing on ${name}.`];
    const sections = [
      ["Products", brief.products],
      ["Fiscal outlook", brief.fiscal_outlook],
      ["Hiring trends", brief.hiring_trends],
      ["Similar-role hires", brief.similar_role_hires],
      ["Hiring profile", brief.hiring_profile],
    ];
    for (const [label, text] of sections) {
      const raw = String(text || "").trim();
      if (!raw) continue;
      const plain = raw
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/[`*_#>]+/g, "")
        .replace(/\s+/g, " ")
        .trim();
      if (!plain) continue;
      parts.push(`${label}. ${plain}`);
    }
    return parts.join(" ").replace(/\s+/g, " ").trim();
  }

  function clearCompanySelection({ history = false } = {}) {
    if (!state.selectedCompanySlug) {
      if (history) commitRoute({ push: true });
      return;
    }
    stopSpeech();
    state.selectedCompanySlug = null;
    renderCompanyList();
    if (els.companyDetail) {
      els.companyDetail.classList.add("hidden");
      els.companyDetail.innerHTML = "";
    }
    els.companyDetailEmpty?.classList.remove("hidden");
    if (history) commitRoute({ push: true });
    else if (!state.applyingRoute) commitRoute({ push: false });
  }

  async function selectCompany(slug, { history = true } = {}) {
    const entry =
      state.companyIndex.find((c) => c.slug === slug) ||
      { slug, company: slug, hasBrief: false };
    stopSpeech();
    const same =
      state.selectedCompanySlug === slug && state.view === "companies";
    state.selectedCompanySlug = slug;
    if (state.view !== "companies") {
      setView("companies", { updateHash: false, fromUser: false });
    }
    renderCompanyList();

    if (history && !same) commitRoute({ push: true });

    if (!els.companyDetail || !els.companyDetailEmpty) return;
    closePreviewLightbox({ restore: true });
    if (
      els.companyDetail &&
      els.companyDetailPane &&
      els.companyDetail.parentElement !== els.companyDetailPane
    ) {
      els.companyDetailPane.appendChild(els.companyDetail);
    }
    els.companyDetailEmpty.classList.add("hidden");
    els.companyDetail.classList.remove("hidden");
    els.companyDetail.innerHTML = `<p class="muted">Loading…</p>`;

    const shouldLoadSpeech = entry.hasSpeech !== false;
    const [brief, speechRaw] = await Promise.all([
      loadCompanyBrief(entry.company || slug),
      shouldLoadSpeech
        ? fetchText(`companies/${slug}/speech.txt`)
        : Promise.resolve(""),
    ]);
    if (state.selectedCompanySlug !== slug) return;
    const speechFromFile = String(speechRaw || "").trim();
    const speech =
      speechFromFile || companyBriefToSpeech(brief, entry.company || slug);
    const hasSpeech = Boolean(speech);
    if (entry.hasSpeech == null) entry.hasSpeech = Boolean(speechFromFile);
    const md = companyBriefToMarkdown(brief, entry.company || slug);
    stopSpeech();
    els.companyDetail.innerHTML = `
      <header class="detail-header">
        <div class="detail-heading">
          <div class="detail-title-row">
            <span class="company-icon-slot"></span>
            <div class="detail-title-text">
              <h2></h2>
              <p class="sub muted mono"></p>
            </div>
          </div>
        </div>
        <div class="company-detail-actions">
          <button
            type="button"
            class="btn ghost small"
            data-skill="job-company-detail"
            data-label="Update research"
          >
            Update research
          </button>
          <button
            type="button"
            class="btn ghost small"
            data-skill="job-company-detail"
            data-skill-args="more"
            data-label="Go deeper"
          >
            Go deeper
          </button>
        </div>
      </header>
      <div class="speech-slot"></div>
      <div class="block block-notes">
        <div class="company-brief-md md-body"></div>
      </div>
    `;
    const title = brief?.company || entry.company || slug;
    const companyPath = `companies/${slug}/`;
    els.companyDetail.querySelector("h2").textContent = title;
    els.companyDetail.querySelector(".sub").textContent = `${companyPath}brief.json`;
    const iconSrc =
      (typeof brief?.icon === "string" && brief.icon.trim()
        ? brief.icon.includes("/")
          ? brief.icon.trim()
          : `${companyPath}${brief.icon.trim()}`
        : null) || entry.icon;
    els.companyDetail.querySelector(".company-icon-slot").replaceWith(
      buildCompanyIcon(title, { slug, icon: iconSrc, size: "lg" })
    );
    const speechSlot = els.companyDetail.querySelector(".speech-slot");
    speechSlot.replaceWith(buildSpeechControls({ hasSpeech }));
    wireSpeechControls(els.companyDetail, {
      text: speech,
      sourceKey: `company:${slug}`,
      hasSpeech,
    });
    wireSkillCopyControls(els.companyDetail, companyPath);
    const body = els.companyDetail.querySelector(".company-brief-md");
    body.innerHTML = renderMarkdownHtml(
      md,
      "No company brief available."
    );
  }

  function resetCompanyFilters() {
    if (els.filterCompanyBrief) els.filterCompanyBrief.value = "all";
    if (els.filterCompanyQ) els.filterCompanyQ.value = "";
    renderCompanyList();
  }

  if (els.btnSourcesEnableAll) {
    els.btnSourcesEnableAll.addEventListener("click", async () => {
      try {
        await persistSources("enable_all");
        renderSourcesView();
        populateSourceFilter();
        renderList();
      } catch (err) {
        alert(`Could not enable sources: ${err.message || err}`);
      }
    });
  }
  if (els.btnSourcesDisableAll) {
    els.btnSourcesDisableAll.addEventListener("click", async () => {
      try {
        await persistSources("disable_all");
        renderSourcesView();
        populateSourceFilter();
        renderList();
      } catch (err) {
        alert(`Could not disable sources: ${err.message || err}`);
      }
    });
  }
  if (els.btnSourcesRefresh) {
    els.btnSourcesRefresh.addEventListener("click", () => reload());
  }

  els.filterStatus.addEventListener("change", renderList);
  els.filterFraud.addEventListener("change", renderList);
  if (els.filterLocation) els.filterLocation.addEventListener("change", renderList);
  if (els.filterRecency) els.filterRecency.addEventListener("change", renderList);
  if (els.filterCompany) els.filterCompany.addEventListener("change", renderList);
  els.filterSource.addEventListener("change", renderList);
  els.filterQ.addEventListener("input", renderList);
  if (els.btnReset) els.btnReset.addEventListener("click", resetFilters);
  els.btnRefresh.addEventListener("click", () => reload());
  if (els.btnTheme) {
    applyTheme(state.theme);
    els.btnTheme.addEventListener("click", toggleTheme);
  }

  if (els.filterCompanyBrief) {
    els.filterCompanyBrief.addEventListener("change", renderCompanyList);
  }
  if (els.filterCompanyQ) {
    els.filterCompanyQ.addEventListener("input", renderCompanyList);
  }
  if (els.btnCompanyReset) {
    els.btnCompanyReset.addEventListener("click", resetCompanyFilters);
  }
  if (els.btnCompanyRefresh) {
    els.btnCompanyRefresh.addEventListener("click", () => reload());
  }

  if (els.btnMenu) {
    els.btnMenu.addEventListener("click", () => toggleNav());
  }
  if (els.navBackdrop) {
    els.navBackdrop.addEventListener("click", () => setNavOpen(false));
  }
  if (els.btnPreviewMode) {
    els.btnPreviewMode.addEventListener("click", () => togglePreviewDetached());
  }
  if (els.btnDockPreview) {
    els.btnDockPreview.addEventListener("click", () => setPreviewDetached(false));
  }
  if (els.previewLightboxClose) {
    els.previewLightboxClose.addEventListener("click", () => {
      closePreviewLightbox({ restore: true });
    });
  }
  if (els.previewLightbox) {
    els.previewLightbox.addEventListener("click", (e) => {
      const rect = els.previewLightbox.getBoundingClientRect();
      const outside =
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom;
      if (outside) closePreviewLightbox({ restore: true });
    });
    els.previewLightbox.addEventListener("close", () => {
      restoreDetailArticlesHome();
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.navOpen && !els.previewLightbox?.open && !els.docLightbox?.open) {
      setNavOpen(false);
    }
  });

  for (const link of document.querySelectorAll("[data-view]")) {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      setView(link.dataset.view, { fromUser: true });
    });
  }
  window.addEventListener("popstate", () => {
    applyRouteFromLocation();
  });
  window.addEventListener("hashchange", () => {
    applyRouteFromLocation();
  });
  setNavOpen(state.navOpen);
  setPreviewDetached(state.previewDetached);
  // View + selection applied after data load in probeWriteApi().then(...)

  async function loadMarkdownFromPaths(paths) {
    for (const path of paths) {
      const text = await fetchText(path);
      if (text && text.trim()) return text;
    }
    return "";
  }

  function loadCandidateMarkdown() {
    return loadMarkdownFromPaths([
      "/api/candidate",
      ".cursor/skills/job-search/candidate.md",
      // Static demo / GitHub Pages (dotdirs under .cursor/ are unreliable there)
      "candidate.md",
      ".cursor/skills/job-search/candidate.example.md",
    ]);
  }

  function loadResumeMarkdown() {
    return loadMarkdownFromPaths([
      "/api/resume",
      "resume/resume.md",
      ".cursor/skills/job-generate-resume/base-resume.md",
      ".cursor/skills/job-generate-resume/base-resume.example.md",
    ]);
  }

  function renderMarkdownHtml(src, emptyMessage) {
    if (typeof window.renderMarkdown === "function") {
      return window.renderMarkdown(src || "", emptyMessage);
    }
    const pre = document.createElement("pre");
    pre.className = "md-pre";
    pre.textContent = src || emptyMessage || "";
    return pre.outerHTML;
  }

  function setLightboxMode(mode) {
    if (!els.docLightbox || !els.docLightboxBody) return;
    const wide = mode === "frame";
    els.docLightbox.classList.toggle("lightbox-wide", wide);
    els.docLightboxBody.classList.toggle("md-body", mode === "markdown");
    els.docLightboxBody.classList.toggle("lightbox-frame-body", wide);
  }

  async function openMarkdownLightbox({ title, loadingHtml, loader, emptyMessage }) {
    if (!els.docLightbox || !els.docLightboxBody) return;
    setLightboxMode("markdown");
    els.docLightboxTitle.textContent = title;
    els.docLightboxBody.innerHTML = loadingHtml;
    els.docLightbox.showModal();
    const md = await loader();
    els.docLightboxBody.innerHTML = renderMarkdownHtml(md, emptyMessage);
    els.docLightboxBody.scrollTop = 0;
  }

  async function openFrameLightbox({ title, src, missingMessage }) {
    if (!els.docLightbox || !els.docLightboxBody) return;
    setLightboxMode("markdown");
    els.docLightboxTitle.textContent = title;
    els.docLightboxBody.innerHTML = '<p class="md-p muted">Loading…</p>';
    els.docLightbox.showModal();

    const exists = await fileExists(src);
    if (!exists) {
      els.docLightboxBody.innerHTML = renderMarkdownHtml("", missingMessage);
      return;
    }

    setLightboxMode("frame");
    const frame = document.createElement("iframe");
    frame.className = "lightbox-frame";
    frame.src = src;
    frame.title = title;
    els.docLightboxBody.replaceChildren(frame);
  }

  function openCandidateLightbox() {
    return openMarkdownLightbox({
      title: "Candidate profile",
      loadingHtml: '<p class="md-p muted">Loading candidate profile…</p>',
      loader: loadCandidateMarkdown,
      emptyMessage:
        "Candidate profile not found. Run /job-search to create candidate.md.",
    });
  }

  function openResumeMarkdownLightbox() {
    return openMarkdownLightbox({
      title: "Base resume · markdown",
      loadingHtml: '<p class="md-p muted">Loading base resume…</p>',
      loader: loadResumeMarkdown,
      emptyMessage:
        "Resume markdown not found. Add resume/resume.md or run /job-sync-resume.",
    });
  }

  function openResumePdfLightbox() {
    return openFrameLightbox({
      title: "Base resume · PDF",
      src: "resume/resume.pdf",
      missingMessage:
        "Resume PDF not found. Add resume/resume.pdf or run /job-sync-resume.",
    });
  }

  function openResumeHtmlLightbox() {
    return openFrameLightbox({
      title: "Base resume · HTML",
      src: "resume/resume.html",
      missingMessage:
        "Resume HTML not found. Run /job-sync-resume to generate resume/resume.html.",
    });
  }

  function closeDocLightbox() {
    if (!els.docLightbox?.open) return;
    els.docLightbox.close();
    if (els.docLightboxBody) els.docLightboxBody.replaceChildren();
    setLightboxMode("markdown");
  }

  if (els.linkCandidate) {
    els.linkCandidate.addEventListener("click", (e) => {
      e.preventDefault();
      openCandidateLightbox();
    });
  }
  if (els.linkResumePdf) {
    els.linkResumePdf.addEventListener("click", (e) => {
      e.preventDefault();
      openResumePdfLightbox();
    });
  }
  if (els.linkResumeHtml) {
    els.linkResumeHtml.addEventListener("click", (e) => {
      e.preventDefault();
      openResumeHtmlLightbox();
    });
  }
  if (els.linkResumeMd) {
    els.linkResumeMd.addEventListener("click", (e) => {
      e.preventDefault();
      openResumeMarkdownLightbox();
    });
  }
  if (els.docLightboxClose) {
    els.docLightboxClose.addEventListener("click", closeDocLightbox);
  }
  if (els.docLightbox) {
    els.docLightbox.addEventListener("click", (e) => {
      const rect = els.docLightbox.getBoundingClientRect();
      const outside =
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom;
      if (outside) closeDocLightbox();
    });
    els.docLightbox.addEventListener("close", () => {
      if (els.docLightboxBody) els.docLightboxBody.replaceChildren();
      setLightboxMode("markdown");
    });
  }

  if (speechSupported()) {
    window.speechSynthesis.addEventListener("voiceschanged", () => {
      const select = state.speech.root?.querySelector(".speech-voice");
      if (select) populateVoiceSelect(select);
      document.querySelectorAll(".speech-voice").forEach((el) => {
        if (el !== select) populateVoiceSelect(el);
      });
    });
  }

  probeWriteApi().then(async () => {
    state.applyingRoute = true;
    try {
      await reload();
    } finally {
      state.applyingRoute = false;
    }
    await applyRouteFromLocation();
  });
})();
