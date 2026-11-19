// ============================================================
// OpenShelf — frontend app logic
// ============================================================

const state = {
  books: [],
  searchTerm: "",
  field: "all",
  category: "all",
  // Study-with-AI state
  attachedBookIds: [],      // ids attached as context
  messages: [],             // { role: "user"|"ai", text }
  isThinking: false
};

const els = {
  // nav / views
  navLinks:      document.querySelectorAll(".nav-link"),
  viewBrowse:    document.getElementById("view-browse"),
  viewStudy:     document.getElementById("view-study"),
  viewAbout:     document.getElementById("view-about"),
  brandLink:     document.getElementById("brandLink"),

  // browse
  searchForm:    document.getElementById("searchForm"),
  searchInput:   document.getElementById("searchInput"),
  fieldSelect:   document.getElementById("fieldSelect"),
  categoryRow:   document.getElementById("categoryRow"),
  statusBar:     document.getElementById("statusBar"),
  resultsGrid:   document.getElementById("resultsGrid"),

  // modal
  modalBackdrop: document.getElementById("modalBackdrop"),
  modalBody:     document.getElementById("modalBody"),
  modalClose:    document.getElementById("modalClose"),

  // study
  attachedList:     document.getElementById("attachedList"),
  openAttachPicker: document.getElementById("openAttachPicker"),
  suggestList:      document.getElementById("suggestList"),
  chatScroll:       document.getElementById("chatScroll"),
  chatEmpty:        document.getElementById("chatEmpty"),
  chatMessages:     document.getElementById("chatMessages"),
  chatForm:         document.getElementById("chatForm"),
  chatInput:        document.getElementById("chatInput"),
  chatSend:         document.getElementById("chatSend"),

  // picker
  pickerBackdrop:   document.getElementById("pickerBackdrop"),
  pickerClose:      document.getElementById("pickerClose"),
  pickerSearch:     document.getElementById("pickerSearch"),
  pickerResults:    document.getElementById("pickerResults")
};

// ============================================================
// BOOT
// ============================================================
function init() {
  state.books = window.MOCK_BOOKS || [];   // replaced by API in M5
  renderCategoryChips();
  renderResults();
  renderAttached();
  renderSuggestions();
  renderChat();
  bindEvents();
}

// ============================================================
// EVENTS
// ============================================================
function bindEvents() {
  // browse
  els.searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    state.searchTerm = els.searchInput.value.trim();
    state.field = els.fieldSelect.value;
    renderResults();
  });
  els.fieldSelect.addEventListener("change", () => {
    state.field = els.fieldSelect.value;
    if (state.searchTerm) renderResults();
  });

  // nav
  els.navLinks.forEach((btn) =>
    btn.addEventListener("click", () => switchView(btn.dataset.view))
  );
  els.brandLink.addEventListener("click", (e) => {
    e.preventDefault();
    switchView("browse");
  });

  // detail modal
  els.modalClose.addEventListener("click", closeModal);
  els.modalBackdrop.addEventListener("click", (e) => {
    if (e.target === els.modalBackdrop) closeModal();
  });

  // attach picker
  els.openAttachPicker.addEventListener("click", openPicker);
  els.pickerClose.addEventListener("click", closePicker);
  els.pickerBackdrop.addEventListener("click", (e) => {
    if (e.target === els.pickerBackdrop) closePicker();
  });
  els.pickerSearch.addEventListener("input", renderPickerResults);

  // chat
  els.chatForm.addEventListener("submit", onChatSubmit);
  els.chatInput.addEventListener("input", autosizeChatInput);
  els.chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onChatSubmit(e);
    }
  });

  // global esc
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!els.modalBackdrop.classList.contains("hidden")) closeModal();
      if (!els.pickerBackdrop.classList.contains("hidden")) closePicker();
    }
  });
}

// ============================================================
// VIEW SWITCHING
// ============================================================
function switchView(view) {
  els.viewBrowse.classList.toggle("hidden", view !== "browse");
  els.viewStudy.classList.toggle("hidden", view !== "study");
  els.viewAbout.classList.toggle("hidden", view !== "about");
  els.navLinks.forEach((b) =>
    b.classList.toggle("is-active", b.dataset.view === view)
  );
  if (view === "study") {
    // scroll chat to bottom on entry
    requestAnimationFrame(() => {
      els.chatScroll.scrollTop = els.chatScroll.scrollHeight;
    });
  }
}

