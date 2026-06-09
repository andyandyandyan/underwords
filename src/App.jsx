import { useState } from "react";
import { SURFACE, HIDDEN, TITLE } from "./puzzle.js";
const MAX_ROWS = 7;
const MIN_COLS = 6;
const GAP      = 4;

function calcLayout(surface) {
  const total = surface.length;
  const cols  = Math.max(MIN_COLS, Math.ceil(total / MAX_ROWS));
  const rows  = Math.ceil(total / cols);
  return { cols, rows };
}

function buildTiles(surface, hidden) {
  return surface.split("").map((char, i) => ({
    id: i,
    surfaceLetter: char,
    hiddenLetter: hidden[i],
    isShaded: char === hidden[i],
    isRevealed: char === hidden[i],
  }));
}

function calcScore(tiles) {
  return tiles.filter(t => !t.isShaded && t.isRevealed).length;
}

function PieChart({ reveals, total }) {
  const color = reveals === 0 ? "#6dbf6d" : "#c9a96e";
  const pct = total > 0 ? reveals / total : 0;
  const r = 14, cx = 18, cy = 18, circ = 2 * Math.PI * r;
  return (
    <svg width={36} height={36} style={{transform:"rotate(-90deg)",flexShrink:0}}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--piechart-track)" strokeWidth={4}/>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={4}
        strokeDasharray={`${pct*circ} ${circ}`} strokeLinecap="round"
        style={{transition:"stroke-dasharray 0.4s ease, stroke 0.4s ease"}}/>
    </svg>
  );
}

