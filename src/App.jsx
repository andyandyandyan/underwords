import { useState, useEffect, useRef } from "react";
import { PUZZLES } from "./puzzles.js";

function getActiveDate() {
  const now = new Date();
  const et  = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  if (et.getHours() < 3) et.setDate(et.getDate() - 1);
  return `${et.getFullYear()}-${String(et.getMonth()+1).padStart(2,"0")}-${String(et.getDate()).padStart(2,"0")}`;
}

function formatDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

const ACTIVE_DATE  = getActiveDate();
const TODAY_PUZZLE = PUZZLES.find(p => p.date === ACTIVE_DATE) ?? PUZZLES[PUZZLES.length - 1];
const ARCHIVE_LIST = PUZZLES.filter(p => p.date < ACTIVE_DATE).reverse();

const PROGRESS_KEY = "pg_progress";
const HARD_MODE_KEY = "pg_hard_mode";

function readProgress(dateKey) {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}")[dateKey] || null; }
  catch { return null; }
}
function writeProgress(dateKey, data) {
  try {
    const all = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}");
    all[dateKey] = data;
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
  } catch {}
}
function clearProgress(dateKey) {
  try {
    const all = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}");
    delete all[dateKey];
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
  } catch {}
}

function applyProgress(baseTiles, progress) {
  if (!progress) return baseTiles;
  let tiles = baseTiles.map(t =>
    (progress.r || []).includes(t.id) ? { ...t, isRevealed: true } : t
  );
  if (progress.h) {
    tiles = tiles.map(t =>
      !t.isShaded && !t.isRevealed && t.hiddenLetter === " "
        ? { ...t, isRevealed: true, isHintRevealed: true }
        : t
    );
  }
  return tiles;
}

const _initHardMode = !!localStorage.getItem(HARD_MODE_KEY);
const _initProgress = readProgress(ACTIVE_DATE);
const _initBaseTiles = buildTiles(TODAY_PUZZLE.surface, TODAY_PUZZLE.hidden, _initHardMode);
const _initTiles = applyProgress(_initBaseTiles, _initProgress);
const _hasInitProgress = !!_initProgress;
// Deliberately name-independent so renaming the game never breaks history.
// Do NOT rename this key.
const HISTORY_KEY = "pg_history";

// Migrate from all previous key names (including broken "undefined" key from a past bug)
(function migrate() {
  for (const old of ["doppel_history", "coverup_history", "uncover_history", "undefined"]) {
    const data = localStorage.getItem(old);
    if (data && !localStorage.getItem(HISTORY_KEY)) {
      localStorage.setItem(HISTORY_KEY, data);
    }
    localStorage.removeItem(old);
  }
})();

const MAX_ROWS = 7;
const MIN_COLS = 6;
const GAP      = 4;


function calcLayout(surface) {
  const total = surface.length;
  const cols  = Math.max(MIN_COLS, Math.ceil(total / MAX_ROWS));
  const rows  = Math.ceil(total / cols);
  return { cols, rows };
}

function buildTiles(surface, hidden, hardMode = false) {
  return surface.split("").map((char, i) => {
    const isShaded = char === hidden[i] && char !== " ";
    const isAutoSpace = !hardMode && !isShaded && hidden[i] === " ";
    return {
      id: i,
      surfaceLetter: char,
      hiddenLetter: hidden[i],
      isShaded,
      isRevealed: isShaded || isAutoSpace,
      isHintRevealed: isAutoSpace,
    };
  });
}

function calcScore(tiles) {
  return tiles.filter(t => !t.isShaded && t.isRevealed && t.hiddenLetter !== " ").length;
}

function getRating(reveals) {
  if (reveals === 0) return "perfect";
  return "nice!";
}

function MiniTile({ letter, hiddenLetter, state, size }) {
  const isOval = state === "shaded" || state === "revealed" || state === "space" || state === "hint";
  const ovalLetter = hiddenLetter !== undefined ? hiddenLetter : letter;
  const T = "0.25s ease";
  return (
    <div style={{ position: "relative", width: size, height: Math.round(size * 1.15), flexShrink: 0, userSelect: "none" }}>
      {/* Oval layer */}
      <div style={{
        position: "absolute", inset: 0, borderRadius: "50%",
        background: "var(--bg-tile-shaded)", border: "1.5px solid var(--border-tile-shaded)", color: "var(--color-tile-shaded)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'DM Mono',monospace", fontSize: size * 0.4, fontWeight: 500,
        opacity: isOval ? 1 : 0,
        transform: isOval ? "scale(1)" : "scale(0.65)",
        transition: `opacity ${T}, transform ${T}`,
      }}>
        {ovalLetter === " " ? "" : ovalLetter}
      </div>
      {/* Surface layer */}
      <div style={{
        position: "absolute", inset: 0, borderRadius: 3,
        background: state === "selected" ? "var(--bg-tile-selected)" : "var(--bg-tile-default)",
        border: `1.5px solid ${state === "selected" ? "var(--color-accent)" : "var(--border-tile-default)"}`,
        color: "var(--color-tile-default)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'DM Mono',monospace", fontSize: size * 0.4, fontWeight: 500,
        transform: isOval ? "translateY(-38%) scale(0.78)" : state === "selected" ? "translateY(-2px)" : "none",
        opacity: isOval ? 0 : 1,
        boxShadow: state === "selected" ? "0 0 0 2px rgba(201,169,110,0.25)" : "none",
        transition: `transform ${T}, opacity ${T}, background 0.2s, border-color 0.15s`,
      }}>
        {letter === " " ? "" : letter}
      </div>
    </div>
  );
}

// Animation 1: PALM TREE slides up under PINEAPPLE (no fade — covered by z-index)
function SlidingAnimation() {
  const surf   = "PINEAPPLE";
  const hidn   = "PALM TREE";
  const size   = 26;
  const gap    = 2;
  const tileH  = Math.round(size * 1.15); // 26px
  const rowGap = 8;
  const topPad = 4;
  const palmTop = topPad;
  const pineTop = topPad + tileH + rowGap; // 38px
  const slideY  = pineTop - palmTop;       // 34px
  const contH   = pineTop + tileH + rowGap; // one row-gap of clearance below PINEAPPLE

  return (
    <div style={{ position:"relative", width:"100%", height: contH, flexShrink:0 }}>
      {/* Cover: fills y=0 to pineTop with modal bg, hides PINEAPPLE as it slides up */}
      <div style={{
        position:"absolute", top:0, left:0, right:0,
        height: pineTop,
        background:"var(--bg-modal)",
        zIndex: 2,
      }}/>
      {/* PALM TREE — above the cover; bg fills inter-tile gaps */}
      <div style={{
        position:"absolute", top: palmTop, left:0, right:0,
        display:"flex", gap, justifyContent:"center",
        zIndex: 3,
        background:"var(--bg-modal)",
      }}>
        {surf.split("").map((ch, i) => <MiniTile key={i} letter={ch} state="default" size={size}/>)}
      </div>
      {/* PINEAPPLE — slides up behind the cover */}
      <div style={{
        position:"absolute", top: pineTop, left:0, right:0,
        display:"flex", gap, justifyContent:"center",
        zIndex: 1,
        animation:"demoSlideUnder 4s ease-in-out infinite",
      }}>
        {hidn.split("").map((ch, i) => <MiniTile key={i} letter={ch} state="shaded" size={size}/>)}
      </div>
    </div>
  );
}

// Animation 2: P and E flip green, then blank middle flips green, then two tiles selected+revealed
function TileRevealAnimation() {
  const surf     = "PINEAPPLE";
  const hidn     = "PALM TREE";
  const HINT_IDX = 4;
  const SEQ      = [2, 6];
  const size     = 26;
  const gap      = 2;

  const [greenSet,     setGreenSet]     = useState(new Set());
  const [justGreen,    setJustGreen]    = useState(null);
  const [selected,     setSelected]     = useState(null);
  const [revealed,     setRevealed]     = useState(new Set());
  const [justRevealed, setJustRevealed] = useState(null);

  useEffect(() => {
    const ids = [];
    let alive = true;
    function sched(fn, ms) { const id = setTimeout(() => { if (alive) fn(); }, ms); ids.push(id); }
    function addGreen(idx) { setGreenSet(s => new Set([...s, idx])); setJustGreen(idx); }

    function run() {
      sched(() => addGreen(0), 300);
      sched(() => setJustGreen(null), 600);
      sched(() => addGreen(8), 1000);
      sched(() => setJustGreen(null), 1300);
      sched(() => addGreen(HINT_IDX), 1700);
      sched(() => setJustGreen(null), 2000);
      sched(() => setSelected(SEQ[0]), 2500);
      sched(() => { setRevealed(s => new Set([...s, SEQ[0]])); setJustRevealed(SEQ[0]); setSelected(null); }, 3200);
      sched(() => setJustRevealed(null), 3700);
      sched(() => setSelected(SEQ[1]), 4400);
      sched(() => { setRevealed(s => new Set([...s, SEQ[1]])); setJustRevealed(SEQ[1]); setSelected(null); }, 5100);
      sched(() => setJustRevealed(null), 5600);
      sched(() => { setGreenSet(new Set()); setRevealed(new Set()); setSelected(null); }, 6800);
      sched(run, 7300);
    }

    sched(run, 400);
    return () => { alive = false; ids.forEach(clearTimeout); };
  }, []);

  return (
    <div style={{ display:"flex", gap, justifyContent:"center" }}>
      {surf.split("").map((ch, i) => {
        const isGreen = greenSet.has(i);
        const isHint  = isGreen && i === HINT_IDX;
        const isRevealedSpace = isHint && hidn[i] === " ";
        let state = "default";
        if (isRevealedSpace)       state = "shaded";
        else if (isGreen)          state = "shaded";
        else if (revealed.has(i))  state = "revealed";
        else if (selected === i)   state = "selected";
        return (
          <MiniTile
            key={i}
            letter={ch}
            hiddenLetter={hidn[i]}
            state={state}
            size={size}
          />
        );
      })}
    </div>
  );
}