// ============================================================
// BROWSE — categories + results
// ============================================================
function renderCategoryChips() {
  const cats = Array.from(
    new Set(state.books.map((b) => b.category).filter(Boolean))
  ).sort();

  const chip = (value, label, active = false) =>
    `<button class="chip${active ? " is-active" : ""}" data-cat="${escapeAttr(value)}">${escapeHtml(label)}</button>`;

  els.categoryRow.innerHTML =
    chip("all", "All", true) + cats.map((c) => chip(c, c)).join("");

  els.categoryRow.querySelectorAll(".chip").forEach((el) => {
    el.addEventListener("click", () => {
      state.category = el.dataset.cat;
      els.categoryRow
        .querySelectorAll(".chip")
        .forEach((c) => c.classList.remove("is-active"));
      el.classList.add("is-active");
      renderResults();
    });
  });
}

function filterBooks() {
  const term = state.searchTerm.toLowerCase();
  return state.books.filter((book) => {
    if (state.category !== "all" && book.category !== state.category) return false;
    if (!term) return true;
    if (state.field !== "all") {
      return String(book[state.field] || "").toLowerCase().includes(term);
    }
    const haystack = [
      book.title, book.author, book.category,
      book.area1_title_stmt, book.area4_publication, book.area7_notes
    ].join(" ").toLowerCase();
    return haystack.includes(term);
  });
}

function renderResults() {
  const results = filterBooks();

  if (results.length === 0) {
    els.statusBar.textContent = "";
    els.resultsGrid.innerHTML = `
      <div class="empty-state">
        <h3>No books match your search</h3>
        <p>Try a different keyword, or clear the category filter.</p>
      </div>`;
    return;
  }
  els.statusBar.textContent =
    `${results.length} ${results.length === 1 ? "book" : "books"}`;
  els.resultsGrid.innerHTML = results.map(bookCardHTML).join("");

  els.resultsGrid.querySelectorAll(".book-card").forEach((card) => {
    card.addEventListener("click", () => openModal(Number(card.dataset.id)));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openModal(Number(card.dataset.id));
      }
    });
  });
}

function bookCardHTML(book) {
  return `
    <article class="book-card" data-id="${book.id}" tabindex="0" role="button"
             aria-label="Open details for ${escapeAttr(book.title)}">
      ${coverHTML(book)}
      <div class="book-meta">
        <div class="book-title">${escapeHtml(book.title)}</div>
        <div class="book-author">${escapeHtml(book.author || "Unknown author")}</div>
        <div class="book-cat">${escapeHtml(book.category || "Uncategorized")}</div>
      </div>
    </article>`;
}

function coverHTML(book, extraClass = "") {
  if (book.cover_url) {
    return `
      <div class="cover ${extraClass}">
        <img src="${escapeAttr(book.cover_url)}" alt="Cover of ${escapeAttr(book.title)}" loading="lazy" />
      </div>`;
  }
  return `
    <div class="cover cover--generated ${extraClass}">
      <div class="gen-title">${escapeHtml(book.title)}</div>
      <div class="gen-author">${escapeHtml(book.author || "")}</div>
    </div>`;
}

// ============================================================
// DETAIL MODAL
// ============================================================
function openModal(id) {
  const book = state.books.find((b) => b.id === id);
  if (!book) return;

  const rows = [
    ["Area 0 — Content type",                 book.area0_content_type],
    ["Area 1 — Title &amp; responsibility",   book.area1_title_stmt],
    ["Area 2 — Edition",                      book.area2_edition],
    ["Area 3 — Material details",             book.area3_material_details],
    ["Area 4 — Publication",                  book.area4_publication],
    ["Area 5 — Physical description",         book.area5_physical],
    ["Area 6 — Series",                       book.area6_series],
    ["Area 7 — Notes",                        book.area7_notes],
    ["Area 8 — Identifier &amp; availability", book.area8_identifier]
  ]
    .filter(([, v]) => v && String(v).trim() !== "")
    .map(([k, v]) => `
      <div class="catalog-row">
        <dt>${k}</dt>
        <dd>${escapeHtml(String(v))}</dd>
      </div>`)
    .join("");

  const license = book.license
    ? `<strong>${escapeHtml(book.license)}</strong>${
        book.license_url
          ? ` — <a href="${escapeAttr(book.license_url)}" target="_blank" rel="noopener">license</a>`
          : ""
      }`
    : "";

  const alreadyAttached = state.attachedBookIds.includes(book.id);

  els.modalBody.innerHTML = `
    <div class="detail-grid">
      ${coverHTML(book, "detail-cover")}
      <div class="detail-head">
        <p class="eyebrow">${escapeHtml(book.category || "Uncategorized")}</p>
        <h2 id="modalTitle">${escapeHtml(book.title)}</h2>
        <p class="author-line">${escapeHtml(book.author || "Unknown author")}</p>
        <p class="summary">${escapeHtml(book.description || "")}</p>
      </div>
    </div>

    ${rows ? `
      <div class="catalog">
        <p class="catalog-title">Catalog record</p>
        <dl>${rows}</dl>
      </div>` : ""}

    <div class="detail-actions">
      <span class="license-line">License: ${license || "See source"}</span>
      <button class="btn btn-secondary" id="modalStudyBtn" ${alreadyAttached ? "disabled" : ""}>
        ${alreadyAttached ? "Already attached" : "Study with AI"}
      </button>
      ${book.source_url ? `<a class="btn btn-secondary" href="${escapeAttr(book.source_url)}" target="_blank" rel="noopener">View source</a>` : ""}
      ${book.download_url ? `<a class="btn btn-primary" href="${escapeAttr(book.download_url)}" target="_blank" rel="noopener">Read or download</a>` : ""}
    </div>`;

  els.modalBackdrop.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  els.modalClose.focus();

  const studyBtn = document.getElementById("modalStudyBtn");
  if (studyBtn && !alreadyAttached) {
    studyBtn.addEventListener("click", () => {
      attachBook(book.id);
      closeModal();
      switchView("study");
    });
  }
}

