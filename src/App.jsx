import { useState, useEffect } from "react";
import { SURFACE, HIDDEN, TITLE, DATE } from "./puzzle.js";
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
    const isShaded = char === hidden[i];
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

function MiniTile({ letter, state, size, animating }) {
  let bg, border, color;
  if (state === "shaded") {
    bg = "var(--bg-tile-shaded)"; border = "var(--border-tile-shaded)"; color = "var(--color-tile-shaded)";
  } else if (state === "revealed") {
    bg = "var(--bg-tile-revealed)"; border = "var(--border-tile-revealed)"; color = "var(--color-tile-revealed)";
  } else if (state === "hint") {
    bg = "var(--bg-tile-revealed-space)"; border = "var(--border-tile-revealed)"; color = "var(--color-tile-revealed)";
  } else if (state === "selected") {
    bg = "var(--bg-tile-selected)"; border = "var(--color-accent)"; color = "var(--color-tile-default)";
  } else {
    bg = "var(--bg-tile-default)"; border = "var(--border-tile-default)"; color = "var(--color-tile-default)";
  }
  return (
    <div style={{
      width: size, height: Math.round(size * 1.15),
      display: "flex", alignItems: "center", justifyContent: "center",
      borderRadius: 3,
      background: bg, border: `1.5px solid ${border}`, color,
      fontFamily: "'DM Mono',monospace",
      fontSize: size * 0.4, fontWeight: 500,
      userSelect: "none", flexShrink: 0,
      transform: state === "selected" ? "translateY(-2px)" : "none",
      boxShadow: state === "selected" ? "0 0 0 2px rgba(201,169,110,0.25)" : "none",
      transition: "background 0.2s, border-color 0.15s, transform 0.12s",
      animation: animating ? "flipIn 0.4s ease both" : "none",
    }}>
      {letter === " " ? "" : letter}
    </div>
  );
}

// Animation 1: PALM TREE slides up under PINEAPPLE (no fade — covered by z-index)
function SlidingAnimation() {
  const surf   = "PINEAPPLE";
  const hidn   = "PALM TREE";
  const size   = 23;
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
        {hidn.split("").map((ch, i) => <MiniTile key={i} letter={ch} state={ch === " " ? "hint" : "default"} size={size}/>)}
      </div>
    </div>
  );
}

// Animation 2: space pre-revealed purple; two tiles get selected then revealed; P(0) and E(8) start green
function TileRevealAnimation() {
  const surf   = "PINEAPPLE";
  const hidn   = "PALM TREE";
  const SHADED = new Set([0, 8]);
  const HINT   = new Set([4]);
  const SEQ    = [2, 6];
  const size   = 23;
  const gap    = 2;

  const [selected,     setSelected]     = useState(null);
  const [revealed,     setRevealed]     = useState(new Set());
  const [justRevealed, setJustRevealed] = useState(null);

  useEffect(() => {
    const ids = [];
    let alive = true;
    function sched(fn, ms) { const id = setTimeout(() => { if (alive) fn(); }, ms); ids.push(id); }

    function run() {
      sched(() => setSelected(SEQ[0]), 500);
      sched(() => { setRevealed(s => new Set([...s, SEQ[0]])); setJustRevealed(SEQ[0]); setSelected(null); }, 1200);
      sched(() => setJustRevealed(null), 1700);
      sched(() => setSelected(SEQ[1]), 2400);
      sched(() => { setRevealed(s => new Set([...s, SEQ[1]])); setJustRevealed(SEQ[1]); setSelected(null); }, 3100);
      sched(() => setJustRevealed(null), 3600);
      sched(() => { setRevealed(new Set()); setSelected(null); }, 5000);
      sched(run, 5500);
    }

    sched(run, 400);
    return () => { alive = false; ids.forEach(clearTimeout); };
  }, []);

  return (
    <div style={{ display:"flex", gap, justifyContent:"center" }}>
      {surf.split("").map((ch, i) => {
        let state = "default";
        if (SHADED.has(i))        state = "shaded";
        else if (HINT.has(i))     state = "hint";
        else if (revealed.has(i)) state = "revealed";
        else if (selected === i)  state = "selected";
        const showHidden = SHADED.has(i) || HINT.has(i) || revealed.has(i);
        return (
          <MiniTile
            key={i}
            letter={showHidden ? (hidn[i] === " " ? "" : hidn[i]) : ch}
            state={state}
            size={size}
            animating={justRevealed === i}
          />
        );
      })}
    </div>
  );
}