function Tile({ tile, isSelected, onClick, size, isWinFlipping, flipIdx }) {
  const isSpace = tile.surfaceLetter === " ";
  const canClick = !tile.isShaded && !tile.isRevealed;

  let bg, border, color, cursor;
  if (tile.isShaded) {
    bg = isSpace ? "var(--bg-tile-shaded-space)" : "var(--bg-tile-shaded)";
    border = "var(--border-tile-shaded)"; color = "var(--color-tile-shaded)"; cursor = "default";
  } else if (tile.isRevealed) {
    bg = isSpace ? "var(--bg-tile-revealed-space)" : "var(--bg-tile-revealed)";
    border = isSelected ? "var(--color-accent)" : "var(--border-tile-revealed)";
    color = "var(--color-tile-revealed)"; cursor = "default";
  } else {
    bg = isSelected ? "var(--bg-tile-selected)" : "var(--bg-tile-default)";
    border = isSelected ? "var(--color-accent)" : "var(--border-tile-default)";
    color = "var(--color-tile-default)"; cursor = canClick ? "pointer" : "default";
  }

  const animStyle = isWinFlipping && !tile.isShaded ? {
    animation: "flipIn 0.45s ease both",
    animationDelay: `${flipIdx * 80}ms`,
  } : {};

  const letter = tile.isRevealed
    ? (tile.hiddenLetter === " " ? "" : tile.hiddenLetter)
    : (tile.surfaceLetter === " " ? "" : tile.surfaceLetter);

  return (
    <div
      onClick={canClick ? onClick : undefined}
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
  const [guessesLeft, setGuessesLeft] = useState(3);

  const { cols } = calcLayout(SURFACE);
  const flipTiles      = tiles.filter(t => !t.isShaded);
  const nonShadedCount = flipTiles.length;
  const currentScore   = calcScore(tiles);

  const boardW   = Math.min(window.innerWidth * 0.88, 560);
  const tileSize = Math.floor((boardW - GAP * (cols - 1)) / cols);

  const rows = [];
  for (let i = 0; i < tiles.length; i += cols) {
    rows.push(tiles.slice(i, i + cols));
  }

  function handleTileClick(id) {
    if (won || lost || winFlipping) return;
    setSelected(prev => prev === id ? null : id);
  }

  function confirmReveal() {
    if (selected === null || won || lost || winFlipping) return;
    setTiles(prev => prev.map(t => t.id === selected ? {...t, isRevealed: true} : t));
    setSelected(null);
  }

  function handleGuess() {
    if (won || lost || winFlipping) return;
    const norm = guess.trim().toUpperCase();
    if (norm === HIDDEN) {
      setFinalScore(currentScore);
      setWinFlipping(true);
      setTiles(prev => prev.map(t => ({...t, isRevealed: true})));
      setTimeout(() => { setWon(true); setWinFlipping(false); }, flipTiles.length * 80 + 600);
    } else {
      const remaining = guessesLeft - 1;
      setGuessesLeft(remaining);
      if (remaining === 0) {
        setWobble(true);
        setTimeout(() => { setWobble(false); setLost(true); }, 600);
      } else {
        setWobble(true);
        setMessage(`Not quite… ${remaining} guess${remaining === 1 ? "" : "es"} left`);
        setTimeout(() => { setWobble(false); setMessage(""); }, 1200);
      }
    }
    setGuess("");
  }

  function reset() {
    setTiles(buildTiles(SURFACE, HIDDEN));
    setSelected(null); setGuess(""); setFinalScore(null);
    setWobble(false); setWon(false); setLost(false);
    setWinFlipping(false); setMessage(""); setGuessesLeft(3); setStarted(false);
  }

  const finalLabel = finalScore === 0
    ? "No reveals needed"
    : `${finalScore} reveal${finalScore !== 1 ? "s" : ""}`;

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
            --color-dim: #444444;
            --bg-modal: #161618;
            --border-modal: #2e2e32;
            --color-modal-text: #888888;
            --bg-input: #1c1c1e;
            --border-input: #2e2e32;
            --color-input: #f0ece4;
            --border-inactive: #2e2e32;
            --color-inactive: #3a3a3f;
            --piechart-track: #2e2e32;
            --color-error: #884444;
            --color-lose: #884444;
            --bg-help-btn: #1c1c1e;
            --color-legend: #3a3a3f;
            --bg-overlay: rgba(0,0,0,0.75);
            --color-score-label: #444444;
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
        @keyframes flipIn {
          0%{transform:rotateY(0)} 40%{transform:rotateY(90deg)}
          41%{transform:rotateY(-90deg)} 100%{transform:rotateY(0)}
        }
        @keyframes fadeUp {
          from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)}
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
        <div style={{textAlign:"center", padding:"0 1rem"}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(1.8rem,8vw,2.6rem)",fontWeight:900,fontStyle:"italic",color:"var(--color-page-title)",lineHeight:1,marginBottom:"0.6rem"}}>
            underwords
          </div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(0.9rem,4vw,1.3rem)",fontWeight:700,color:"var(--color-accent)",letterSpacing:"0.08em",textTransform:"uppercase"}}>
            "{TITLE}"
          </div>
        </div>

        {/* Pre-game: show phrase naturally, prompt to start */}
        {!started && !showHelp && (
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"2rem",animation:"fadeUp 0.4s ease both",padding:"0 1rem",textAlign:"center"}}>
            <div style={{
              fontFamily:"'Playfair Display',serif",
              fontSize:"clamp(1.4rem,6vw,2.2rem)",
              fontWeight:700,
              color:"var(--color-page-title)",
              lineHeight:1.3,
              letterSpacing:"0.04em",
            }}>
              {SURFACE}
            </div>
            <div style={{fontSize:"0.65rem",letterSpacing:"0.18em",color:"var(--color-subtitle)",textTransform:"uppercase"}}>
              Something is hiding underneath
            </div>
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
        )}

        {/* Score */}
        {started && !won && !lost && (
          <div style={{display:"flex",alignItems:"center",gap:"1.2rem"}}>
            <div style={{display:"flex",alignItems:"center",gap:"0.8rem"}}>
              <PieChart reveals={currentScore} total={nonShadedCount}/>
              <div style={{display:"flex",alignItems:"center",gap:"0.5rem",fontSize:"0.65rem",letterSpacing:"0.18em",color:"var(--color-score-label)",textTransform:"uppercase"}}>
                Reveals: <span style={{fontFamily:"'Playfair Display'",fontSize:"1.3rem",fontWeight:700,color:"var(--color-accent)",letterSpacing:0}}>{currentScore}</span>
              </div>
            </div>
            <div style={{display:"flex",gap:"6px"}}>
              {[0,1,2].map(i => (
                <div key={i} style={{
                  width:10, height:10, borderRadius:"50%",
                  background: i < guessesLeft ? "var(--color-accent)" : "var(--border-inactive)",
                  transition:"background 0.3s",
                }}/>
              ))}
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
                  isWinFlipping={winFlipping}
                  flipIdx={winFlipping ? flipTiles.findIndex(t => t.id === tile.id) : 0}
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

        {/* Guess / Win / Lose */}
        {started && (won ? (
          <div style={{textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center",gap:"1rem",animation:"fadeUp 0.5s ease both"}}>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:"1.8rem",fontStyle:"italic",color:"var(--color-page-title)"}}>You got it!</div>
            <div style={{display:"flex",alignItems:"center",gap:"0.8rem"}}>
              <PieChart reveals={finalScore} total={nonShadedCount}/>
              <div style={{fontSize:"0.65rem",letterSpacing:"0.2em",color:"var(--color-score-label)",textTransform:"uppercase"}}>
                {finalLabel}
              </div>
            </div>
            <button onClick={reset} style={{background:"transparent",border:`1.5px solid var(--border-secondary-btn)`,color:"var(--color-secondary-btn)",fontFamily:"'DM Mono'",fontSize:"0.6rem",letterSpacing:"0.2em",padding:"0.5rem 1.2rem",borderRadius:3,cursor:"pointer",textTransform:"uppercase"}}>
              Play again
            </button>
          </div>
        ) : lost ? (
          <div style={{textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center",gap:"1.2rem",animation:"fadeUp 0.5s ease both"}}>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:"1.8rem",fontStyle:"italic",color:"var(--color-lose)"}}>No more guesses.</div>
            <div style={{fontSize:"0.65rem",letterSpacing:"0.18em",color:"var(--color-dim)",textTransform:"uppercase"}}>The answer was</div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(1.2rem,5vw,1.8rem)",fontWeight:700,color:"var(--color-page-title)",letterSpacing:"0.06em"}}>
              {HIDDEN}
            </div>
            <button onClick={reset} style={{background:"transparent",border:`1.5px solid var(--border-secondary-btn)`,color:"var(--color-secondary-btn)",fontFamily:"'DM Mono'",fontSize:"0.6rem",letterSpacing:"0.2em",padding:"0.5rem 1.2rem",borderRadius:3,cursor:"pointer",textTransform:"uppercase",marginTop:"0.4rem"}}>
              Try again
            </button>
          </div>
        ) : (
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
            <div style={{fontSize:"0.65rem",letterSpacing:"0.1em",color:"var(--color-error)",height:"1rem"}}>{message}</div>
          </div>
        ))}

        {/* Legend */}
        {started && !lost && (
        <div style={{display:"flex",gap:"1.2rem",fontSize:"0.55rem",letterSpacing:"0.1em",color:"var(--color-legend)",textTransform:"uppercase"}}>
          {[
            {bg:"var(--bg-tile-shaded)",border:"var(--border-tile-shaded)",label:"same in both"},
            {bg:"var(--bg-tile-revealed)",border:"var(--border-tile-revealed)",label:"revealed"},
            {bg:"var(--bg-tile-default)",border:"var(--border-tile-default)",label:"tap to reveal"},
          ].map(({bg,border,label})=>(
            <div key={label} style={{display:"flex",alignItems:"center",gap:5}}>
              <div style={{width:9,height:9,borderRadius:2,background:bg,border:`1px solid ${border}`,flexShrink:0}}/>
              {label}
            </div>
          ))}
        </div>
        )}

        {/* ? button — only shown once game is started */}
        {started && (
          <button onClick={()=>setShowHelp(true)} style={{position:"fixed",bottom:"1.4rem",right:"1.4rem",width:38,height:38,borderRadius:"50%",background:"var(--bg-help-btn)",border:"1.5px solid var(--color-accent)",color:"var(--color-accent)",fontFamily:"'DM Mono',monospace",fontSize:"0.85rem",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 0 4px rgba(201,169,110,0.08)",transition:"box-shadow 0.15s"}} onMouseEnter={e=>e.currentTarget.style.boxShadow="0 0 0 6px rgba(201,169,110,0.18)"} onMouseLeave={e=>e.currentTarget.style.boxShadow="0 0 0 4px rgba(201,169,110,0.08)"}>?</button>
        )}

        {/* Help modal */}
        {showHelp && (
          <div onClick={()=>setShowHelp(false)} style={{position:"fixed",inset:0,background:"var(--bg-overlay)",display:"flex",alignItems:"center",justifyContent:"center",padding:"1.5rem",animation:"fadeUp 0.2s ease both",zIndex:100}}>
            <div onClick={e=>e.stopPropagation()} style={{background:"var(--bg-modal)",border:`1.5px solid var(--border-modal)`,borderRadius:8,padding:"2rem 1.8rem",maxWidth:340,width:"100%",display:"flex",flexDirection:"column",gap:"1.2rem"}}>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:"1.5rem",fontWeight:900,fontStyle:"italic",color:"var(--color-page-title)"}}>How to play</div>
              <p style={{fontSize:"0.8rem",lineHeight:1.7,color:"var(--color-modal-text)",fontFamily:"'DM Mono',monospace"}}>The phrase you're about to see is hiding a mystery phrase underneath it.</p>
              <p style={{fontSize:"0.8rem",lineHeight:1.7,color:"var(--color-modal-text)",fontFamily:"'DM Mono',monospace"}}>Tap a tile to reveal what lies beneath. Green tiles are the same in both. Your score is the number of reveals you take, the lower the better. Guess the hidden phrase anytime — but you only get three tries.</p>
              <button onClick={()=>setShowHelp(false)} style={{background:"var(--color-accent)",border:"none",color:"var(--bg-primary-btn-text)",fontFamily:"'DM Mono',monospace",fontSize:"0.65rem",letterSpacing:"0.2em",textTransform:"uppercase",padding:"0.7rem",borderRadius:3,cursor:"pointer",fontWeight:500,marginTop:"0.4rem"}}>{started ? "Got it" : "Play"}</button>
            </div>
          </div>
        )}

      </div>
    </>
  );
}
