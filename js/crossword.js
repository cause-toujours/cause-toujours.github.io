// crossword.js — mots-croisés jouables dans la section 03
// Charge /data/crossword.json, construit la grille, gère la saisie et la
// navigation (flèches, backspace, clic, tab), la surbrillance du mot actif,
// et les boutons Vérifier / Révéler / Effacer.

const state = {
  grid: null,
  words: null,
  rows: 0,
  cols: 0,
  active: null,
  direction: "across",
  cells: [],
  inputs: [],
};

async function loadCrossword() {
  const root = document.getElementById("crossword");
  if (!root) return;

  try {
    const res = await fetch("/data/crossword.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    state.grid = data.grid;
    state.words = data.words;
    state.rows = data.rows;
    state.cols = data.cols;

    const titleEl = document.getElementById("cw-title");
    const introEl = document.getElementById("cw-intro");
    if (titleEl) titleEl.textContent = data.title || "Mots croisés";
    if (introEl) introEl.textContent = data.intro || "";

    buildGrid();
    buildClues();
    wireControls();
    updateProgress();
  } catch (err) {
    console.error("Erreur de chargement du mots-croisés :", err);
    root.style.display = "none";
  }
}

function buildGrid() {
  const gridEl = document.getElementById("cw-grid");
  gridEl.innerHTML = "";
  gridEl.style.setProperty("--cw-cols", state.cols);
  gridEl.style.setProperty("--cw-rows", state.rows);

  // Numéros : on prend le plus petit num de mot qui démarre à chaque case
  const numAt = {};
  for (const w of state.words) {
    const key = `${w.row},${w.col}`;
    if (numAt[key] === undefined || w.num < numAt[key]) numAt[key] = w.num;
  }

  state.cells = [];
  state.inputs = [];

  for (let r = 0; r < state.rows; r++) {
    const row = state.grid[r];
    for (let c = 0; c < state.cols; c++) {
      const cell = document.createElement("div");
      cell.className = "cw-cell";
      cell.dataset.row = r;
      cell.dataset.col = c;

      if (row[c] === null) {
        cell.classList.add("cw-cell--block");
      } else {
        cell.classList.add("cw-cell--letter");
        const num = numAt[`${r},${c}`];
        if (num !== undefined) {
          const nspan = document.createElement("span");
          nspan.className = "cw-num";
          nspan.textContent = num;
          cell.appendChild(nspan);
        }
        const input = document.createElement("input");
        input.type = "text";
        input.maxLength = 1;
        input.setAttribute("aria-label", `Ligne ${r + 1}, colonne ${c + 1}`);
        input.dataset.row = r;
        input.dataset.col = c;
        input.autocomplete = "off";
        input.spellcheck = false;
        input.inputMode = "text";
        cell.appendChild(input);
        state.inputs.push(input);
      }
      gridEl.appendChild(cell);
      state.cells.push(cell);
    }
  }

  // Active la première case du premier mot
  if (state.words.length) {
    const w = state.words[0];
    setActive(w.row, w.col, w.dir);
  }
}

function buildClues() {
  const acrossEl = document.getElementById("cw-clues-across");
  const downEl = document.getElementById("cw-clues-down");
  acrossEl.innerHTML = "";
  downEl.innerHTML = "";

  const across = state.words.filter((w) => w.dir === "across").sort((a, b) => a.num - b.num);
  const down = state.words.filter((w) => w.dir === "down").sort((a, b) => a.num - b.num);

  for (const w of across) {
    acrossEl.appendChild(makeClue(w));
  }
  for (const w of down) {
    downEl.appendChild(makeClue(w));
  }
}

function makeClue(w) {
  const li = document.createElement("li");
  li.className = "cw-clue";
  li.dataset.num = w.num;
  li.dataset.dir = w.dir;
  li.dataset.row = w.row;
  li.dataset.col = w.col;
  li.innerHTML = `<span class="cw-clue-num">${w.num}.</span> <span class="cw-clue-text">${escapeHtml(w.clue)}</span> <span class="cw-clue-len">${w.answer.length} lettres</span>`;
  li.addEventListener("click", () => {
    setActive(w.row, w.col, w.dir);
    focusFirstEmpty(w);
  });
  return li;
}

function focusFirstEmpty(w) {
  const cells = wordCells(w);
  for (const cell of cells) {
    const input = cell.querySelector("input");
    if (input && !input.value) {
      input.focus();
      return;
    }
  }
  cells[0].querySelector("input")?.focus();
}

function wordCells(w) {
  const cells = [];
  const len = w.answer.length;
  for (let i = 0; i < len; i++) {
    const r = w.dir === "across" ? w.row : w.row + i;
    const c = w.dir === "across" ? w.col + i : w.col;
    const cell = cellAt(r, c);
    if (cell) cells.push(cell);
  }
  return cells;
}

function cellAt(r, c) {
  if (r < 0 || r >= state.rows || c < 0 || c >= state.cols) return null;
  return state.cells[r * state.cols + c] || null;
}

function inputAt(r, c) {
  return cellAt(r, c)?.querySelector("input") || null;
}

function setActive(r, c, dir) {
  // Trouve le mot passant par (r,c) dans la direction donnée
  const w = findWord(r, c, dir);
  if (!w) {
    // Bascule direction si pas de mot dans celle-ci
    const alt = findWord(r, c, dir === "across" ? "down" : "across");
    if (alt) { dir = alt.dir; }
  }
  state.active = { row: r, col: c };
  state.direction = dir;
  renderActive();
}

function findWord(r, c, dir) {
  return state.words.find((w) => {
    if (w.dir !== dir) return false;
    const len = w.answer.length;
    for (let i = 0; i < len; i++) {
      const wr = dir === "across" ? w.row : w.row + i;
      const wc = dir === "across" ? w.col + i : w.col;
      if (wr === r && wc === c) return true;
    }
    return false;
  });
}

function renderActive() {
  // Nettoie
  state.cells.forEach((c) => c.classList.remove("cw-cell--active", "cw-cell--in-word"));
  document.querySelectorAll(".cw-clue").forEach((c) => c.classList.remove("cw-clue--active"));

  if (!state.active) return;
  const { row, col } = state.active;
  const w = findWord(row, col, state.direction);
  if (w) {
    wordCells(w).forEach((cell) => cell.classList.add("cw-cell--in-word"));
    const clue = document.querySelector(`.cw-clue[data-num="${w.num}"][data-dir="${w.dir}"]`);
    if (clue) {
      clue.classList.add("cw-clue--active");
      clue.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }
  const activeCell = cellAt(row, col);
  if (activeCell) activeCell.classList.add("cw-cell--active");
}

function moveActive(dr, dc) {
  if (!state.active) return;
  let { row, col } = state.active;
  // Cherche la prochaine case lettre dans la direction
  for (let i = 0; i < Math.max(state.rows, state.cols); i++) {
    row += dr;
    col += dc;
    if (row < 0 || row >= state.rows || col < 0 || col >= state.cols) return;
    const cell = cellAt(row, col);
    if (cell && cell.classList.contains("cw-cell--letter")) {
      setActive(row, col, dr === 0 ? "across" : "down");
      inputAt(row, col)?.focus();
      return;
    }
  }
}

function nextInWord(forward = true) {
  if (!state.active) return;
  const w = findWord(state.active.row, state.active.col, state.direction);
  if (!w) return;
  const cells = wordCells(w);
  const idx = cells.findIndex((c) => +c.dataset.row === state.active.row && +c.dataset.col === state.active.col);
  const next = forward ? idx + 1 : idx - 1;
  if (next >= 0 && next < cells.length) {
    const cell = cells[next];
    setActive(+cell.dataset.row, +cell.dataset.col, state.direction);
    cell.querySelector("input")?.focus();
  }
}

function wireControls() {
  state.inputs.forEach((input) => {
    input.addEventListener("focus", () => {
      setActive(+input.dataset.row, +input.dataset.col, state.direction);
    });
    input.addEventListener("click", () => {
      // Si on reclique sur la case active, bascule la direction
      if (state.active && state.active.row === +input.dataset.row && state.active.col === +input.dataset.col) {
        state.direction = state.direction === "across" ? "down" : "across";
        renderActive();
      }
    });
    input.addEventListener("input", (e) => {
      const v = e.target.value.toUpperCase();
      e.target.value = v;
      e.target.classList.remove("cw-input--ok", "cw-input--ko");
      if (v) nextInWord(true);
      updateProgress();
    });
    input.addEventListener("keydown", (e) => {
      const key = e.key;
      if (key === "Backspace") {
        if (!input.value) {
          e.preventDefault();
          nextInWord(false);
          // efface aussi la case précédente
          if (state.active) {
            const prev = inputAt(state.active.row, state.active.col);
            if (prev) { prev.value = ""; prev.classList.remove("cw-input--ok", "cw-input--ko"); }
          }
          updateProgress();
        }
        return;
      }
      if (key === "ArrowRight") { e.preventDefault(); moveActive(0, +1); }
      else if (key === "ArrowLeft") { e.preventDefault(); moveActive(0, -1); }
      else if (key === "ArrowDown") { e.preventDefault(); moveActive(+1, 0); }
      else if (key === "ArrowUp") { e.preventDefault(); moveActive(-1, 0); }
      else if (key === "Tab") {
        e.preventDefault();
        nextInWord(!e.shiftKey);
      }
    });
  });

  const btnCheck = document.getElementById("cw-check");
  const btnReveal = document.getElementById("cw-reveal");
  const btnClear = document.getElementById("cw-clear");

  if (btnCheck) btnCheck.addEventListener("click", checkAnswers);
  if (btnReveal) btnReveal.addEventListener("click", revealAnswers);
  if (btnClear) btnClear.addEventListener("click", clearAnswers);
}

function checkAnswers() {
  state.inputs.forEach((input) => {
    const r = +input.dataset.row;
    const c = +input.dataset.col;
    const expected = state.grid[r][c];
    input.classList.remove("cw-input--ok", "cw-input--ko");
    if (!input.value) return;
    if (input.value.toUpperCase() === expected) input.classList.add("cw-input--ok");
    else input.classList.add("cw-input--ko");
  });
}

function revealAnswers() {
  state.inputs.forEach((input) => {
    const r = +input.dataset.row;
    const c = +input.dataset.col;
    input.value = state.grid[r][c];
    input.classList.remove("cw-input--ko");
    input.classList.add("cw-input--ok");
  });
  updateProgress();
}

function clearAnswers() {
  state.inputs.forEach((input) => {
    input.value = "";
    input.classList.remove("cw-input--ok", "cw-input--ko");
  });
  updateProgress();
}

function updateProgress() {
  const total = state.words.length;
  let done = 0;
  for (const w of state.words) {
    const cells = wordCells(w);
    const filled = cells.every((c) => c.querySelector("input")?.value);
    if (filled) done++;
  }
  const el = document.getElementById("cw-progress");
  if (el) {
    el.textContent = `${done} / ${total} mots`;
    el.dataset.done = String(done);
    el.dataset.total = String(total);
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

document.addEventListener("DOMContentLoaded", loadCrossword);