function closeModal() {
  els.modalBackdrop.classList.add("hidden");
  els.modalBody.innerHTML = "";
  document.body.style.overflow = "";
}

// ============================================================
// STUDY WITH AI — attached books
// ============================================================
function attachBook(id) {
  if (state.attachedBookIds.includes(id)) return;
  state.attachedBookIds.push(id);
  renderAttached();
  renderSuggestions();
  renderPickerResults();
}

function detachBook(id) {
  state.attachedBookIds = state.attachedBookIds.filter((x) => x !== id);
  renderAttached();
  renderSuggestions();
  renderPickerResults();
}

function getAttachedBooks() {
  return state.attachedBookIds
    .map((id) => state.books.find((b) => b.id === id))
    .filter(Boolean);
}

function renderAttached() {
  const attached = getAttachedBooks();

  if (attached.length === 0) {
    els.attachedList.innerHTML = `
      <p class="attached-empty">No books attached yet. Attach one to begin.</p>`;
    return;
  }

  els.attachedList.innerHTML = attached
    .map((book) => {
      const thumb = book.cover_url
        ? `<div class="attached-thumb"><img src="${escapeAttr(book.cover_url)}" alt=""></div>`
        : `<div class="attached-thumb">${escapeHtml(initials(book.title))}</div>`;
      return `
        <div class="attached-item">
          ${thumb}
          <div class="attached-title">${escapeHtml(book.title)}</div>
          <button class="attached-remove" data-id="${book.id}" aria-label="Remove ${escapeAttr(book.title)}">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>`;
    })
    .join("");

  els.attachedList.querySelectorAll(".attached-remove").forEach((btn) => {
    btn.addEventListener("click", () => detachBook(Number(btn.dataset.id)));
  });
}

// ============================================================
// STUDY WITH AI — suggestions
// ============================================================
function renderSuggestions() {
  const attached = getAttachedBooks();
  const primary = attached[0];

  const base = [
    "Summarize this book in 5 sentences.",
    "Explain the core idea in plain language.",
    "What should I look for while reading?",
    "How does this connect to what I'm studying?"
  ];

  const withBook = primary
    ? [
        `Summarize "${truncate(primary.title, 32)}".`,
        "What is the author's main argument?",
        "Give me 3 discussion questions.",
        "Explain the hardest idea simply."
      ]
    : base;

  els.suggestList.innerHTML = withBook
    .map((s) => `<li><button type="button">${escapeHtml(s)}</button></li>`)
    .join("");

  els.suggestList.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      els.chatInput.value = btn.textContent.trim();
      autosizeChatInput();
      els.chatInput.focus();
    });
  });
}

// ============================================================
// STUDY WITH AI — chat rendering
// ============================================================
function renderChat() {
  const hasMessages = state.messages.length > 0;
  els.chatEmpty.classList.toggle("hidden", hasMessages);

  els.chatMessages.innerHTML = state.messages
    .map((m) => messageHTML(m.role, m.text))
    .join("");

  if (state.isThinking) {
    els.chatMessages.insertAdjacentHTML("beforeend", typingHTML());
  }

  els.chatScroll.scrollTop = els.chatScroll.scrollHeight;
}

function messageHTML(role, text) {
  const isAi = role === "ai";
  return `
    <div class="msg msg--${isAi ? "ai" : "user"}">
      <div class="msg-avatar">${isAi ? "AI" : "You"}</div>
      <div class="msg-body">
        <div class="msg-name">${isAi ? "OpenShelf Assistant" : "You"}</div>
        <div class="msg-text">${escapeHtml(text)}</div>
      </div>
    </div>`;
}