// Animation 3: "palm tree" types into a guess bar
function TypingAnimation() {
  const text = "palm tree";
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    const ids = [];
    let alive = true;
    function sched(fn, ms) { const id = setTimeout(() => { if (alive) fn(); }, ms); ids.push(id); }

    function start() {
      for (let i = 0; i < text.length; i++) {
        sched(() => setDisplayed(text.slice(0, i + 1)), i * 110);
      }
      sched(() => setDisplayed(""), text.length * 110 + 900);
      sched(start, text.length * 110 + 1500);
    }

    sched(start, 700);
    return () => { alive = false; ids.forEach(clearTimeout); };
  }, []);

  return (
    <div style={{ display:"flex", gap:8, width:"100%" }}>
      <div style={{
        flex: 1,
        background: "var(--bg-input)",
        border: "1.5px solid var(--border-input)",
        color: "var(--color-input)",
        fontFamily: "'DM Mono',monospace",
        fontSize: "0.78rem",
        padding: "0.45rem 0.7rem",
        borderRadius: 3,
        display: "flex", alignItems: "center",
        minHeight: "2rem",
      }}>
        <span>{displayed}</span>
        <span style={{ animation:"demoBlink 0.9s step-end infinite", marginLeft:1 }}>|</span>
      </div>
      <div style={{
        background: "var(--color-accent)",
        color: "var(--bg-primary-btn-text)",
        fontFamily: "'DM Mono',monospace",
        fontSize: "0.58rem",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        padding: "0.45rem 0.8rem",
        borderRadius: 3,
        display: "flex", alignItems: "center",
        opacity: 0.5,
        userSelect: "none",
      }}>Guess</div>
    </div>
  );
}

function Tile({ tile, isSelected, onClick, size, isWinFlipping, flipIdx, isLocked, showHidden }) {
  const isSpace = tile.surfaceLetter === " ";
  const frozenLoss = showHidden && !tile.isShaded && !tile.isRevealed;
  const canClick = !tile.isShaded && !tile.isRevealed && !isLocked && !showHidden;

  let bg, border, color, cursor;
  if (tile.isShaded) {
    bg = isSpace ? "var(--bg-tile-shaded-space)" : "var(--bg-tile-shaded)";
    border = "var(--border-tile-shaded)"; color = "var(--color-tile-shaded)"; cursor = "default";
  } else if (tile.isRevealed) {
    bg = isSpace ? "var(--bg-tile-revealed-space)" : "var(--bg-tile-revealed)";
    border = isSelected ? "var(--color-accent)" : "var(--border-tile-revealed)";
    color = "var(--color-tile-revealed)"; cursor = "default";
  } else if (frozenLoss) {
    bg = "var(--bg-tile-default)"; border = "var(--border-tile-default)";
    color = "var(--color-page-title)"; cursor = "default";
  } else {
    bg = isSelected ? "var(--bg-tile-selected)" : "var(--bg-tile-default)";
    border = isSelected ? "var(--color-accent)" : "var(--border-tile-default)";
    color = "var(--color-tile-default)"; cursor = canClick ? "pointer" : "default";
  }

  const animStyle = isWinFlipping && !tile.isShaded ? {
    animation: "flipIn 0.45s ease both",
    animationDelay: `${flipIdx * 80}ms`,
  } : {};

  const letter = (tile.isRevealed || frozenLoss)
    ? (tile.hiddenLetter === " " ? "" : tile.hiddenLetter)
    : (tile.surfaceLetter === " " ? "" : tile.surfaceLetter);

  return (
    <div
      onClick={!tile.isShaded && !tile.isRevealed ? onClick : undefined}
      className={canClick && !isSelected ? "tile-hover" : ""}
      style={{
        width: size, height: size * 1.15,
        flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        borderRadius: 4,
        background: bg, border: `1.5px solid ${border}`, color, cursor,
        fontFamily: "'DM Mono',monospace",
        fontSize: size * 0.42,
        fontWeight: 500,
        userSelect: "none",
        transition: "background 0.15s,border-color 0.15s,transform 0.12s,box-shadow 0.15s",
        boxShadow: isSelected ? "0 0 0 2px rgba(201,169,110,0.25)" : "none",
        transform: isSelected ? "translateY(-3px)" : "none",
        ...animStyle,
      }}
    >{letter}</div>
  );
}