// Animation 3: "palm tree" types into a guess bar
function TypingAnimation() {
  const HIDN = "PALM TREE";

  const [typed, setTyped] = useState(new Set());
  const [done,  setDone]  = useState(false);

  useEffect(() => {
    const ids = []; let alive = true;
    function sched(fn, ms) { const id = setTimeout(() => { if (alive) fn(); }, ms); ids.push(id); }

    function run() {
      setTyped(new Set()); setDone(false);
      const base = 400;
      HIDN.split("").forEach((_, i) => {
        sched(() => setTyped(s => new Set([...s, i])), base + i * 180);
      });
      const end = base + HIDN.length * 180 + 200;
      sched(() => setDone(true), end);
      sched(() => { setDone(false); setTyped(new Set()); }, end + 1500);
      sched(run, end + 2100);
    }

    sched(run, 500);
    return () => { alive = false; ids.forEach(clearTimeout); };
  }, []);

  const allFilled = typed.size === HIDN.length;

  return (
    <div style={{ display:"flex", gap:"0.5rem", alignItems:"center" }}>
      <div style={{ flex:1, background:"var(--bg-input)", border:`1.5px solid var(--border-input)`, borderRadius:3, padding:"0.5rem 4px", display:"flex", gap:2, alignItems:"center" }}>
        {HIDN.split("").map((ch, i) => {
          if (ch === " ") return <div key={i} style={{ flex:1 }}/>;
          const isTyped   = typed.has(i);
          const borderCol = done ? "var(--border-tile-shaded)" : isTyped ? "var(--color-accent)" : "var(--border-tile-default)";
          const textCol   = done ? "var(--border-tile-shaded)" : "var(--color-modal-text)";
          return (
            <div key={i} style={{ flex:1, minWidth:0, minHeight:"1em", paddingBottom:2, borderBottom:`1.5px solid ${borderCol}`, textAlign:"center", fontFamily:"'DM Mono',monospace", fontSize:"0.83rem", fontWeight:500, color:textCol, userSelect:"none", transition:"color 0.2s, border-color 0.2s" }}>
              {isTyped ? ch : ""}
            </div>
          );
        })}
      </div>
      <button disabled style={{ background:"var(--color-accent)", border:"none", color:"var(--bg-primary-btn-text)", fontFamily:"'DM Mono',monospace", fontSize:"0.55rem", letterSpacing:"0.12em", textTransform:"uppercase", padding:"0.5rem 0.6rem", borderRadius:3, cursor:"default", fontWeight:500, flexShrink:0, opacity:allFilled||done?1:0.5, transition:"opacity 0.2s" }}>Guess</button>
      <div style={{ width:18, flexShrink:0, textAlign:"center", fontSize:"1rem", fontWeight:700, color:done?"var(--border-tile-shaded)":"transparent", transition:"color 0.2s" }}>✓</div>
    </div>
  );
}

// Screen 2: only the auto-reveals (P, E, space turning green one by one)
function AutoRevealAnimation() {
  const surf = "PINEAPPLE";
  const hidn = "PALM TREE";
  const size = 26; const gap = 2;
  const [greenSet, setGreenSet] = useState(new Set());

  useEffect(() => {
    const ids = []; let alive = true;
    function sched(fn, ms) { const id = setTimeout(() => { if (alive) fn(); }, ms); ids.push(id); }
    function run() {
      sched(() => setGreenSet(s => new Set([...s, 0])), 400);
      sched(() => setGreenSet(s => new Set([...s, 8])), 1100);
      sched(() => setGreenSet(s => new Set([...s, 4])), 1800);
      sched(() => setGreenSet(new Set()), 3300);
      sched(run, 3800);
    }
    sched(run, 500);
    return () => { alive = false; ids.forEach(clearTimeout); };
  }, []);

  return (
    <div style={{ display:"flex", gap, justifyContent:"center" }}>
      {surf.split("").map((ch, i) => (
        <MiniTile key={i} letter={ch} hiddenLetter={hidn[i]} state={greenSet.has(i) ? "shaded" : "default"} size={size}/>
      ))}
    </div>
  );
}

// Screen 3: P, E, space already green from the start; tiles 2 and 6 get selected then revealed
function RevealDemoAnimation() {
  const surf       = "PINEAPPLE";
  const hidn       = "PALM TREE";
  const INIT_GREEN = new Set([0, 4, 8]);
  const SEQ        = [2, 6];
  const size = 26; const gap = 2;
  const [selected, setSelected] = useState(null);
  const [revealed, setRevealed] = useState(new Set());

  useEffect(() => {
    const ids = []; let alive = true;
    function sched(fn, ms) { const id = setTimeout(() => { if (alive) fn(); }, ms); ids.push(id); }
    function run() {
      sched(() => setSelected(SEQ[0]), 600);
      sched(() => { setRevealed(s => new Set([...s, SEQ[0]])); setSelected(null); }, 1400);
      sched(() => setSelected(SEQ[1]), 2500);
      sched(() => { setRevealed(s => new Set([...s, SEQ[1]])); setSelected(null); }, 3300);
      sched(() => { setRevealed(new Set()); setSelected(null); }, 4700);
      sched(run, 5200);
    }
    sched(run, 700);
    return () => { alive = false; ids.forEach(clearTimeout); };
  }, []);

  return (
    <div style={{ display:"flex", gap, justifyContent:"center" }}>
      {surf.split("").map((ch, i) => {
        let state = "default";
        if (INIT_GREEN.has(i))   state = "shaded";
        else if (revealed.has(i)) state = "revealed";
        else if (selected === i)  state = "selected";
        return <MiniTile key={i} letter={ch} hiddenLetter={hidn[i]} state={state} size={size}/>;
      })}
    </div>
  );
}

function Tile({ tile, isSelected, onClick, size, isWinFlipping, flipIdx, isLocked, conflictDir, showHidden, startAppearPending, startAnimating, revealStyle = "default" }) {
  const frozenLoss = showHidden && !tile.isShaded && !tile.isRevealed;
  const canClick = !tile.isShaded && !tile.isRevealed && !tile.isHintRevealed && !isLocked && !showHidden;

  // Oval shows when the hidden layer is exposed (revealed, shaded, or frozen post-loss)
  const isOval = !startAppearPending && (tile.isShaded || tile.isRevealed || frozenLoss);

  const conflictAnimStyle = conflictDir
    ? { animation: `${conflictDir === "y" ? "shakeY" : "shake"} 0.35s ease` }
    : {};

  // Oval color: green by default, neutral for give-up or frozen reveals
  const ovalGreen = revealStyle !== "neutral" && !frozenLoss;
  const ovalBg     = ovalGreen ? "var(--bg-tile-shaded)"    : "var(--bg-tile-default)";
  const ovalBorder = ovalGreen ? "var(--border-tile-shaded)" : "var(--border-tile-default)";
  const ovalColor  = ovalGreen ? "var(--color-tile-shaded)"  : "var(--color-tile-default)";

  const hiddenLetterDisplay = tile.hiddenLetter === " " ? "" : tile.hiddenLetter;
  const surfaceLetter = (!isOval || startAppearPending)
    ? (tile.surfaceLetter === " " ? "" : tile.surfaceLetter)
    : "";

  const T = "0.28s ease";

  return (
    <div style={{ position: "relative", width: size, height: size * 1.15, flexShrink: 0, ...conflictAnimStyle }}>

      {/* Oval layer — hidden phrase, always underneath */}
      <div style={{
        position: "absolute", inset: "-2px", borderRadius: "50%",
        background: ovalBg, border: `1.5px solid ${ovalBorder}`, color: ovalColor,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'DM Mono',monospace", fontSize: size * 0.42, fontWeight: 500,
        userSelect: "none",
        opacity: isOval ? 1 : 0,
        transform: isOval ? "scale(1)" : "scale(0.65)",
        transition: `opacity ${T}, transform ${T}`,
      }}>
        {hiddenLetterDisplay}
      </div>

      {/* Surface layer — visible phrase, slides up and fades on reveal */}
      <div
        onClick={!tile.isShaded && !tile.isRevealed && !tile.isHintRevealed ? onClick : undefined}
        className={canClick && !isSelected ? "tile-hover" : ""}
        style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          borderRadius: 4,
          background: isSelected ? "var(--bg-tile-selected)" : "var(--bg-tile-default)",
          border: `1.5px solid ${isSelected ? "var(--color-accent)" : "var(--border-tile-default)"}`,
          color: "var(--color-tile-default)",
          cursor: canClick ? "pointer" : "default",
          fontFamily: "'DM Mono',monospace", fontSize: size * 0.42, fontWeight: 500,
          userSelect: "none",
          boxShadow: isSelected ? "0 0 0 2px rgba(201,169,110,0.25)" : "none",
          transform: isOval ? "translateY(-38%) scale(0.78)" : isSelected ? "translateY(-3px)" : "none",
          opacity: isOval ? 0 : 1,
          pointerEvents: isOval ? "none" : undefined,
          transition: `transform ${T}, opacity ${T}, background 0.15s, border-color 0.15s, box-shadow 0.15s`,
        }}
      >
        {surfaceLetter}
      </div>
    </div>
  );
}