function typingHTML() {
  return `
    <div class="msg msg--ai msg--typing">
      <div class="msg-avatar">AI</div>
      <div class="msg-body">
        <div class="msg-name">OpenShelf Assistant</div>
        <div class="msg-text">
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
        </div>
      </div>
    </div>`;
}

// ============================================================
// STUDY WITH AI — send message
// ============================================================
async function onChatSubmit(e) {
  if (e) e.preventDefault();
  const text = els.chatInput.value.trim();
  if (!text || state.isThinking) return;

  state.messages.push({ role: "user", text });
  els.chatInput.value = "";
  autosizeChatInput();
  state.isThinking = true;
  renderChat();

  // MOCK responder — replaced by real Groq call in Milestone 7.
  const reply = await mockAiReply(text, getAttachedBooks());

  state.messages.push({ role: "ai", text: reply });
  state.isThinking = false;
  renderChat();
}

// Simulated latency + a grounded-in-record stub. Deliberately honest:
// it tells the user what the real AI will do, and never invents facts.
function mockAiReply(userText, attached) {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (attached.length === 0) {
        resolve(
          `Before I answer, attach at least one book using the "Attach a book" button on the left. ` +
          `Once a book is attached, I will ground my answers in its catalog record ` +
          `(title, author, publication, notes, and so on) — never in invented sources.`
        );
        return;
      }
      const primary = attached[0];
      const more =
        attached.length > 1
          ? ` You also have ${attached.length - 1} other book${
              attached.length - 1 === 1 ? "" : "s"
            } attached.`
          : "";

      resolve(
        `This is a preview of the Study with AI assistant. In the final version, ` +
        `your question — "${truncate(userText, 90)}" — will be sent to the backend, ` +
        `answered by Groq using only the attached book's record, and returned to you here.\n\n` +
        `Attached context:\n` +
        `• ${primary.title}${primary.author ? " — " + primary.author : ""}` +
        `${primary.category ? " (" + primary.category + ")" : ""}` +
        `${primary.area4_publication ? "\n• " + primary.area4_publication : ""}` +
        `${primary.area7_notes ? "\n• " + primary.area7_notes : ""}` +
        `${more}\n\n` +
        `Reminder: AI answers are aids and may need checking against the source text.`
      );
    }, 700);
  });
}

// ============================================================
// ATTACH PICKER
// ============================================================
function openPicker() {
  els.pickerBackdrop.classList.remove("hidden");
  els.pickerSearch.value = "";
  renderPickerResults();
  els.pickerSearch.focus();
}

function closePicker() {
  els.pickerBackdrop.classList.add("hidden");
}

function renderPickerResults() {
  const q = els.pickerSearch.value.trim().toLowerCase();
  const books = state.books.filter((b) => {
    if (state.attachedBookIds.includes(b.id)) return false;
    if (!q) return true;
    return [b.title, b.author, b.category].join(" ").toLowerCase().includes(q);
  });

  if (books.length === 0) {
    els.pickerResults.innerHTML = `
      <p class="picker-empty">No books to show.</p>`;
    return;
  }

  els.pickerResults.innerHTML = books
    .map((book) => {
      const thumb = book.cover_url
        ? `<div class="picker-thumb"><img src="${escapeAttr(book.cover_url)}" alt=""></div>`
        : `<div class="picker-thumb">${escapeHtml(initials(book.title))}</div>`;
      return `
        <button class="picker-row" data-id="${book.id}">
          ${thumb}
          <div>
            <div class="picker-title-txt">${escapeHtml(book.title)}</div>
            <div class="picker-sub">${escapeHtml(book.author || "Unknown author")}</div>
          </div>
          <span class="picker-tag">${escapeHtml(book.category || "")}</span>
        </button>`;
    })
    .join("");

  els.pickerResults.querySelectorAll(".picker-row").forEach((row) => {
    row.addEventListener("click", () => {
      attachBook(Number(row.dataset.id));
      closePicker();
    });
  });
}

// ============================================================
// COMPOSER
// ============================================================
function autosizeChatInput() {
  els.chatInput.style.height = "auto";
  els.chatInput.style.height = Math.min(els.chatInput.scrollHeight, 160) + "px";
}

// ============================================================
// UTIL
// ============================================================
function initials(str) {
  return String(str || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}
function truncate(str, n) {
  const s = String(str || "");
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}
function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function escapeAttr(str) { return escapeHtml(str); }

document.addEventListener("DOMContentLoaded", init);