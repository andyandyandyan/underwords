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

function tileWeight(tile) {
  return 1;
}

function calcScore(tiles) {
  const live = tiles.filter(t => !t.isShaded);
  const total = live.reduce((s, t) => s + tileWeight(t), 0);
  const spent = live.filter(t => t.isRevealed).reduce((s, t) => s + tileWeight(t), 0);
  return Math.round(((total - spent) / total) * 100);
}

function PieChart({ score }) {
  const color = score >= 50 ? "#6dbf6d" : "#c9a96e";
  const pct = score / 100;
  const r = 14, cx = 18, cy = 18, circ = 2 * Math.PI * r;
  return (
    <svg width={36} height={36} style={{transform:"rotate(-90deg)",flexShrink:0}}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#2e2e32" strokeWidth={4}/>
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
    bg = isSpace ? "#1a221a" : "#1e2a1e";
    border = "#2d4a2d"; color = "#6dbf6d"; cursor = "default";
  } else if (tile.isRevealed) {
    bg = isSpace ? "#161620" : "#1a1a2e";
    border = isSelected ? "#c9a96e" : "#2d2d55";
    color = "#8888ff"; cursor = "default";
  } else {
    bg = isSelected ? "#221f16" : "#1c1c1e";
    border = isSelected ? "#c9a96e" : "#3a3a3f";
    color = "#e8e2d6"; cursor = canClick ? "pointer" : "default";
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
  const flipTiles    = tiles.filter(t => !t.isShaded);
  const currentScore = calcScore(tiles);

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

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,900&family=DM+Mono:wght@300;400;500&display=swap');
        *,*::before,*::after { box-sizing:border-box; margin:0; padding:0; }
        html,body { width:100%; overflow-x:hidden; background:#0e0e0f; }
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
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(1.8rem,8vw,2.6rem)",fontWeight:900,fontStyle:"italic",color:"#f0ece4",lineHeight:1,marginBottom:"0.6rem"}}>
            underwords
          </div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(0.9rem,4vw,1.3rem)",fontWeight:700,color:"#c9a96e",letterSpacing:"0.08em",textTransform:"uppercase"}}>
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
              color:"#f0ece4",
              lineHeight:1.3,
              letterSpacing:"0.04em",
            }}>
              {SURFACE}
            </div>
            <div style={{fontSize:"0.65rem",letterSpacing:"0.18em",color:"#444",textTransform:"uppercase"}}>
              Something is hiding underneath
            </div>
            <button
              onClick={() => setStarted(true)}
              style={{
                background:"#c9a96e", border:"none", color:"#0e0e0f",
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
              <PieChart score={currentScore}/>
              <div style={{display:"flex",alignItems:"center",gap:"0.5rem",fontSize:"0.65rem",letterSpacing:"0.18em",color:"#444",textTransform:"uppercase"}}>
                Max score: <span style={{fontFamily:"'Playfair Display'",fontSize:"1.3rem",fontWeight:700,color:"#c9a96e",letterSpacing:0}}>{currentScore}</span>
              </div>
            </div>
            <div style={{display:"flex",gap:"6px"}}>
              {[0,1,2].map(i => (
                <div key={i} style={{
                  width:10, height:10, borderRadius:"50%",
                  background: i < guessesLeft ? "#c9a96e" : "#2e2e32",
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
            border:`1.5px solid ${selected!==null?"#c9a96e":"#2e2e32"}`,
            color:selected!==null?"#c9a96e":"#3a3a3f",
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
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:"1.8rem",fontStyle:"italic",color:"#f0ece4"}}>You got it!</div>
            <div style={{display:"flex",alignItems:"center",gap:"0.8rem"}}>
              <PieChart score={finalScore}/>
              <div style={{fontSize:"0.65rem",letterSpacing:"0.2em",color:"#555",textTransform:"uppercase"}}>
                Final score: <span style={{color:"#c9a96e",fontSize:"1.1rem"}}>{finalScore}</span>
              </div>
            </div>
            <button onClick={reset} style={{background:"transparent",border:"1.5px solid #2e2e32",color:"#555",fontFamily:"'DM Mono'",fontSize:"0.6rem",letterSpacing:"0.2em",padding:"0.5rem 1.2rem",borderRadius:3,cursor:"pointer",textTransform:"uppercase"}}>
              Play again
            </button>
          </div>
        ) : lost ? (
          <div style={{textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center",gap:"1.2rem",animation:"fadeUp 0.5s ease both"}}>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:"1.8rem",fontStyle:"italic",color:"#884444"}}>No more guesses.</div>
            <div style={{fontSize:"0.65rem",letterSpacing:"0.18em",color:"#444",textTransform:"uppercase"}}>The answer was</div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(1.2rem,5vw,1.8rem)",fontWeight:700,color:"#f0ece4",letterSpacing:"0.06em"}}>
              {HIDDEN}
            </div>
            <button onClick={reset} style={{background:"transparent",border:"1.5px solid #2e2e32",color:"#555",fontFamily:"'DM Mono'",fontSize:"0.6rem",letterSpacing:"0.2em",padding:"0.5rem 1.2rem",borderRadius:3,cursor:"pointer",textTransform:"uppercase",marginTop:"0.4rem"}}>
              Try again
            </button>
          </div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"0.6rem",width: tileSize * cols + GAP * (cols - 1)}}>
            <div style={{display:"flex",gap:8,width:"100%"}}>
              <input value={guess} onChange={e=>setGuess(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&handleGuess()}
                placeholder="Guess the hidden phrase…" disabled={winFlipping}
                style={{flex:1,background:"#1c1c1e",border:"1.5px solid #2e2e32",color:"#f0ece4",fontFamily:"'DM Mono',monospace",fontSize:"0.85rem",padding:"0.65rem 0.9rem",borderRadius:3,outline:"none"}}
              />
              <button onClick={handleGuess} disabled={winFlipping} style={{background:"#c9a96e",border:"none",color:"#0e0e0f",fontFamily:"'DM Mono',monospace",fontSize:"0.65rem",letterSpacing:"0.15em",textTransform:"uppercase",padding:"0.65rem 1.2rem",borderRadius:3,cursor:"pointer",fontWeight:500}}>
                Guess
              </button>
            </div>
            <div style={{fontSize:"0.65rem",letterSpacing:"0.1em",color:"#884444",height:"1rem"}}>{message}</div>
          </div>
        ))}

        {/* Legend */}
        {started && !lost && (
        <div style={{display:"flex",gap:"1.2rem",fontSize:"0.55rem",letterSpacing:"0.1em",color:"#3a3a3f",textTransform:"uppercase"}}>
          {[
            {bg:"#1e2a1e",border:"#2d4a2d",label:"same in both"},
            {bg:"#1a1a2e",border:"#2d2d55",label:"revealed"},
            {bg:"#1c1c1e",border:"#3a3a3f",label:"tap to reveal"},
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
          <button onClick={()=>setShowHelp(true)} style={{position:"fixed",bottom:"1.4rem",right:"1.4rem",width:38,height:38,borderRadius:"50%",background:"#1c1c1e",border:"1.5px solid #c9a96e",color:"#c9a96e",fontFamily:"'DM Mono',monospace",fontSize:"0.85rem",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 0 4px rgba(201,169,110,0.08)",transition:"box-shadow 0.15s"}} onMouseEnter={e=>e.currentTarget.style.boxShadow="0 0 0 6px rgba(201,169,110,0.18)"} onMouseLeave={e=>e.currentTarget.style.boxShadow="0 0 0 4px rgba(201,169,110,0.08)"}>?</button>
        )}

        {/* Help modal */}
        {showHelp && (
          <div onClick={()=>setShowHelp(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center",padding:"1.5rem",animation:"fadeUp 0.2s ease both",zIndex:100}}>
            <div onClick={e=>e.stopPropagation()} style={{background:"#161618",border:"1.5px solid #2e2e32",borderRadius:8,padding:"2rem 1.8rem",maxWidth:340,width:"100%",display:"flex",flexDirection:"column",gap:"1.2rem"}}>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:"1.5rem",fontWeight:900,fontStyle:"italic",color:"#f0ece4"}}>How to play</div>
              <p style={{fontSize:"0.8rem",lineHeight:1.7,color:"#888",fontFamily:"'DM Mono',monospace"}}>Lurking beneath the phrase you're about to see is a mystery phrase of equal length. Your job is to guess it.</p>
              <p style={{fontSize:"0.8rem",lineHeight:1.7,color:"#888",fontFamily:"'DM Mono',monospace"}}>Each tile is a letter or a space. Tiles are green when they are the same in both phrases. Tap a tile to reveal one piece of the hidden phrase. Your score is the percentage of the puzzle you solved yourself — higher is better.</p>
              <p style={{fontSize:"0.8rem",lineHeight:1.7,color:"#888",fontFamily:"'DM Mono',monospace"}}>Guess the hidden phrase anytime, but you only get three tries. Use them wisely.</p>
              <button onClick={()=>setShowHelp(false)} style={{background:"#c9a96e",border:"none",color:"#0e0e0f",fontFamily:"'DM Mono',monospace",fontSize:"0.65rem",letterSpacing:"0.2em",textTransform:"uppercase",padding:"0.7rem",borderRadius:3,cursor:"pointer",fontWeight:500,marginTop:"0.4rem"}}>{started ? "Got it" : "Play"}</button>
            </div>
          </div>
        )}

      </div>
    </>
  );
}