export default function App() {
  const [tiles, setTiles]             = useState(_initTiles);
  const [selected, setSelected]       = useState(null);
  const [guess, setGuess]             = useState(() => " ".repeat(TODAY_PUZZLE.hidden.length));
  const [focusedSlot, setFocusedSlot] = useState(null);
  const slotRefs                       = useRef({});
  const [wobble, setWobble]           = useState(false);
  const [won, setWon]                 = useState(false);
  const [lost, setLost]               = useState(false);
  const [finalScore, setFinalScore]   = useState(null);
  const [winFlipping, setWinFlipping] = useState(false);
  const [showHelp, setShowHelp]       = useState(() => !_hasInitProgress && !localStorage.getItem("pg_skip_intro"));
  const [helpPage, setHelpPage]       = useState(0);
  const [skipIntro, setSkipIntro]     = useState(() => !!localStorage.getItem("pg_skip_intro"));
  const [message, setMessage]         = useState("");
  const [started, setStarted]         = useState(_hasInitProgress);
  const [hintUsed, setHintUsed]         = useState(() => !!(_initProgress && _initProgress.h));
  const [shareCopied, setShareCopied]   = useState(false);
  const [conflictMap, setConflictMap]   = useState(new Map());
  const [dismissedWin, setDismissedWin]   = useState(false);
  const [dismissedLoss, setDismissedLoss] = useState(false);
  const [hardMode, setHardMode]           = useState(_initHardMode);
  const [startAppearSet,     setStartAppearSet]     = useState(() =>
    _hasInitProgress ? new Set(_initBaseTiles.filter(t => t.isShaded || t.isHintRevealed).map(t => t.id)) : new Set()
  );
  const [startAnimIds,       setStartAnimIds]       = useState(() =>
    _hasInitProgress ? new Set(_initBaseTiles.filter(t => t.isShaded || t.isHintRevealed).map(t => t.id)) : new Set()
  );
  const [startAnimatingSet,  setStartAnimatingSet]  = useState(new Set());
  const [gaveUp, setGaveUp]               = useState(false);
  const [gaveUpFlipping, setGaveUpFlipping] = useState(false);
  const [dismissedGaveUp, setDismissedGaveUp] = useState(false);
  const [showArchive, setShowArchive]     = useState(false);
  const [activePuzzle, setActivePuzzle]   = useState(null);
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "{}"); }
    catch { return {}; }
  });
  const [showStats, setShowStats] = useState(false);
  const [winRevealedSet,    setWinRevealedSet]    = useState(new Set());
  const [giveUpRevealedSet, setGiveUpRevealedSet] = useState(new Set());
  const [boardW,            setBoardW]            = useState(() => Math.min(window.innerWidth * 0.88, 560));

  useEffect(() => {
    let lastW = window.innerWidth;
    function onResize() {
      if (window.innerWidth !== lastW) {
        lastW = window.innerWidth;
        setBoardW(Math.min(window.innerWidth * 0.88, 560));
      }
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const pSurface = activePuzzle ? activePuzzle.surface : TODAY_PUZZLE.surface;
  const pHidden  = activePuzzle ? activePuzzle.hidden  : TODAY_PUZZLE.hidden;
  const pTitle   = activePuzzle ? activePuzzle.title   : TODAY_PUZZLE.title;
  const pDate    = formatDate(activePuzzle ? activePuzzle.date : ACTIVE_DATE);

  const { cols } = calcLayout(pSurface);
  const completeRows  = Math.floor(pSurface.length / cols);
  const revealBudget  = completeRows * 2;
  const flipTiles     = tiles.filter(t => !t.isShaded);
  const currentScore  = calcScore(tiles);
  const revealsLeft   = finalScore !== null ? revealBudget - finalScore : revealBudget - currentScore;

  const tileSize = Math.floor((boardW - GAP * (cols - 1)) / cols);

  const rows = [];
  for (let i = 0; i < tiles.length; i += cols) {
    rows.push(tiles.slice(i, i + cols));
  }

  // All unrevealed positions including hidden spaces — cursor flows through them uniformly
  const typeableSlotIds = tiles
    .filter(t => !t.isShaded && !t.isRevealed)
    .map(t => t.id);
  const GUESS_GAP = 2;
  const guessHPad = 4;
  const guessAvailW = boardW - GUESS_GAP * (pHidden.length - 1) - guessHPad * 2;
  const guessLetterW = Math.max(13, Math.floor(guessAvailW / pHidden.length));
  // Minimum 16px font prevents iOS Safari from auto-zooming on input focus,
  // which was causing the board to resize and the screen to re-center.
  const guessFontSize = Math.max(16, Math.round(guessLetterW * 0.72));

  function handleSlotChange(e, tileId) {
    const ch = e.target.value.toUpperCase().replace(/[^A-Z]/g, "") || " ";
    setGuess(prev => {
      const arr = prev.padEnd(pHidden.length, " ").split("");
      arr[tileId] = ch;
      return arr.join("");
    });
    if (ch !== " ") {
      const nextId = typeableSlotIds.find(id => id > tileId);
      if (nextId !== undefined) slotRefs.current[nextId]?.focus();
    }
  }

  function handleSlotKeyDown(e, tileId) {
    if (e.key === "Enter") { handleGuess(); return; }
    if (e.key === " ") {
      e.preventDefault();
      const nextId = typeableSlotIds.find(id => id > tileId);
      if (nextId !== undefined) slotRefs.current[nextId]?.focus();
      return;
    }
    if (e.key === "Backspace") {
      const filled = guess[tileId] && guess[tileId] !== " ";
      if (!filled) {
        e.preventDefault();
        const prevId = [...typeableSlotIds].reverse().find(id => id < tileId);
        if (prevId !== undefined) {
          setGuess(prev => {
            const arr = prev.padEnd(pHidden.length, " ").split("");
            arr[prevId] = " ";
            return arr.join("");
          });
          slotRefs.current[prevId]?.focus();
        }
      }
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prevId = [...typeableSlotIds].reverse().find(id => id < tileId);
      slotRefs.current[prevId]?.focus();
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const nextId = typeableSlotIds.find(id => id > tileId);
      slotRefs.current[nextId]?.focus();
    }
  }

  const blockStart = !!history[pDate];

  const histResults  = Object.values(history);
  const statsPlayed  = histResults.length;
  const statsWon     = histResults.filter(r => r.result === "won").length;
  const statsGaveUp  = histResults.filter(r => r.result === "gaveUp").length;
  const statsPerfect = histResults.filter(r => r.result === "won" && r.reveals === 0).length;
  const statsWonList = histResults.filter(r => r.result === "won");
  const statsMaxR    = statsWonList.length ? Math.max(...statsWonList.map(r => r.reveals)) : 0;
  const statsDist    = {};
  statsWonList.forEach(r => { statsDist[r.reveals] = (statsDist[r.reveals] || 0) + 1; });

  function handleTileClick(id) {
    if (won || lost || gaveUp || winFlipping || gaveUpFlipping) return;
    const adjacentRevealed = tiles.some(t =>
      (t.id === id - 1 || t.id === id + 1) && (t.isShaded || t.isRevealed)
    );
    if (adjacentRevealed) {
      const blockers = tiles.filter(t =>
        (t.id === id - 1 || t.id === id + 1) && (t.isShaded || t.isRevealed)
      );
      const map = new Map();
      for (const b of blockers) map.set(b.id, "x");
      map.set(id, "x");
      setConflictMap(map);
      setMessage("You cannot reveal consecutive tiles.");
      setTimeout(() => { setConflictMap(new Map()); setMessage(""); }, 500);
      return;
    }
    if (revealsLeft === 0) return;
    setSelected(prev => prev === id ? null : id);
  }

  function confirmReveal() {
    if (selected === null || won || lost || gaveUp || winFlipping || gaveUpFlipping || revealsLeft === 0) return;
    const revealedId = selected;
    setTiles(prev => prev.map(t => t.id === revealedId ? {...t, isRevealed: true} : t));
    const progressKey = activePuzzle ? activePuzzle.date : ACTIVE_DATE;
    const prev = readProgress(progressKey) || { r: [], h: hintUsed };
    writeProgress(progressKey, { ...prev, r: [...(prev.r || []), revealedId] });
    setSelected(null);
  }

  function useHint() {
    setTiles(prev => prev.map(t =>
      !t.isShaded && !t.isRevealed && t.hiddenLetter === " "
        ? { ...t, isRevealed: true, isHintRevealed: true }
        : t
    ));
    const progressKey = activePuzzle ? activePuzzle.date : ACTIVE_DATE;
    const prev = readProgress(progressKey) || { r: [] };
    writeProgress(progressKey, { ...prev, h: true });
    setHintUsed(true);
  }

  function handleGuess() {
    if (won || lost || gaveUp || winFlipping || gaveUpFlipping) return;
    const fullGuess = tiles.map(t => {
      if (t.hiddenLetter === " ") return " ";
      if (t.isShaded || t.isRevealed) return t.hiddenLetter;
      const ch = guess[t.id];
      return ch && ch !== " " ? ch : " ";
    }).join("");
    if (fullGuess === pHidden) {
      setFinalScore(currentScore);
      setWinFlipping(true);
      flipTiles.forEach((tile, flipIdx) => {
        setTimeout(() => {
          setTiles(prev => prev.map(t => t.id === tile.id ? {...t, isRevealed: true} : t));
          setWinRevealedSet(prev => new Set([...prev, tile.id]));
        }, flipIdx * 80 + 185);
      });
      setTimeout(() => { setWon(true); setWinFlipping(false); saveResult(pDate, "won", currentScore); }, flipTiles.length * 80 + 600);
    } else {
      setWobble(true);
      setMessage("Not quite…");
      setTimeout(() => { setWobble(false); setMessage(""); }, 1200);
      setGuess(" ".repeat(pHidden.length));
      const firstId = typeableSlotIds[0];
      if (firstId !== undefined) setTimeout(() => slotRefs.current[firstId]?.focus(), 0);
      return;
    }
    setGuess(" ".repeat(pHidden.length));
  }

  async function handleShare() {
    let text;
    const hardLine = hardMode ? "\nhard mode" : "";
    if (gaveUp) {
      text = `coverup — ${pDate}: "${pTitle}"\ndidn't get it${hardLine}\nhttps://coverup.fyi`;
    } else if (won) {
      const revealText = finalScore === 0 ? "zero reveals" : `${finalScore} reveal${finalScore !== 1 ? "s" : ""}`;
      const prefix = finalScore === 0 ? "perfect · " : "";
      const emojiLine = ("🟪".repeat(finalScore) + (hintUsed ? " 🟥 hint taken" : "")).trim();
      text = `coverup — ${pDate}: "${pTitle}"\n${prefix}${revealText}${emojiLine ? "\n" + emojiLine : ""}${hardLine}\nhttps://coverup.fyi`;
    } else {
      text = `coverup — ${pDate}: "${pTitle}"\nno luck${hintUsed ? "\n🟥 hint taken" : ""}${hardLine}\nhttps://coverup.fyi`;
    }
    if (navigator.share) {
      try { await navigator.share({ text }); } catch {}
    } else {
      await navigator.clipboard.writeText(text);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }
  }

  async function handleShareFromHistory() {
    const h = history[pDate];
    if (!h) return;
    const hardLine = h.hardMode ? "\nhard mode" : "";
    let text;
    if (h.result === "gaveUp") {
      text = `coverup — ${pDate}: "${pTitle}"\ndidn't get it${hardLine}\nhttps://coverup.fyi`;
    } else {
      const revealText = h.reveals === 0 ? "zero reveals" : `${h.reveals} reveal${h.reveals !== 1 ? "s" : ""}`;
      const prefix = h.reveals === 0 ? "perfect · " : "";
      const emojiLine = ("🟪".repeat(h.reveals) + (h.hintUsed ? " 🟥 hint taken" : "")).trim();
      text = `coverup — ${pDate}: "${pTitle}"\n${prefix}${revealText}${emojiLine ? "\n" + emojiLine : ""}${hardLine}\nhttps://coverup.fyi`;
    }
    if (navigator.share) {
      try { await navigator.share({ text }); } catch {}
    } else {
      await navigator.clipboard.writeText(text);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }
  }

  function reset() {
    setTiles(buildTiles(TODAY_PUZZLE.surface, TODAY_PUZZLE.hidden, hardMode));
    setSelected(null); setGuess(" ".repeat(TODAY_PUZZLE.hidden.length)); setFinalScore(null);
    setWobble(false); setWon(false); setLost(false);
    setWinFlipping(false); setMessage(""); setStarted(false); setHintUsed(false); setConflictMap(new Map());
    setDismissedWin(false); setDismissedLoss(false);
    setStartAppearSet(new Set()); setStartAnimatingSet(new Set()); setStartAnimIds(new Set());
    setGaveUp(false); setGaveUpFlipping(false); setDismissedGaveUp(false);
    setShowArchive(false); setActivePuzzle(null);
    setWinRevealedSet(new Set()); setGiveUpRevealedSet(new Set());
  }

  function toggleHardMode() {
    if (started) return;
    const newMode = !hardMode;
    setHardMode(newMode);
    if (newMode) localStorage.setItem(HARD_MODE_KEY, "1");
    else localStorage.removeItem(HARD_MODE_KEY);
    setTiles(buildTiles(pSurface, pHidden, newMode));
  }

  function toggleSkipIntro() {
    const next = !skipIntro;
    setSkipIntro(next);
    if (next) { localStorage.setItem("pg_skip_intro", "1"); }
    else       { localStorage.removeItem("pg_skip_intro"); }
  }

  function saveResult(date, result, reveals) {
    clearProgress(activePuzzle ? activePuzzle.date : ACTIVE_DATE);
    setHistory(prev => {
      const updated = { ...prev, [date]: { result, reveals, hardMode, hintUsed } };
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });
  }

  function handleGiveUp() {
    if (won || lost || gaveUp || winFlipping || gaveUpFlipping) return;
    setFinalScore(currentScore);
    setGaveUpFlipping(true);
    flipTiles.forEach((tile, flipIdx) => {
      setTimeout(() => {
        setTiles(prev => prev.map(t => t.id === tile.id ? {...t, isRevealed: true} : t));
        setGiveUpRevealedSet(prev => new Set([...prev, tile.id]));
      }, flipIdx * 80 + 185);
    });
    setTimeout(() => { setGaveUp(true); setGaveUpFlipping(false); saveResult(pDate, "gaveUp", currentScore); }, flipTiles.length * 80 + 600);
  }

  function playArchivePuzzle(entry) {
    const surf = entry ? entry.surface : TODAY_PUZZLE.surface;
    const hidn = entry ? entry.hidden  : TODAY_PUZZLE.hidden;
    const dateKey = entry ? entry.date : ACTIVE_DATE;
    const savedHardMode = !!localStorage.getItem(HARD_MODE_KEY);
    const progress = readProgress(dateKey);
    const baseTiles = buildTiles(surf, hidn, savedHardMode);
    const restoredTiles = applyProgress(baseTiles, progress);
    const hasProgress = !!progress;
    setActivePuzzle(entry);
    setHardMode(savedHardMode);
    setTiles(restoredTiles);
    setSelected(null); setGuess(" ".repeat(hidn.length)); setFinalScore(null);
    setWobble(false); setWon(false); setLost(false);
    setWinFlipping(false); setMessage("");
    setStarted(hasProgress); setHintUsed(!!(progress && progress.h)); setConflictMap(new Map());
    setDismissedWin(false); setDismissedLoss(false);
    const startSet = hasProgress ? new Set(baseTiles.filter(t => t.isShaded || t.isHintRevealed).map(t => t.id)) : new Set();
    setStartAppearSet(startSet); setStartAnimIds(startSet);
    setStartAnimatingSet(new Set());
    setGaveUp(false); setGaveUpFlipping(false); setDismissedGaveUp(false);
    setShowArchive(false); setShowHelp(false); setHelpPage(0);
    setWinRevealedSet(new Set()); setGiveUpRevealedSet(new Set());
  }

  function startGame() {
    setStarted(true);
    const revealOrder = tiles
      .filter(t => t.isShaded || t.isHintRevealed)
      .sort((a, b) => a.id - b.id)
      .map(t => t.id);
    setStartAnimIds(new Set(revealOrder));
    revealOrder.forEach((id, idx) => {
      const delay = idx * 600;
      setTimeout(() => setStartAnimatingSet(prev => new Set([...prev, id])), delay);
      setTimeout(() => setStartAppearSet(prev => new Set([...prev, id])), delay + 160);
      setTimeout(() => setStartAnimatingSet(prev => { const s = new Set(prev); s.delete(id); return s; }), delay + 400);
    });
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@300;400;500&display=swap');
        :root {
          --bg-page: #faf9f6;
          --bg-tile-shaded-space: #d0ebd0;
          --bg-tile-shaded: #ddf0dd;
          --border-tile-shaded: #7abd7a;
          --color-tile-shaded: #2a6e2a;
          --bg-tile-revealed-space: #d8d8f0;
          --bg-tile-revealed: #e4e4f8;
          --border-tile-revealed: #9999cc;
          --color-tile-revealed: #4444aa;
          --bg-tile-selected: #fdf5e6;
          --bg-tile-default: #eeebe4;
          --border-tile-default: #c4c0b8;
          --color-tile-default: #1a1a1a;
          --color-accent: #c9a96e;
          --color-page-title: #1a1a1a;
          --color-dim: #aaaaaa;
          --bg-modal: #ffffff;
          --border-modal: #e0ddd8;
          --color-modal-text: #444444;
          --bg-input: #eeebe4;
          --border-input: #c4c0b8;
          --color-input: #1a1a1a;
          --border-inactive: #e0ddd8;
          --color-inactive: #cccccc;
          --piechart-track: #e0ddd8;
          --color-error: #994444;
          --color-lose: #aa3333;
          --bg-help-btn: #eeebe4;
          --color-legend: #aaaaaa;
          --bg-overlay: rgba(0,0,0,0.45);
          --color-score-label: #999999;
          --color-secondary-btn: #aaaaaa;
          --border-secondary-btn: #e0ddd8;
          --color-subtitle: #aaaaaa;
          --bg-primary-btn-text: #faf9f6;
        }
        @media (prefers-color-scheme: dark) {
          :root {
            --bg-page: #0e0e0f;
            --bg-tile-shaded-space: #1a221a;
            --bg-tile-shaded: #1e2a1e;
            --border-tile-shaded: #2d4a2d;
            --color-tile-shaded: #6dbf6d;
            --bg-tile-revealed-space: #161620;
            --bg-tile-revealed: #1a1a2e;
            --border-tile-revealed: #2d2d55;
            --color-tile-revealed: #8888ff;
            --bg-tile-selected: #221f16;
            --bg-tile-default: #1c1c1e;
            --border-tile-default: #3a3a3f;
            --color-tile-default: #e8e2d6;
            --color-accent: #c9a96e;
            --color-page-title: #f0ece4;
            --color-dim: #777777;
            --bg-modal: #161618;
            --border-modal: #2e2e32;
            --color-modal-text: #aaaaaa;
            --bg-input: #1c1c1e;
            --border-input: #2e2e32;
            --color-input: #f0ece4;
            --border-inactive: #505058;
            --color-inactive: #606068;
            --piechart-track: #2e2e32;
            --color-error: #884444;
            --color-lose: #884444;
            --bg-help-btn: #1c1c1e;
            --color-legend: #3a3a3f;
            --bg-overlay: rgba(0,0,0,0.75);
            --color-score-label: #888888;
            --color-secondary-btn: #555555;
            --border-secondary-btn: #2e2e32;
            --color-subtitle: #444444;
            --bg-primary-btn-text: #0e0e0f;
          }
        }
        *,*::before,*::after { box-sizing:border-box; margin:0; padding:0; }
        html,body { width:100%; overflow-x:hidden; background:var(--bg-page); }
        body { display:flex; justify-content:center; font-family:'DM Mono',monospace; }
        @keyframes wobble {
          0%,100%{transform:translateX(0)} 15%{transform:translateX(-8px)}
          30%{transform:translateX(8px)} 45%{transform:translateX(-5px)}
          60%{transform:translateX(5px)} 75%{transform:translateX(-3px)} 90%{transform:translateX(3px)}
        }
        @keyframes shake {
          0%,100%{transform:translateX(0)} 25%{transform:translateX(-4px)}
          75%{transform:translateX(4px)}
        }
        @keyframes shakeY {
          0%,100%{transform:translateY(0)} 25%{transform:translateY(-4px)}
          75%{transform:translateY(4px)}
        }
        @keyframes flipIn {
          0%{transform:rotateY(0)} 40%{transform:rotateY(90deg)}
          41%{transform:rotateY(-90deg)} 100%{transform:rotateY(0)}
        }
        @keyframes fadeUp {
          from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)}
        }
        @keyframes demoSlideUnder {
          0%    { transform:translateY(0);    opacity:1; }
          28%   { transform:translateY(0);    opacity:1; }
          52%   { transform:translateY(-34px);opacity:1; }
          67%   { transform:translateY(-34px);opacity:1; }
          68%   { transform:translateY(-34px);opacity:0; }
          69%   { transform:translateY(0);    opacity:0; }
          85%   { transform:translateY(0);    opacity:0; }
          100%  { transform:translateY(0);    opacity:1; }
        }
        @keyframes demoBlink {
          50% { opacity:0; }
        }
        .tile-hover:hover {
          border-color:#c9a96e!important;
          transform:translateY(-2px)!important;
          box-shadow:0 4px 16px rgba(201,169,110,0.15)!important;
        }
        .guess-slot::placeholder { color: var(--border-tile-default); }
      `}</style>

      <div style={{
        display:"flex", flexDirection:"column", alignItems:"center",
        gap:"1.4rem", padding:"2rem 0", width:"100%", maxWidth:600,
      }}>

        {/* Header */}
        {!started ? (
          <div style={{textAlign:"center", padding:"0 1rem"}}>
            <div style={{fontFamily:"'DM Serif Display',serif",fontSize:"clamp(1.8rem,8vw,2.6rem)",fontWeight:900,fontStyle:"italic",color:"var(--color-page-title)",lineHeight:1,marginBottom:"0.5rem"}}>
              coverup
            </div>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:"clamp(1rem,4.5vw,1.5rem)",fontWeight:500,color:"var(--color-accent)",lineHeight:1.2,letterSpacing:"0.02em"}}>
              {pDate}: "{pTitle}"
            </div>
          </div>
        ) : (
          <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",width: tileSize * cols + GAP * (cols - 1)}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:"clamp(0.72rem,3.2vw,0.9rem)",fontWeight:500,color:"var(--color-accent)",letterSpacing:"0.02em",flexShrink:1,minWidth:0}}>
              {pDate}: "{pTitle}"
            </div>
            <div style={{fontFamily:"'DM Serif Display',serif",fontSize:"clamp(0.72rem,3.2vw,0.9rem)",fontWeight:900,fontStyle:"italic",color:"var(--color-page-title)",opacity:0.45,userSelect:"none",flexShrink:0,marginLeft:"1rem"}}>
              coverup
            </div>
          </div>
        )}

        {/* Pre-game: phrase in tile form */}
        {!started && !showHelp && (
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"2rem",animation:"fadeUp 0.4s ease both",padding:"0 1rem"}}>
            <div style={{display:"flex",flexWrap:"wrap",gap:"8px 10px",justifyContent:"center"}}>
              {pSurface.split(" ").map((word, wi) => (
                <div key={wi} style={{display:"flex",gap:4,flexShrink:0}}>
                  {word.split("").map((ch, ci) => (
                    <MiniTile key={ci} letter={ch} state="default" size={34}/>
                  ))}
                </div>
              ))}
            </div>
            {blockStart ? (
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"0.75rem",textAlign:"center"}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:"0.6rem",letterSpacing:"0.12em",textTransform:"uppercase",color:"var(--color-dim)"}}>
                  {!activePuzzle ? "you've already played today" : "you've already played this one"}
                </div>
                <div style={{fontFamily:"'DM Serif Display',serif",fontSize:"2rem",fontWeight:900,fontStyle:"italic",lineHeight:1,color: history[pDate].result === "won" ? "var(--color-accent)" : "var(--color-lose)"}}>
                  {history[pDate].result === "won"
                    ? (history[pDate].reveals === 0 ? "perfect" : `${history[pDate].reveals} reveal${history[pDate].reveals !== 1 ? "s" : ""}`)
                    : "didn't get it"}
                </div>
                {!activePuzzle && (
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:"0.6rem",letterSpacing:"0.1em",color:"var(--color-dim)"}}>
                    come back tomorrow for a new one
                  </div>
                )}
                <button onClick={handleShareFromHistory} style={{background:"var(--color-accent)",border:"none",color:"var(--bg-primary-btn-text)",fontFamily:"'DM Mono',monospace",fontSize:"0.7rem",letterSpacing:"0.2em",textTransform:"uppercase",padding:"0.8rem 2.4rem",borderRadius:3,cursor:"pointer",fontWeight:500,marginTop:"0.25rem",transition:"opacity 0.15s"}} onMouseEnter={e=>e.currentTarget.style.opacity="0.85"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
                  {shareCopied ? "Copied!" : "Share result"}
                </button>
                <button onClick={() => setShowStats(true)} style={{background:"transparent",border:"1.5px solid var(--border-secondary-btn)",color:"var(--color-secondary-btn)",fontFamily:"'DM Mono',monospace",fontSize:"0.65rem",letterSpacing:"0.2em",textTransform:"uppercase",padding:"0.7rem 1.8rem",borderRadius:3,cursor:"pointer"}}>
                  My stats
                </button>
                <button onClick={() => setShowArchive(true)} style={{background:"transparent",border:"1.5px solid var(--border-secondary-btn)",color:"var(--color-secondary-btn)",fontFamily:"'DM Mono',monospace",fontSize:"0.65rem",letterSpacing:"0.2em",textTransform:"uppercase",padding:"0.7rem 1.8rem",borderRadius:3,cursor:"pointer"}}>
                  Play archive
                </button>
              </div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"0.75rem"}}>
                <div
                  onClick={toggleHardMode}
                  title="In hard mode, spaces aren't revealed."
                  style={{display:"flex",alignItems:"center",gap:"0.55rem",cursor:"pointer",userSelect:"none"}}
                >
                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:"0.6rem",letterSpacing:"0.12em",textTransform:"uppercase",color:hardMode?"#d63030":"var(--color-score-label)",transition:"color 0.2s"}}>Hard mode</span>
                  <div style={{width:38,height:20,borderRadius:10,background:hardMode?"#d63030":"var(--border-tile-default)",position:"relative",transition:"background 0.2s",flexShrink:0}}>
                    <div style={{position:"absolute",top:3,left:hardMode?20:3,width:14,height:14,borderRadius:"50%",background:"#fff",transition:"left 0.2s",boxShadow:"0 1px 2px rgba(0,0,0,0.25)"}}/>
                  </div>
                </div>
                <button
                  onClick={startGame}
                  style={{
                    background:"var(--color-accent)", border:"none", color:"var(--bg-primary-btn-text)",
                    fontFamily:"'DM Mono',monospace", fontSize:"0.7rem",
                    letterSpacing:"0.2em", textTransform:"uppercase",
                    padding:"0.8rem 2.4rem", borderRadius:3, cursor:"pointer",
                    fontWeight:500,
                  }}
                >
                  Start game
                </button>
                {hardMode && (
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:"0.6rem",letterSpacing:"0.08em",color:"#d63030",animation:"fadeUp 0.25s ease both"}}>
                    In hard mode, spaces are not revealed.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Score */}
        {started && !won && !lost && !gaveUp && (
          <div style={{display:"flex",alignItems:"center",width: tileSize * cols + GAP * (cols - 1)}}>
            <div style={{display:"flex",alignItems:"center",gap:"1.6rem"}}>
              <div style={{display:"flex",alignItems:"center",gap:"0.5rem",fontSize:"0.72rem",letterSpacing:"0.18em",color:"var(--color-score-label)",textTransform:"uppercase"}}>
                Reveals left: <span style={{fontFamily:"'Playfair Display'",fontSize:"1.3rem",fontWeight:700,color:"var(--color-accent)",letterSpacing:0}}>{revealsLeft}</span>
              </div>
            </div>
          </div>
        )}

        {/* Board */}
        {started && (
        <div style={{
          display:"flex", flexDirection:"column", alignItems:"flex-start",
          gap: GAP, width: tileSize * cols + GAP * (cols - 1),
          animation: wobble ? "wobble 0.55s ease" : "none",
        }}>
          {rows.map((row, ri) => (
            <div key={ri} style={{display:"flex", gap: GAP}}>
              {row.map(tile => (
                <Tile
                  key={tile.id}
                  tile={tile}
                  isSelected={selected === tile.id}
                  onClick={() => handleTileClick(tile.id)}
                  size={tileSize}
                  isWinFlipping={winFlipping || gaveUpFlipping}
                  flipIdx={(winFlipping || gaveUpFlipping) ? flipTiles.findIndex(t => t.id === tile.id) : 0}
                  revealStyle={winRevealedSet.has(tile.id) ? "green" : giveUpRevealedSet.has(tile.id) ? "neutral" : "default"}
                  conflictDir={conflictMap.get(tile.id) || null}
                  isLocked={revealsLeft === 0 || tiles.some(t => (t.id === tile.id - 1 || t.id === tile.id + 1) && (t.isShaded || t.isRevealed))}
                  showHidden={(lost && dismissedLoss) || (gaveUp && dismissedGaveUp)}
                  startAppearPending={(tile.isShaded || tile.isHintRevealed) && !startAppearSet.has(tile.id)}
                  startAnimating={startAnimatingSet.has(tile.id)}
                />
              ))}
            </div>
          ))}
        </div>
        )}

        {/* Reveal button */}
        {started && !won && !lost && !gaveUp && (
          <button onClick={confirmReveal} disabled={selected===null||winFlipping} style={{
            background:"transparent",
            border:`1.5px solid ${selected!==null?"var(--color-accent)":"var(--border-inactive)"}`,
            color:selected!==null?"var(--color-accent)":"var(--color-inactive)",
            fontFamily:"'DM Mono',monospace", fontSize:"0.65rem",
            letterSpacing:"0.2em", textTransform:"uppercase",
            padding:"0.55rem 1.6rem", borderRadius:3,
            cursor:selected!==null?"pointer":"default", transition:"all 0.15s",
          }}>
            {selected!==null ? "↓ Reveal selected tile" : "Select a tile to reveal"}
          </button>
        )}


{/* Guess input */}
        {started && !won && !lost && !gaveUp && (
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"0.5rem",width: tileSize * cols + GAP * (cols - 1)}}>
            {/* Guess block: full phrase on one line, click any blank to type there */}
            <div style={{position:"relative",width:"100%"}}>
              <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
              <div style={{minWidth:"100%",width:"max-content",background:"var(--bg-input)",border:`1.5px solid var(--border-input)`,borderRadius:3,padding:`0.65rem ${guessHPad}px`,display:"flex",gap:GUESS_GAP,alignItems:"center"}}>
                {tiles.map(tile => {
                  const isRev = tile.isShaded || tile.isRevealed;
                  // "appeared" = tile has finished its start animation (or was revealed mid-game, not via start anim)
                  const appeared = !startAnimIds.has(tile.id) || startAppearSet.has(tile.id);

                  // Revealed but waiting for start animation: show blank underscore
                  if (isRev && !appeared) {
                    return <div key={tile.id} style={{width:guessLetterW,flexShrink:0,paddingBottom:2,borderBottom:`1.5px solid var(--border-tile-default)`,textAlign:"center",fontFamily:"'DM Mono',monospace",fontSize:guessFontSize,color:"var(--border-tile-default)",userSelect:"none"}}>_</div>;
                  }

                  if (tile.hiddenLetter === " ") {
                    if (isRev) return <div key={tile.id} style={{width:guessLetterW,flexShrink:0}}/>;
                    // Unrevealed space in hard mode: fully typeable — handleGuess ignores the value
                  }
                  const ch = isRev ? tile.hiddenLetter : (guess[tile.id] && guess[tile.id] !== " " ? guess[tile.id] : "");
                  const green = winFlipping;
                  const borderCol = green ? "var(--border-tile-shaded)"
                    : isRev ? "var(--color-dim)"
                    : ch ? "var(--color-accent)"
                    : focusedSlot === tile.id ? "var(--color-accent)"
                    : "var(--border-tile-default)";
                  const textCol = green ? "var(--border-tile-shaded)"
                    : isRev ? "var(--color-dim)"
                    : "var(--color-accent)";
                  if (isRev) {
                    return (
                      <div key={tile.id} style={{width:guessLetterW,flexShrink:0,paddingBottom:2,borderBottom:`1.5px solid ${borderCol}`,textAlign:"center",fontFamily:"'DM Mono',monospace",fontSize:guessFontSize,fontWeight:500,color:textCol,userSelect:"none"}}>
                        {ch}
                      </div>
                    );
                  }
                  return (
                    <input
                      key={tile.id}
                      ref={el => { slotRefs.current[tile.id] = el; }}
                      className="guess-slot"
                      type="text"
                      maxLength={1}
                      value={ch}
                      disabled={winFlipping}
                      placeholder="_"
                      autoCapitalize="characters"
                      autoCorrect="off"
                      autoComplete="off"
                      spellCheck={false}
                      onChange={e => handleSlotChange(e, tile.id)}
                      onKeyDown={e => handleSlotKeyDown(e, tile.id)}
                      onFocus={e => { e.target.select(); setFocusedSlot(tile.id); }}
                      onBlur={() => setFocusedSlot(null)}
                      style={{width:guessLetterW,flexShrink:0,border:"none",borderBottom:`1.5px solid ${borderCol}`,borderRadius:0,background:"transparent",textAlign:"center",fontFamily:"'DM Mono',monospace",fontSize:guessFontSize,fontWeight:500,color:textCol,outline:"none",cursor:"text",padding:"0 0 2px"}}
                    />
                  );
                })}
              </div>
              </div>
              {winFlipping && (
                <div style={{position:"absolute",right:-28,top:"50%",transform:"translateY(-50%)",fontSize:"1.1rem",color:"var(--border-tile-shaded)",fontWeight:700,pointerEvents:"none"}}>✓</div>
              )}
            </div>
            <button onClick={handleGuess} disabled={winFlipping} style={{background:"var(--color-accent)",border:"none",color:"var(--bg-primary-btn-text)",fontFamily:"'DM Mono',monospace",fontSize:"0.65rem",letterSpacing:"0.15em",textTransform:"uppercase",padding:"0.65rem 1.2rem",borderRadius:3,cursor:"pointer",fontWeight:500}}>
              Guess
            </button>
            <div style={{fontSize:"0.65rem",letterSpacing:"0.1em",color:"var(--color-error)",height:"1rem"}}>{message}</div>
            <button onClick={handleGiveUp} style={{background:"transparent",border:`1.5px solid var(--border-secondary-btn)`,color:"var(--color-secondary-btn)",fontFamily:"'DM Mono',monospace",fontSize:"0.6rem",letterSpacing:"0.15em",textTransform:"uppercase",padding:"0.5rem 1.2rem",borderRadius:3,cursor:"pointer",fontWeight:500}}>
              I give up
            </button>
          </div>
        )}


        {/* Play archive button after dismissed popup */}
        {((won && dismissedWin) || (lost && dismissedLoss) || (gaveUp && dismissedGaveUp)) && (
          <button onClick={() => setShowArchive(true)} style={{background:"transparent",border:`1.5px solid var(--border-secondary-btn)`,color:"var(--color-secondary-btn)",fontFamily:"'DM Mono',monospace",fontSize:"0.6rem",letterSpacing:"0.2em",textTransform:"uppercase",padding:"0.5rem 1.4rem",borderRadius:3,cursor:"pointer",animation:"fadeUp 0.3s ease both"}}>
            Play archive
          </button>
        )}

        {/* ? button */}
        {started && (
          <button onClick={()=>setShowHelp(true)} style={{position:"fixed",bottom:"1.4rem",right:"1.4rem",width:38,height:38,borderRadius:"50%",background:"var(--bg-help-btn)",border:"1.5px solid var(--color-accent)",color:"var(--color-accent)",fontFamily:"'DM Mono',monospace",fontSize:"0.85rem",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 0 4px rgba(201,169,110,0.08)",transition:"box-shadow 0.15s"}} onMouseEnter={e=>e.currentTarget.style.boxShadow="0 0 0 6px rgba(201,169,110,0.18)"} onMouseLeave={e=>e.currentTarget.style.boxShadow="0 0 0 4px rgba(201,169,110,0.08)"}>?</button>
        )}

        {/* Loss popup */}
        {lost && !dismissedLoss && (
          <div onClick={() => setDismissedLoss(true)} style={{position:"fixed",inset:0,background:"var(--bg-overlay)",display:"flex",alignItems:"center",justifyContent:"center",padding:"1.5rem",zIndex:100,cursor:"pointer"}}>
            <div onClick={e => e.stopPropagation()} style={{background:"var(--bg-modal)",border:`1.5px solid var(--border-modal)`,borderRadius:8,padding:"2.4rem 2rem",maxWidth:300,width:"100%",display:"flex",flexDirection:"column",alignItems:"center",gap:"0.8rem",textAlign:"center",animation:"fadeUp 0.35s ease both"}}>
              <div style={{fontFamily:"'DM Serif Display',serif",fontSize:"0.95rem",fontStyle:"italic",color:"var(--color-dim)"}}>No more guesses.</div>
              <div style={{fontSize:"0.6rem",letterSpacing:"0.18em",color:"var(--color-dim)",textTransform:"uppercase"}}>The answer was</div>
              <div style={{fontFamily:"'DM Serif Display',serif",fontSize:"1.6rem",fontWeight:700,fontStyle:"italic",color:"var(--color-lose)",letterSpacing:"0.02em",lineHeight:1.2}}>
                {pHidden}
              </div>
              {hintUsed && (
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:"0.6rem",letterSpacing:"0.12em",textTransform:"uppercase",color:"var(--color-dim)"}}>
                  hint taken
                </div>
              )}
              <div style={{display:"flex",flexDirection:"column",gap:"0.5rem",marginTop:"0.6rem",width:"100%"}}>
                <button onClick={handleShare} style={{background:"var(--color-accent)",border:"none",color:"var(--bg-primary-btn-text)",fontFamily:"'DM Mono',monospace",fontSize:"0.65rem",letterSpacing:"0.2em",textTransform:"uppercase",padding:"0.75rem 1.4rem",borderRadius:3,cursor:"pointer",fontWeight:500,transition:"opacity 0.15s"}} onMouseEnter={e=>e.currentTarget.style.opacity="0.85"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
                  {shareCopied ? "Copied!" : "Share result"}
                </button>
                <button onClick={() => setShowArchive(true)} style={{background:"transparent",border:"1.5px solid var(--border-secondary-btn)",color:"var(--color-secondary-btn)",fontFamily:"'DM Mono',monospace",fontSize:"0.65rem",letterSpacing:"0.2em",textTransform:"uppercase",padding:"0.7rem 1.4rem",borderRadius:3,cursor:"pointer",fontWeight:500,transition:"all 0.15s"}}>
                  Play archive
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Win popup */}
        {won && finalScore !== null && !dismissedWin && (
          <div onClick={() => setDismissedWin(true)} style={{position:"fixed",inset:0,background:"var(--bg-overlay)",display:"flex",alignItems:"center",justifyContent:"center",padding:"1.5rem",zIndex:100,cursor:"pointer"}}>
            <div onClick={e => e.stopPropagation()} style={{background:"var(--bg-modal)",border:`1.5px solid var(--border-modal)`,borderRadius:8,padding:"2.4rem 2rem",maxWidth:300,width:"100%",display:"flex",flexDirection:"column",alignItems:"center",gap:"0.8rem",textAlign:"center",animation:"fadeUp 0.35s ease both"}}>
              <div style={{fontFamily:"'DM Serif Display',serif",fontSize:"0.95rem",fontStyle:"italic",color:"var(--color-dim)"}}>
                You got it!
              </div>
              <div style={{fontFamily:"'DM Serif Display',serif",fontSize:"3.2rem",fontWeight:900,fontStyle:"italic",color:"var(--color-accent)",lineHeight:1,letterSpacing:"-0.01em"}}>
                {getRating(finalScore)}
              </div>
              <div style={{fontFamily:"'DM Serif Display',serif",fontSize:"1.4rem",fontWeight:700,color:"var(--color-page-title)",letterSpacing:"0.02em"}}>
                {finalScore === 0 ? "zero reveals" : `${finalScore} reveal${finalScore !== 1 ? "s" : ""}`}
              </div>
              {hintUsed && (
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:"0.6rem",letterSpacing:"0.12em",textTransform:"uppercase",color:"var(--color-dim)"}}>
                  hint taken
                </div>
              )}
              <div style={{display:"flex",flexDirection:"column",gap:"0.5rem",marginTop:"0.6rem",width:"100%"}}>
                <button onClick={handleShare} style={{background:"var(--color-accent)",border:"none",color:"var(--bg-primary-btn-text)",fontFamily:"'DM Mono',monospace",fontSize:"0.65rem",letterSpacing:"0.2em",textTransform:"uppercase",padding:"0.75rem 1.4rem",borderRadius:3,cursor:"pointer",fontWeight:500,transition:"opacity 0.15s"}} onMouseEnter={e=>e.currentTarget.style.opacity="0.85"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
                  {shareCopied ? "Copied!" : "Share result"}
                </button>
                <button onClick={() => setShowArchive(true)} style={{background:"transparent",border:"1.5px solid var(--border-secondary-btn)",color:"var(--color-secondary-btn)",fontFamily:"'DM Mono',monospace",fontSize:"0.65rem",letterSpacing:"0.2em",textTransform:"uppercase",padding:"0.7rem 1.4rem",borderRadius:3,cursor:"pointer",fontWeight:500,transition:"all 0.15s"}}>
                  Play archive
                </button>
                <button onClick={() => setShowStats(true)} style={{background:"transparent",border:"none",color:"var(--color-dim)",fontFamily:"'DM Mono',monospace",fontSize:"0.6rem",letterSpacing:"0.12em",textTransform:"uppercase",padding:"0.3rem",cursor:"pointer"}}>
                  My stats
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Gave-up popup */}
        {gaveUp && !dismissedGaveUp && (
          <div onClick={() => setDismissedGaveUp(true)} style={{position:"fixed",inset:0,background:"var(--bg-overlay)",display:"flex",alignItems:"center",justifyContent:"center",padding:"1.5rem",zIndex:100,cursor:"pointer"}}>
            <div onClick={e => e.stopPropagation()} style={{background:"var(--bg-modal)",border:`1.5px solid var(--border-modal)`,borderRadius:8,padding:"2.4rem 2rem",maxWidth:300,width:"100%",display:"flex",flexDirection:"column",alignItems:"center",gap:"0.8rem",textAlign:"center",animation:"fadeUp 0.35s ease both"}}>
              <div style={{fontFamily:"'DM Serif Display',serif",fontSize:"0.95rem",fontStyle:"italic",color:"var(--color-dim)"}}>not your day</div>
              <div style={{fontFamily:"'DM Serif Display',serif",fontSize:"3.2rem",fontWeight:900,fontStyle:"italic",color:"var(--color-lose)",lineHeight:1,letterSpacing:"-0.01em"}}>
                didn't get it
              </div>
              <div style={{fontSize:"0.6rem",letterSpacing:"0.18em",color:"var(--color-dim)",textTransform:"uppercase"}}>The answer was</div>
              <div style={{fontFamily:"'DM Serif Display',serif",fontSize:"1.4rem",fontWeight:700,fontStyle:"italic",color:"var(--color-page-title)",letterSpacing:"0.02em",lineHeight:1.2}}>
                {pHidden}
              </div>
              {hintUsed && (
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:"0.6rem",letterSpacing:"0.12em",textTransform:"uppercase",color:"var(--color-dim)"}}>hint taken</div>
              )}
              <div style={{display:"flex",flexDirection:"column",gap:"0.5rem",marginTop:"0.6rem",width:"100%"}}>
                <button onClick={handleShare} style={{background:"var(--color-accent)",border:"none",color:"var(--bg-primary-btn-text)",fontFamily:"'DM Mono',monospace",fontSize:"0.65rem",letterSpacing:"0.2em",textTransform:"uppercase",padding:"0.75rem 1.4rem",borderRadius:3,cursor:"pointer",fontWeight:500,transition:"opacity 0.15s"}} onMouseEnter={e=>e.currentTarget.style.opacity="0.85"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
                  {shareCopied ? "Copied!" : "Share result"}
                </button>
                <button onClick={() => { setDismissedGaveUp(true); setShowArchive(true); }} style={{background:"transparent",border:"1.5px solid var(--border-secondary-btn)",color:"var(--color-secondary-btn)",fontFamily:"'DM Mono',monospace",fontSize:"0.65rem",letterSpacing:"0.2em",textTransform:"uppercase",padding:"0.7rem 1.4rem",borderRadius:3,cursor:"pointer",fontWeight:500,transition:"all 0.15s"}}>
                  Play archive
                </button>
                <button onClick={() => setShowStats(true)} style={{background:"transparent",border:"none",color:"var(--color-dim)",fontFamily:"'DM Mono',monospace",fontSize:"0.6rem",letterSpacing:"0.12em",textTransform:"uppercase",padding:"0.3rem",cursor:"pointer"}}>
                  My stats
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stats modal */}
        {showStats && (
          <div onClick={() => setShowStats(false)} style={{position:"fixed",inset:0,background:"var(--bg-overlay)",display:"flex",alignItems:"center",justifyContent:"center",padding:"1.5rem",zIndex:110}}>
            <div onClick={e => e.stopPropagation()} style={{background:"var(--bg-modal)",border:`1.5px solid var(--border-modal)`,borderRadius:8,padding:"2rem 1.8rem",maxWidth:300,width:"100%",display:"flex",flexDirection:"column",gap:"1.2rem",animation:"fadeUp 0.3s ease both"}}>
              <div style={{fontFamily:"'DM Serif Display',serif",fontSize:"1.4rem",fontWeight:900,fontStyle:"italic",color:"var(--color-page-title)"}}>My Stats</div>

              {/* Summary row */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",textAlign:"center",gap:"0.5rem"}}>
                {[["played", statsPlayed], ["won", statsWon], ["gave up", statsGaveUp], ["perfect", statsPerfect]].map(([label, val]) => (
                  <div key={label}>
                    <div style={{fontFamily:"'DM Serif Display',serif",fontSize:"1.6rem",fontWeight:700,color:"var(--color-page-title)",lineHeight:1}}>{val}</div>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:"0.5rem",letterSpacing:"0.1em",textTransform:"uppercase",color:"var(--color-dim)",marginTop:"0.2rem"}}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Reveal distribution */}
              {statsWon > 0 && (
                <div style={{display:"flex",flexDirection:"column",gap:"0.35rem"}}>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:"0.55rem",letterSpacing:"0.14em",textTransform:"uppercase",color:"var(--color-dim)",marginBottom:"0.1rem"}}>Reveals (wins)</div>
                  {Array.from({length: statsMaxR + 1}, (_, i) => {
                    const count = statsDist[i] || 0;
                    const pct   = Math.round((count / statsWon) * 100);
                    return (
                      <div key={i} style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:"0.65rem",color:"var(--color-dim)",width:"1rem",textAlign:"right",flexShrink:0}}>{i}</div>
                        <div style={{flex:1,height:18,borderRadius:2,background:"var(--bg-tile-default)",overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${pct}%`,minWidth: count ? 28 : 0,background: i === 0 ? "var(--color-accent)" : "var(--border-tile-shaded)",borderRadius:2,display:"flex",alignItems:"center",justifyContent:"flex-end",paddingRight:"0.3rem",transition:"width 0.4s ease"}}>
                            {count > 0 && <span style={{fontFamily:"'DM Mono',monospace",fontSize:"0.55rem",color: i === 0 ? "var(--bg-primary-btn-text)" : "var(--color-tile-shaded)",fontWeight:500}}>{count}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {statsGaveUp > 0 && (
                    <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:"0.55rem",color:"var(--color-dim)",width:"1rem",flexShrink:0}}>✕</div>
                      <div style={{flex:1,height:18,borderRadius:2,background:"var(--bg-tile-default)",overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${Math.round((statsGaveUp / statsPlayed) * 100)}%`,minWidth: statsGaveUp ? 28 : 0,background:"var(--color-lose)",opacity:0.6,borderRadius:2,display:"flex",alignItems:"center",justifyContent:"flex-end",paddingRight:"0.3rem"}}>
                          <span style={{fontFamily:"'DM Mono',monospace",fontSize:"0.55rem",color:"#fff",fontWeight:500}}>{statsGaveUp}</span>
                        </div>
                      </div>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:"0.5rem",letterSpacing:"0.08em",color:"var(--color-lose)",opacity:0.7,flexShrink:0}}>gave up</div>
                    </div>
                  )}
                </div>
              )}

              {statsPlayed === 0 && (
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:"0.7rem",color:"var(--color-dim)",textAlign:"center"}}>No games played yet.</div>
              )}

              <button onClick={() => setShowStats(false)} style={{background:"transparent",border:"1.5px solid var(--border-secondary-btn)",color:"var(--color-secondary-btn)",fontFamily:"'DM Mono',monospace",fontSize:"0.6rem",letterSpacing:"0.2em",textTransform:"uppercase",padding:"0.6rem",borderRadius:3,cursor:"pointer"}}>
                Close
              </button>
            </div>
          </div>
        )}

        {/* Archive modal */}
        {showArchive && (
          <div onClick={() => setShowArchive(false)} style={{position:"fixed",inset:0,background:"var(--bg-overlay)",display:"flex",alignItems:"center",justifyContent:"center",padding:"1.5rem",zIndex:100}}>
            <div onClick={e => e.stopPropagation()} style={{background:"var(--bg-modal)",border:`1.5px solid var(--border-modal)`,borderRadius:8,padding:"2rem 1.8rem",maxWidth:340,width:"100%",display:"flex",flexDirection:"column",gap:"1rem",maxHeight:"80vh",animation:"fadeUp 0.3s ease both"}}>
              <div style={{fontFamily:"'DM Serif Display',serif",fontSize:"1.4rem",fontWeight:900,fontStyle:"italic",color:"var(--color-page-title)"}}>Archive</div>
              <div style={{display:"flex",flexDirection:"column",gap:"0.5rem",overflowY:"auto",flex:1}}>
                {/* Today's puzzle */}
                {[{date: formatDate(ACTIVE_DATE), title: TODAY_PUZZLE.title, entry: null}, ...ARCHIVE_LIST.map(e => ({date: formatDate(e.date), title: e.title, entry: e}))].map(({date, title, entry}) => {
                  const h = history[date];
                  const badge = h
                    ? h.result === "won"
                      ? { label: h.reveals === 0 ? "perfect" : `${h.reveals} reveal${h.reveals !== 1 ? "s" : ""}`, color: "var(--color-tile-shaded)" }
                      : { label: "gave up", color: "var(--color-lose)" }
                    : null;
                  return (
                    <div
                      key={date}
                      onClick={() => playArchivePuzzle(entry)}
                      style={{padding:"0.8rem 1rem",borderRadius:4,border:"1.5px solid var(--border-modal)",cursor:"pointer",transition:"border-color 0.15s,background 0.15s",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"0.5rem"}}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--color-accent)";e.currentTarget.style.background="var(--bg-tile-default)"}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border-modal)";e.currentTarget.style.background="transparent"}}
                    >
                      <div>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:"0.6rem",letterSpacing:"0.14em",textTransform:"uppercase",color: entry ? "var(--color-dim)" : "var(--color-accent)",marginBottom:"0.25rem"}}>{date}{!entry ? " · Today" : ""}</div>
                        <div style={{fontFamily:"'DM Serif Display',serif",fontSize:"0.9rem",fontStyle:"italic",color:"var(--color-page-title)"}}>{title}</div>
                      </div>
                      {badge && (
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:"0.55rem",letterSpacing:"0.1em",textTransform:"uppercase",color:badge.color,flexShrink:0,opacity:0.85}}>{badge.label}</div>
                      )}
                    </div>
                  );
                })}
              </div>
              <button onClick={() => setShowArchive(false)} style={{background:"transparent",border:"1.5px solid var(--border-secondary-btn)",color:"var(--color-secondary-btn)",fontFamily:"'DM Mono',monospace",fontSize:"0.6rem",letterSpacing:"0.2em",textTransform:"uppercase",padding:"0.6rem",borderRadius:3,cursor:"pointer",flexShrink:0}}>
                Close
              </button>
            </div>
          </div>
        )}

        {/* Help modal */}
        {showHelp && (
          <div onClick={() => { setShowHelp(false); setHelpPage(0); }} style={{position:"fixed",inset:0,background:"var(--bg-overlay)",display:"flex",alignItems:"center",justifyContent:"center",padding:"1.5rem",animation:"fadeUp 0.2s ease both",zIndex:100}}>
            <div onClick={e=>e.stopPropagation()} style={{background:"var(--bg-modal)",border:`1.5px solid var(--border-modal)`,borderRadius:8,padding:"2rem 1.8rem",maxWidth:340,width:"100%",display:"flex",flexDirection:"column",gap:"1.1rem",maxHeight:"90vh",overflowY:"auto"}}>

              {helpPage === 0 && (<>
                <div onClick={toggleSkipIntro} style={{display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",userSelect:"none"}}>
                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:"0.6rem",letterSpacing:"0.1em",color:"var(--color-dim)"}}>Don't show this again</span>
                  <div style={{width:34,height:18,borderRadius:9,background:skipIntro?"var(--color-accent)":"var(--border-tile-default)",position:"relative",transition:"background 0.2s",flexShrink:0,marginLeft:"0.75rem"}}>
                    <div style={{position:"absolute",top:2,left:skipIntro?16:2,width:14,height:14,borderRadius:"50%",background:"#fff",transition:"left 0.2s",boxShadow:"0 1px 2px rgba(0,0,0,0.25)"}}/>
                  </div>
                </div>
                <div style={{fontFamily:"'DM Serif Display',serif",fontSize:"1.5rem",fontWeight:900,fontStyle:"italic",color:"var(--color-page-title)"}}>How to play</div>
                <p style={{fontSize:"0.88rem",lineHeight:1.7,color:"var(--color-modal-text)",fontFamily:"'DM Mono',monospace",margin:0}}>A mystery phrase is hiding beneath another of equal length. You must guess it.</p>
                <SlidingAnimation/>
              </>)}

              {helpPage === 1 && (<>
                <p style={{fontSize:"0.88rem",lineHeight:1.7,color:"var(--color-modal-text)",fontFamily:"'DM Mono',monospace",margin:0}}>You will have help. Characters that are the same in both phrases are revealed automatically, as are spaces in the hidden phrase.</p>
                <AutoRevealAnimation/>
              </>)}

              {helpPage === 2 && (<>
                <p style={{fontSize:"0.88rem",lineHeight:1.7,color:"var(--color-modal-text)",fontFamily:"'DM Mono',monospace",margin:0}}>You may also reveal characters by tapping tiles, but choose wisely. You only get so many reveals, and they can't be next to green tiles.</p>
                <RevealDemoAnimation/>
              </>)}

              {helpPage === 3 && (<>
                <p style={{fontSize:"0.88rem",lineHeight:1.7,color:"var(--color-modal-text)",fontFamily:"'DM Mono',monospace",margin:0}}>When you're ready, guess the covered phrase.</p>
                <TypingAnimation/>
                <button onClick={() => { setShowHelp(false); setHelpPage(0); }} style={{background:"var(--color-accent)",border:"none",color:"var(--bg-primary-btn-text)",fontFamily:"'DM Mono',monospace",fontSize:"0.65rem",letterSpacing:"0.2em",textTransform:"uppercase",padding:"0.7rem",borderRadius:3,cursor:"pointer",fontWeight:500}}>{started ? "Got it" : "Play"}</button>
              </>)}

              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <button onClick={() => setHelpPage(p => p - 1)} style={{background:"transparent",border:"none",color:helpPage===0?"transparent":"var(--color-accent)",pointerEvents:helpPage===0?"none":"auto",fontSize:"1.2rem",cursor:"pointer",padding:"0.1rem 0.3rem",lineHeight:1,fontFamily:"'DM Mono',monospace"}}>&#8592;</button>
                <div style={{display:"flex",gap:"0.4rem",alignItems:"center"}}>
                  {[0,1,2,3].map(i => (
                    <div key={i} onClick={() => setHelpPage(i)} style={{width:i===helpPage?8:6,height:i===helpPage?8:6,borderRadius:"50%",background:i===helpPage?"var(--color-accent)":"var(--border-tile-default)",transition:"all 0.2s",cursor:"pointer"}}/>
                  ))}
                </div>
                <button onClick={() => setHelpPage(p => p + 1)} style={{background:"transparent",border:"none",color:helpPage===3?"transparent":"var(--color-accent)",pointerEvents:helpPage===3?"none":"auto",fontSize:"1.2rem",cursor:"pointer",padding:"0.1rem 0.3rem",lineHeight:1,fontFamily:"'DM Mono',monospace"}}>&#8594;</button>
              </div>

            </div>
          </div>
        )}

      </div>
    </>
  );
}