export default function App() {
  const [tiles, setTiles]             = useState(buildTiles(SURFACE, HIDDEN));
  const [selected, setSelected]       = useState(null);
  const [guess, setGuess]             = useState("");
  const [wobble, setWobble]           = useState(false);
  const [won, setWon]                 = useState(false);
  const [lost, setLost]               = useState(false);
  const [finalScore, setFinalScore]   = useState(null);
  const [winFlipping, setWinFlipping] = useState(false);
  const [showHelp, setShowHelp]       = useState(true);
  const [message, setMessage]         = useState("");
  const [started, setStarted]         = useState(false);
  const [hintUsed, setHintUsed]         = useState(false);
  const [shareCopied, setShareCopied]   = useState(false);
  const [lockedShake, setLockedShake]   = useState(false);
  const [dismissedWin, setDismissedWin]   = useState(false);
  const [dismissedLoss, setDismissedLoss] = useState(false);
  const [hardMode, setHardMode]           = useState(false);

  const { cols } = calcLayout(SURFACE);
  const completeRows  = Math.floor(SURFACE.length / cols);
  const revealBudget  = completeRows * 2;
  const flipTiles     = tiles.filter(t => !t.isShaded);
  const currentScore  = calcScore(tiles);
  const revealsLeft   = finalScore !== null ? revealBudget - finalScore : revealBudget - currentScore;

  const boardW   = Math.min(window.innerWidth * 0.88, 560);
  const tileSize = Math.floor((boardW - GAP * (cols - 1)) / cols);

  const rows = [];
  for (let i = 0; i < tiles.length; i += cols) {
    rows.push(tiles.slice(i, i + cols));
  }

  function handleTileClick(id) {
    if (won || lost || winFlipping) return;
    const adjacentRevealed = tiles.some(t =>
      (t.id === id - 1 || t.id === id + 1) && t.isRevealed && !t.isShaded && !t.isHintRevealed
    );
    if (adjacentRevealed) {
      setLockedShake(true);
      setMessage("You cannot reveal consecutive tiles.");
      setTimeout(() => { setLockedShake(false); setMessage(""); }, 1000);
      return;
    }
    if (revealsLeft === 0) return;
    setSelected(prev => prev === id ? null : id);
  }

  function confirmReveal() {
    if (selected === null || won || lost || winFlipping || revealsLeft === 0) return;
    setTiles(prev => prev.map(t => t.id === selected ? {...t, isRevealed: true} : t));
    setSelected(null);
  }

  function useHint() {
    setTiles(prev => prev.map(t =>
      !t.isShaded && !t.isRevealed && t.hiddenLetter === " "
        ? { ...t, isRevealed: true, isHintRevealed: true }
        : t
    ));
    setHintUsed(true);
  }

  function handleGuess() {
    if (won || lost || winFlipping) return;
    const norm = guess.trim().replace(/\.+$/, "").trim().toUpperCase();
    if (norm === HIDDEN) {
      setFinalScore(currentScore);
      setWinFlipping(true);
      setTiles(prev => prev.map(t => ({...t, isRevealed: true})));
      setTimeout(() => { setWon(true); setWinFlipping(false); }, flipTiles.length * 80 + 600);
    } else {
      setWobble(true);
      setMessage("Not quite…");
      setTimeout(() => { setWobble(false); setMessage(""); }, 1200);
    }
    setGuess("");
  }

  async function handleShare() {
    let text;
    if (won) {
      const revealText = finalScore === 0 ? "zero reveals" : `${finalScore} reveal${finalScore !== 1 ? "s" : ""}`;
      const emojiLine = ("🟪".repeat(finalScore) + (hintUsed ? " 🟥 hint taken" : "")).trim();
      text = `underwords — ${DATE}: "${TITLE}"\n${getRating(finalScore)} · ${revealText}${emojiLine ? "\n" + emojiLine : ""}`;
    } else {
      text = `underwords — ${DATE}: "${TITLE}"\nno luck${hintUsed ? "\n🟥 hint taken" : ""}`;
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
    setTiles(buildTiles(SURFACE, HIDDEN, hardMode));
    setSelected(null); setGuess(""); setFinalScore(null);
    setWobble(false); setWon(false); setLost(false);
    setWinFlipping(false); setMessage(""); setStarted(false); setHintUsed(false); setLockedShake(false); setDismissedWin(false); setDismissedLoss(false);
  }

  function toggleHardMode() {
    if (started || hardMode) return;
    setHardMode(true);
    setTiles(buildTiles(SURFACE, HIDDEN, true));
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,900&family=DM+Mono:wght@300;400;500&display=swap');
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
          --color-modal-text: #666666;
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
            --color-modal-text: #888888;
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
      `}</style>

      <div style={{
        display:"flex", flexDirection:"column", alignItems:"center",
        gap:"1.4rem", padding:"2rem 0", width:"100%", maxWidth:600,
      }}>

        {/* Header */}
        {!started ? (
          <div style={{textAlign:"center", padding:"0 1rem"}}>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(1.8rem,8vw,2.6rem)",fontWeight:900,fontStyle:"italic",color:"var(--color-page-title)",lineHeight:1,marginBottom:"0.5rem"}}>
              underwords
            </div>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:"clamp(1rem,4.5vw,1.5rem)",fontWeight:500,color:"var(--color-accent)",lineHeight:1.2,letterSpacing:"0.02em"}}>
              {DATE}: "{TITLE}"
            </div>
          </div>
        ) : (
          <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",width: tileSize * cols + GAP * (cols - 1)}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:"clamp(0.72rem,3.2vw,0.9rem)",fontWeight:500,color:"var(--color-accent)",letterSpacing:"0.02em",flexShrink:1,minWidth:0}}>
              {DATE}: "{TITLE}"
            </div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(0.72rem,3.2vw,0.9rem)",fontWeight:900,fontStyle:"italic",color:"var(--color-page-title)",opacity:0.45,userSelect:"none",flexShrink:0,marginLeft:"1rem"}}>
              underwords
            </div>
          </div>
        )}

        {/* Pre-game: phrase in tile form */}
        {!started && !showHelp && (
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"2rem",animation:"fadeUp 0.4s ease both",padding:"0 1rem"}}>
            <div style={{display:"flex",flexWrap:"wrap",gap:4,justifyContent:"center"}}>
              {SURFACE.split("").map((ch, i) =>
                ch === " "
                  ? <div key={i} style={{width:14}}/>
                  : <MiniTile key={i} letter={ch} state="default" size={34}/>
              )}
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"0.75rem"}}>
              <button
                onClick={toggleHardMode}
                title="In hard mode, spaces aren't revealed."
                style={{
                  background: hardMode ? "#d63030" : "transparent",
                  border: `1.5px solid ${hardMode ? "#d63030" : "var(--border-tile-default)"}`,
                  color: hardMode ? "#fff" : "var(--color-score-label)",
                  fontFamily:"'DM Mono',monospace", fontSize:"0.6rem",
                  letterSpacing:"0.15em", textTransform:"uppercase",
                  padding:"0.4rem 0.9rem", borderRadius:3,
                  cursor: hardMode ? "default" : "pointer",
                  fontWeight:500, transition:"all 0.15s",
                }}
              >
                {hardMode ? "Hard mode: on" : "Hard mode"}
              </button>
              <button
                onClick={() => setStarted(true)}
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
            </div>
          </div>
        )}

        {/* Score */}
        {started && !won && !lost && (
          <div style={{display:"flex",alignItems:"center",width: tileSize * cols + GAP * (cols - 1)}}>
            <div style={{display:"flex",alignItems:"center",gap:"1.6rem"}}>
              <div style={{display:"flex",alignItems:"center",gap:"0.5rem",fontSize:"0.72rem",letterSpacing:"0.18em",color:"var(--color-score-label)",textTransform:"uppercase"}}>
                Reveals left: <span style={{fontFamily:"'Playfair Display'",fontSize:"1.3rem",fontWeight:700,color:"var(--color-accent)",letterSpacing:0}}>{revealsLeft}</span>
              </div>
            </div>
            <div style={{marginLeft:"auto",paddingLeft:"0.75rem"}}>
              {(!hardMode || hintUsed)
                ? <span style={{fontSize:"0.62rem",letterSpacing:"0.1em",textTransform:"uppercase",color:"#d63030",fontFamily:"'DM Mono',monospace"}}>Spaces revealed.</span>
                : <button onClick={useHint} style={{background:"transparent",border:"none",color:"#d63030",fontFamily:"'DM Mono',monospace",fontSize:"0.62rem",letterSpacing:"0.1em",textTransform:"uppercase",cursor:"pointer",padding:0,textDecoration:"underline",textUnderlineOffset:"3px"}}>Need a hint?</button>
              }
            </div>
          </div>
        )}

        {/* Board */}
        {started && (
        <div style={{
          display:"flex", flexDirection:"column", alignItems:"flex-start",
          gap: GAP, width: tileSize * cols + GAP * (cols - 1),
          animation: wobble ? "wobble 0.55s ease" : lockedShake ? "shake 0.3s ease" : "none",
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
                  isWinFlipping={winFlipping}
                  flipIdx={winFlipping ? flipTiles.findIndex(t => t.id === tile.id) : 0}
                  isLocked={revealsLeft === 0 || tiles.some(t => (t.id === tile.id - 1 || t.id === tile.id + 1) && t.isRevealed && !t.isShaded && !t.isHintRevealed)}
                  showHidden={lost && dismissedLoss}
                />
              ))}
            </div>
          ))}
        </div>
        )}

        {/* Reveal button */}
        {started && !won && !lost && (
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
        {started && !won && !lost && (
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"0.6rem",width: tileSize * cols + GAP * (cols - 1)}}>
            <div style={{display:"flex",gap:8,width:"100%"}}>
              <input value={guess} onChange={e=>setGuess(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&handleGuess()}
                placeholder="Guess the hidden phrase…" disabled={winFlipping}
                style={{flex:1,background:"var(--bg-input)",border:`1.5px solid var(--border-input)`,color:"var(--color-input)",fontFamily:"'DM Mono',monospace",fontSize:"0.85rem",padding:"0.65rem 0.9rem",borderRadius:3,outline:"none"}}
              />
              <button onClick={handleGuess} disabled={winFlipping} style={{background:"var(--color-accent)",border:"none",color:"var(--bg-primary-btn-text)",fontFamily:"'DM Mono',monospace",fontSize:"0.65rem",letterSpacing:"0.15em",textTransform:"uppercase",padding:"0.65rem 1.2rem",borderRadius:3,cursor:"pointer",fontWeight:500}}>
                Guess
              </button>
            </div>
            <div style={{display:"flex",gap:3,alignItems:"center",justifyContent:"center",height:"8px"}}>
              {Array.from({length: HIDDEN.length}, (_, i) => {
                const normLen = guess.trim().replace(/\.+$/, "").trim().length;
                const over  = normLen > HIDDEN.length;
                const exact = normLen === HIDDEN.length;
                const bg = over  ? "#d63030"
                         : exact ? "#5aaa5a"
                         : i < guess.length ? "var(--color-accent)"
                         : "var(--border-tile-default)";
                return <div key={i} style={{width:9,height:2,borderRadius:1,background:bg,transition:"background 0.08s"}}/>;
              })}
            </div>
            <div style={{fontSize:"0.65rem",letterSpacing:"0.1em",color:"var(--color-error)",height:"1rem"}}>{message}</div>
          </div>
        )}


        {/* Replay button after dismissed popup */}
        {((won && dismissedWin) || (lost && dismissedLoss)) && (
          <button onClick={reset} style={{background:"transparent",border:`1.5px solid var(--border-secondary-btn)`,color:"var(--color-secondary-btn)",fontFamily:"'DM Mono',monospace",fontSize:"0.6rem",letterSpacing:"0.2em",textTransform:"uppercase",padding:"0.5rem 1.4rem",borderRadius:3,cursor:"pointer",animation:"fadeUp 0.3s ease both"}}>
            New game
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
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:"0.95rem",fontStyle:"italic",color:"var(--color-dim)"}}>No more guesses.</div>
              <div style={{fontSize:"0.6rem",letterSpacing:"0.18em",color:"var(--color-dim)",textTransform:"uppercase"}}>The answer was</div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:"1.6rem",fontWeight:700,fontStyle:"italic",color:"var(--color-lose)",letterSpacing:"0.02em",lineHeight:1.2}}>
                {HIDDEN}
              </div>
              {hintUsed && (
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:"0.6rem",letterSpacing:"0.12em",textTransform:"uppercase",color:"var(--color-dim)"}}>
                  hint taken
                </div>
              )}
              <div style={{display:"flex",gap:"0.6rem",marginTop:"0.6rem"}}>
                <button onClick={handleShare} style={{background:"transparent",border:"1.5px solid var(--border-secondary-btn)",color:"var(--color-secondary-btn)",fontFamily:"'DM Mono',monospace",fontSize:"0.65rem",letterSpacing:"0.2em",textTransform:"uppercase",padding:"0.7rem 1.4rem",borderRadius:3,cursor:"pointer",fontWeight:500,transition:"all 0.15s"}}>
                  {shareCopied ? "Copied!" : "Share"}
                </button>
                <button onClick={reset} style={{background:"var(--color-accent)",border:"none",color:"var(--bg-primary-btn-text)",fontFamily:"'DM Mono',monospace",fontSize:"0.65rem",letterSpacing:"0.2em",textTransform:"uppercase",padding:"0.7rem 1.4rem",borderRadius:3,cursor:"pointer",fontWeight:500}}>
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Win popup */}
        {won && finalScore !== null && !dismissedWin && (
          <div onClick={() => setDismissedWin(true)} style={{position:"fixed",inset:0,background:"var(--bg-overlay)",display:"flex",alignItems:"center",justifyContent:"center",padding:"1.5rem",zIndex:100,cursor:"pointer"}}>
            <div onClick={e => e.stopPropagation()} style={{background:"var(--bg-modal)",border:`1.5px solid var(--border-modal)`,borderRadius:8,padding:"2.4rem 2rem",maxWidth:300,width:"100%",display:"flex",flexDirection:"column",alignItems:"center",gap:"0.8rem",textAlign:"center",animation:"fadeUp 0.35s ease both"}}>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:"0.95rem",fontStyle:"italic",color:"var(--color-dim)"}}>
                You got it!
              </div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:"3.2rem",fontWeight:900,fontStyle:"italic",color:"var(--color-accent)",lineHeight:1,letterSpacing:"-0.01em"}}>
                {getRating(finalScore)}
              </div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:"1.4rem",fontWeight:700,color:"var(--color-page-title)",letterSpacing:"0.02em"}}>
                {finalScore === 0 ? "zero reveals" : `${finalScore} reveal${finalScore !== 1 ? "s" : ""}`}
              </div>
              {hintUsed && (
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:"0.6rem",letterSpacing:"0.12em",textTransform:"uppercase",color:"var(--color-dim)"}}>
                  hint taken
                </div>
              )}
              <div style={{display:"flex",gap:"0.6rem",marginTop:"0.6rem"}}>
                <button onClick={handleShare} style={{background:"transparent",border:"1.5px solid var(--border-secondary-btn)",color:"var(--color-secondary-btn)",fontFamily:"'DM Mono',monospace",fontSize:"0.65rem",letterSpacing:"0.2em",textTransform:"uppercase",padding:"0.7rem 1.4rem",borderRadius:3,cursor:"pointer",fontWeight:500,transition:"all 0.15s"}}>
                  {shareCopied ? "Copied!" : "Share"}
                </button>
                <button onClick={reset} style={{background:"var(--color-accent)",border:"none",color:"var(--bg-primary-btn-text)",fontFamily:"'DM Mono',monospace",fontSize:"0.65rem",letterSpacing:"0.2em",textTransform:"uppercase",padding:"0.7rem 1.4rem",borderRadius:3,cursor:"pointer",fontWeight:500}}>
                  Play again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Help modal */}
        {showHelp && (
          <div onClick={()=>setShowHelp(false)} style={{position:"fixed",inset:0,background:"var(--bg-overlay)",display:"flex",alignItems:"center",justifyContent:"center",padding:"1.5rem",animation:"fadeUp 0.2s ease both",zIndex:100}}>
            <div onClick={e=>e.stopPropagation()} style={{background:"var(--bg-modal)",border:`1.5px solid var(--border-modal)`,borderRadius:8,padding:"2rem 1.8rem",maxWidth:340,width:"100%",display:"flex",flexDirection:"column",gap:"1.1rem",maxHeight:"90vh",overflowY:"auto"}}>

              <div style={{fontFamily:"'Playfair Display',serif",fontSize:"1.5rem",fontWeight:900,fontStyle:"italic",color:"var(--color-page-title)"}}>How to play</div>

              <p style={{fontSize:"0.8rem",lineHeight:1.7,color:"var(--color-modal-text)",fontFamily:"'DM Mono',monospace"}}>One phrase hides another.</p>

              <SlidingAnimation/>

              <p style={{fontSize:"0.8rem",lineHeight:1.7,color:"var(--color-modal-text)",fontFamily:"'DM Mono',monospace"}}>Shared characters (green) and spaces (purple, if they exist) are revealed for you. Tap a tile to reveal one character of the hidden phrase, but choose wisely. You only get a limited number of reveals, and no two can touch.</p>

              <TileRevealAnimation/>

              <p style={{fontSize:"0.8rem",lineHeight:1.7,color:"var(--color-modal-text)",fontFamily:"'DM Mono',monospace"}}>Win by guessing the mystery phrase.</p>

              <TypingAnimation/>

              <p style={{fontSize:"0.8rem",lineHeight:1.7,color:"var(--color-modal-text)",fontFamily:"'DM Mono',monospace"}}>Want a challenge? Try hard mode.</p>

              <button onClick={()=>setShowHelp(false)} style={{background:"var(--color-accent)",border:"none",color:"var(--bg-primary-btn-text)",fontFamily:"'DM Mono',monospace",fontSize:"0.65rem",letterSpacing:"0.2em",textTransform:"uppercase",padding:"0.7rem",borderRadius:3,cursor:"pointer",fontWeight:500,marginTop:"0.2rem"}}>{started ? "Got it" : "Play"}</button>
            </div>
          </div>
        )}

      </div>
    </>
  );
}
