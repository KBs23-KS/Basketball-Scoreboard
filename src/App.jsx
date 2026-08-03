import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, Square, RotateCcw, Plus, Minus, Volume2, VolumeX, 
  Maximize, Monitor, Settings, Users, Save, Download, Upload, 
  Printer, ArrowLeft, ArrowRight, Clock, Trash2, Undo, Redo, FileText
} from 'lucide-react';

// --- Web Audio API for Sounds (No external files needed) ---
const playHorn = (type = 'quarter', volume = 0.5) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    if (type === 'quarter') {
      // Deep loud horn for end of quarter
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 1);
      gainNode.gain.setValueAtTime(volume, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.5);
      osc.start();
      osc.stop(ctx.currentTime + 1.5);
    } else if (type === 'shotclock') {
      // Higher pitch buzzer for shot clock
      osc.type = 'square';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.setValueAtTime(300, ctx.currentTime + 0.2);
      gainNode.gain.setValueAtTime(volume, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
      osc.start();
      osc.stop(ctx.currentTime + 0.8);
    } else if (type === 'timeout') {
      // Short whistle-like beep
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gainNode.gain.setValueAtTime(volume, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    }
  } catch (e) {
    console.error("Audio playback failed", e);
  }
};

const DEFAULT_SETTINGS = {
  gameName: "การแข่งขันบาสเกตบอล",
  quarterMinutes: 10,
  shotClockSeconds: 24,
  shortShotClockSeconds: 14,
  bonusFoulLimit: 5,
  playerFoulOutLimit: 5,
  timeoutsPerTeam: 3,
  timeoutDuration: 60,
  soundEnabled: true,
  soundVolume: 50,
};

const DEFAULT_TEAM = {
  name: "TEAM",
  score: 0,
  fouls: 0,
  timeouts: 3,
  color: "#000000", // Will be overridden
  players: [], // { id, number, name, points, fouls, inGame }
};

const generateId = () => Math.random().toString(36).substr(2, 9);

// Format time to MM:SS or MM:SS.ms
const formatTime = (ms) => {
  if (ms < 0) ms = 0;
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const tenths = Math.floor((ms % 1000) / 100);

  if (minutes === 0 && seconds < 60) {
    // Under 1 minute, show tenths
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${tenths}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const formatShotClock = (ms) => {
  if (ms < 0) ms = 0;
  return Math.ceil(ms / 1000).toString();
};

export default function Scoreboard() {
  // Mode detection (Controller vs Display)
  const isDisplayMode = new URLSearchParams(window.location.search).get('mode') === 'display';

  // --- Core State ---
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [home, setHome] = useState({ ...DEFAULT_TEAM, name: "HOME", color: "#1e3a8a" }); // Navy
  const [away, setAway] = useState({ ...DEFAULT_TEAM, name: "AWAY", color: "#991b1b" }); // Dark Red
  
  const [quarter, setQuarter] = useState("Q1");
  const [possession, setPossession] = useState("home"); // "home" | "away" | null
  
  // Game Clock
  const [clockMs, setClockMs] = useState(10 * 60 * 1000);
  const [isClockRunning, setIsClockRunning] = useState(false);
  const clockRef = useRef(null);
  const lastTickRef = useRef(Date.now());

  // Shot Clock
  const [shotClockMs, setShotClockMs] = useState(24 * 1000);
  const [isShotClockRunning, setIsShotClockRunning] = useState(false);
  
  // Timeout Clock
  const [timeoutMs, setTimeoutMs] = useState(0);
  const [activeTimeout, setActiveTimeout] = useState(null); // 'home' | 'away' | null

  // Logs & History (Undo/Redo)
  const [logs, setLogs] = useState([]);
  const [history, setHistory] = useState([]); // Stack of previous states for undo
  const [redoStack, setRedoStack] = useState([]);

  // UI States
  const [activeTab, setActiveTab] = useState('board'); // board, settings, roster, summary
  const [blinkHome, setBlinkHome] = useState(false);
  const [blinkAway, setBlinkAway] = useState(false);

  // Broadcast Channel for Dual Screen Sync
  const bcRef = useRef(null);

  useEffect(() => {
    bcRef.current = new BroadcastChannel('basketball_scoreboard');
    
    if (isDisplayMode) {
      // Display Mode: Listen for state updates
      bcRef.current.onmessage = (event) => {
        if (event.data.type === 'SYNC_STATE') {
          const s = event.data.state;
          setSettings(s.settings);
          setHome(s.home);
          setAway(s.away);
          setQuarter(s.quarter);
          setPossession(s.possession);
          setClockMs(s.clockMs);
          setIsClockRunning(s.isClockRunning);
          setShotClockMs(s.shotClockMs);
          setIsShotClockRunning(s.isShotClockRunning);
          setTimeoutMs(s.timeoutMs);
          setActiveTimeout(s.activeTimeout);
          setBlinkHome(s.blinkHome);
          setBlinkAway(s.blinkAway);
        }
      };
    } else {
      // Controller Mode: Load from LocalStorage on mount
      const saved = localStorage.getItem('scoreboard_state');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setSettings(parsed.settings || DEFAULT_SETTINGS);
          setHome(parsed.home || home);
          setAway(parsed.away || away);
          setQuarter(parsed.quarter || "Q1");
          setClockMs(parsed.clockMs ?? (parsed.settings?.quarterMinutes * 60000));
          setLogs(parsed.logs || []);
        } catch (e) {
          console.error("Failed to parse save", e);
        }
      }
    }

    return () => bcRef.current.close();
  }, [isDisplayMode]);

  // Sync state to Display and LocalStorage
  useEffect(() => {
    if (!isDisplayMode) {
      const stateToSync = {
        settings, home, away, quarter, possession, clockMs, isClockRunning, 
        shotClockMs, isShotClockRunning, timeoutMs, activeTimeout, blinkHome, blinkAway
      };
      
      // Send to display
      if (bcRef.current) {
        bcRef.current.postMessage({ type: 'SYNC_STATE', state: stateToSync });
      }

      // Save to local storage (debounce slightly to avoid performance hit)
      const saveToLocal = setTimeout(() => {
        localStorage.setItem('scoreboard_state', JSON.stringify({
          settings, home, away, quarter, clockMs, logs
        }));
      }, 500);
      return () => clearTimeout(saveToLocal);
    }
  }, [settings, home, away, quarter, possession, clockMs, isClockRunning, shotClockMs, isShotClockRunning, timeoutMs, activeTimeout, blinkHome, blinkAway, logs, isDisplayMode]);

  useEffect(() => {
    let wakeLock = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen');
        }
      } catch (err) {
        console.warn(`Wake Lock error: ${err.name}, ${err.message}`);
      }
    };
    requestWakeLock();
    return () => {
      if (wakeLock) wakeLock.release();
    };
  }, []);

  useEffect(() => {
    let animationFrameId;

    const tick = () => {
      const now = Date.now();
      const dt = now - lastTickRef.current;
      lastTickRef.current = now;

      if (isClockRunning) {
        setClockMs(prev => {
          const next = prev - dt;
          if (next <= 0) {
            setIsClockRunning(false);
            setIsShotClockRunning(false);
            if (settings.soundEnabled && !isDisplayMode) playHorn('quarter', settings.soundVolume / 100);
            return 0;
          }
          return next;
        });
      }

      if (isShotClockRunning) {
        setShotClockMs(prev => {
          const next = prev - dt;
          if (next <= 0) {
            setIsShotClockRunning(false);
            if (settings.soundEnabled && !isDisplayMode) playHorn('shotclock', settings.soundVolume / 100);
            return 0;
          }
          return next;
        });
      }

      if (activeTimeout) {
        setTimeoutMs(prev => {
          const next = prev - dt;
          if (next <= 0) {
            setActiveTimeout(null);
            if (settings.soundEnabled && !isDisplayMode) playHorn('timeout', settings.soundVolume / 100);
            return 0;
          }
          // Warning beep at 10 seconds
          if (Math.floor(prev / 1000) === 10 && Math.floor(next / 1000) === 9 && settings.soundEnabled && !isDisplayMode) {
             playHorn('timeout', (settings.soundVolume / 100) * 0.5);
          }
          return next;
        });
      }

      animationFrameId = requestAnimationFrame(tick);
    };

    if (isClockRunning || isShotClockRunning || activeTimeout) {
      lastTickRef.current = Date.now();
      animationFrameId = requestAnimationFrame(tick);
    }

    return () => cancelAnimationFrame(animationFrameId);
  }, [isClockRunning, isShotClockRunning, activeTimeout, settings, isDisplayMode]);


  const toggleClock = () => {
    if (activeTimeout) return; // Don't run clock during timeout
    setIsClockRunning(!isClockRunning);
    // Shot clock syncs with game clock
    if (!isClockRunning && shotClockMs > 0 && clockMs > 0) {
       setIsShotClockRunning(true);
    } else {
       setIsShotClockRunning(false);
    }
  };

  const resetClock = () => {
    if (window.confirm('ยืนยันการรีเซ็ตเวลาการแข่งขัน?')) {
      setIsClockRunning(false);
      setClockMs(settings.quarterMinutes * 60000);
      setShotClockMs(settings.shotClockSeconds * 1000);
    }
  };

  const toggleShotClock = () => setIsShotClockRunning(!isShotClockRunning);
  const resetShotClock = (seconds) => {
    setShotClockMs(seconds * 1000);
    if (isClockRunning && clockMs > 0) setIsShotClockRunning(true);
  };

  const addLog = (message) => {
    const timeStr = formatTime(clockMs);
    setLogs(prev => [{ time: timeStr, msg: message, id: Date.now() }, ...prev].slice(0, 50));
  };

  const saveHistorySnapshot = () => {
    setHistory(prev => [...prev, { home: JSON.parse(JSON.stringify(home)), away: JSON.parse(JSON.stringify(away)), logs: [...logs] }].slice(-20));
    setRedoStack([]); // Clear redo stack on new action
  };

  const updateScore = (team, points, playerId = null) => {
    saveHistorySnapshot();
    const isHome = team === 'home';
    const setter = isHome ? setHome : setAway;
    const teamData = isHome ? home : away;
    const newScore = Math.max(0, teamData.score + points);
    
    // Blink effect
    if (isHome) { setBlinkHome(true); setTimeout(() => setBlinkHome(false), 500); }
    else { setBlinkAway(true); setTimeout(() => setBlinkAway(false), 500); }

    let logMsg = `${teamData.name} ${points > 0 ? '+' : ''}${points} คะแนน`;
    
    const newPlayers = [...teamData.players];
    if (playerId) {
      const pIdx = newPlayers.findIndex(p => p.id === playerId);
      if (pIdx >= 0) {
        newPlayers[pIdx].points = Math.max(0, newPlayers[pIdx].points + points);
        logMsg = `${newPlayers[pIdx].name} (${teamData.name}) ${points > 0 ? '+' : ''}${points} คะแนน`;
      }
    }

    setter({ ...teamData, score: newScore, players: newPlayers });
    addLog(logMsg);
  };

  const updateFouls = (team, amount, playerId = null) => {
    saveHistorySnapshot();
    const isHome = team === 'home';
    const setter = isHome ? setHome : setAway;
    const teamData = isHome ? home : away;
    const newFouls = Math.max(0, teamData.fouls + amount);
    
    let logMsg = `${teamData.name} ฟาวล์ ${amount > 0 ? '+1' : '-1'}`;

    const newPlayers = [...teamData.players];
    if (playerId) {
      const pIdx = newPlayers.findIndex(p => p.id === playerId);
      if (pIdx >= 0) {
        newPlayers[pIdx].fouls = Math.max(0, newPlayers[pIdx].fouls + amount);
        logMsg = `${newPlayers[pIdx].name} (${teamData.name}) ฟาวล์ ${amount > 0 ? '+1' : '-1'}`;
      }
    }

    setter({ ...teamData, fouls: newFouls, players: newPlayers });
    addLog(logMsg);
  };

  const startTimeout = (team) => {
    const teamData = team === 'home' ? home : away;
    if (teamData.timeouts <= 0) return alert('จำนวนเวลานอกหมดแล้ว');
    
    setIsClockRunning(false);
    setIsShotClockRunning(false);
    
    if (team === 'home') setHome({ ...home, timeouts: home.timeouts - 1 });
    else setAway({ ...away, timeouts: away.timeouts - 1 });
    
    setActiveTimeout(team);
    setTimeoutMs(settings.timeoutDuration * 1000);
    addLog(`${teamData.name} ขอเวลานอก`);
  };

  const stopTimeout = () => {
    setActiveTimeout(null);
    setTimeoutMs(0);
  };

  const nextQuarter = () => {
    if (window.confirm('ยืนยันการเปลี่ยนควอเตอร์? (ระบบจะรีเซ็ตเวลาและฟาวล์ทีม)')) {
      const qList = ["Q1", "Q2", "Q3", "Q4", "OT"];
      const nextIdx = Math.min(qList.indexOf(quarter) + 1, 4);
      setQuarter(qList[nextIdx]);
      setHome({ ...home, fouls: 0 });
      setAway({ ...away, fouls: 0 });
      setClockMs(settings.quarterMinutes * 60000);
      setShotClockMs(settings.shotClockSeconds * 1000);
      setIsClockRunning(false);
      setIsShotClockRunning(false);
      addLog(`เริ่ม ${qList[nextIdx]}`);
    }
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const currentStateSnapshot = { home, away, logs };
    setRedoStack(prev => [currentStateSnapshot, ...prev]);
    
    const prev = history[history.length - 1];
    setHome(prev.home);
    setAway(prev.away);
    setLogs(prev.logs);
    setHistory(history.slice(0, -1));
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const currentStateSnapshot = { home, away, logs };
    setHistory(prev => [...prev, currentStateSnapshot]);
    
    const next = redoStack[0];
    setHome(next.home);
    setAway(next.away);
    setLogs(next.logs);
    setRedoStack(redoStack.slice(1));
  };

  const openDisplayWindow = () => {
    window.open(window.location.href + '?mode=display', 'ScoreboardDisplay', 'width=1280,height=720,menubar=no,toolbar=no');
  };

  useEffect(() => {
    if (isDisplayMode) return;
    const handleKeyDown = (e) => {
      // Don't trigger if typing in inputs
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      
      switch(e.code) {
        case 'Space': 
          e.preventDefault();
          toggleClock(); 
          break;
        case 'KeyR':
          if (e.shiftKey) resetClock();
          break;
        case 'KeyH':
          playHorn('quarter', settings.soundVolume / 100);
          break;
        case 'ArrowLeft':
          setPossession('home');
          break;
        case 'ArrowRight':
          setPossession('away');
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isClockRunning, clockMs, shotClockMs, settings, activeTimeout, isDisplayMode]);


  const renderFoulDots = (fouls, isBonus) => {
    const dots = [];
    for (let i = 0; i < settings.bonusFoulLimit; i++) {
      dots.push(
        <span key={i} className={`inline-block w-4 h-4 rounded-full mx-1 ${
          i < fouls ? 'bg-red-500' : 'bg-gray-700'
        }`}></span>
      );
    }
    return (
      <div className="flex flex-col items-center mt-2">
        <div className="flex">{dots}</div>
        <div className={`mt-1 font-bold text-xl tracking-widest ${isBonus ? 'text-yellow-400 animate-pulse' : 'text-gray-800'}`}>
          BONUS
        </div>
      </div>
    );
  };

  const ScoreboardDisplay = ({ minimal = false }) => {
    const homeBonus = home.fouls >= settings.bonusFoulLimit;
    const awayBonus = away.fouls >= settings.bonusFoulLimit;
    const clockColor = clockMs <= 60000 ? (clockMs <= 10000 ? 'text-red-500' : 'text-yellow-400') : 'text-white';
    const shotClockColor = shotClockMs <= 5000 ? 'text-red-500' : 'text-yellow-400';

    return (
      <div className="flex flex-col w-full h-full bg-black text-white font-sans select-none border-4 border-gray-800 overflow-hidden" 
           style={{ fontFamily: "'Inter', sans-serif" }}>
        
        {/* Header */}
        <div className="text-center py-2 bg-gray-900 border-b border-gray-700">
          <h1 className="text-2xl md:text-4xl font-bold tracking-wide uppercase text-gray-200">
            {settings.gameName}
          </h1>
        </div>

        {/* Main Board Area */}
        <div className="flex flex-1 flex-col md:flex-row items-stretch justify-between p-2 md:p-6 gap-4">
          
          {/* HOME TEAM */}
          <div className="flex-1 flex flex-col items-center justify-around bg-gray-950 p-4 rounded-2xl border-2 shadow-2xl relative" style={{ borderColor: home.color }}>
            <div className={`absolute inset-0 bg-blue-500 opacity-0 transition-opacity duration-300 pointer-events-none rounded-xl ${blinkHome ? 'opacity-20' : ''}`}></div>
            
            <div className="flex items-center gap-4">
              <h2 className="text-4xl md:text-6xl font-black uppercase truncate max-w-[300px]" style={{ color: home.color }}>{home.name}</h2>
              {possession === 'home' && <div className="text-4xl text-yellow-400" style={{ textShadow: '0 0 15px currentColor' }}>◀</div>}
            </div>
            
            <div className="font-mono leading-none font-bold text-white tracking-tighter" 
                 style={{ fontSize: 'clamp(7rem, 15vw, 15rem)', textShadow: '0 0 30px rgba(255,255,255,0.3)' }}>
              {home.score}
            </div>
            
            <div className="flex w-full justify-around mt-4">
              <div className="flex flex-col items-center">
                <span className="text-gray-400 uppercase font-bold text-xl">FOULS</span>
                <span className="text-5xl font-mono text-red-500 font-bold">{home.fouls}</span>
                {renderFoulDots(home.fouls, homeBonus)}
              </div>
              <div className="flex flex-col items-center">
                <span className="text-gray-400 uppercase font-bold text-xl">T.O.L.</span>
                <div className="flex gap-2 mt-2">
                  {[...Array(settings.timeoutsPerTeam)].map((_, i) => (
                    <div key={i} className={`w-8 h-3 rounded-sm ${i < home.timeouts ? 'bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.6)]' : 'bg-gray-800'}`}></div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* CENTER - CLOCKS (อัปเดตให้มีขนาดใหญ่ขึ้นและพื้นที่กว้างขึ้น) */}
          <div className="flex-[1.5] flex flex-col items-center justify-center bg-gray-900 p-4 rounded-3xl border-2 border-gray-700 shadow-2xl z-10 relative overflow-hidden">
            
            {activeTimeout ? (
              <div className="flex flex-col items-center mb-4 w-full bg-yellow-600 rounded-lg p-4 animate-pulse">
                <span className="text-2xl md:text-5xl font-bold uppercase text-black">TIMEOUT - {activeTimeout === 'home' ? home.name : away.name}</span>
                <div className="text-7xl md:text-9xl font-mono font-bold text-black tracking-tighter">{formatTime(timeoutMs)}</div>
              </div>
            ) : null}

            <div className="text-5xl md:text-6xl font-bold text-gray-400 mb-2 uppercase tracking-widest">{quarter}</div>
            
            {/* GAME CLOCK - ขยายให้ใหญ่สุดและเรืองแสง */}
            <div className={`font-mono font-bold leading-none tracking-tighter ${clockColor} ${!isClockRunning && clockMs > 0 ? 'opacity-90' : ''}`}
                 style={{ 
                   fontSize: 'clamp(8rem, 18vw, 24rem)', 
                   fontVariantNumeric: 'tabular-nums',
                   textShadow: '0 10px 30px rgba(0,0,0,0.8), 0 0 60px currentColor'
                 }}>
              {formatTime(clockMs)}
            </div>
            {clockMs === 0 && !isClockRunning && <div className="text-red-500 font-bold text-5xl mt-2 mb-4 animate-pulse shadow-black drop-shadow-2xl">END OF {quarter}</div>}
            
            {/* SHOT CLOCK - ปรับให้เรืองแสงและใหญ่ขึ้น */}
            <div className="mt-8 flex flex-col items-center bg-black px-10 py-6 rounded-2xl border-2 border-gray-800 w-full max-w-lg">
              <span className="text-gray-500 text-2xl font-bold uppercase tracking-widest mb-2">SHOT CLOCK</span>
              <div className={`font-mono font-bold leading-none ${shotClockColor}`}
                   style={{ 
                     fontSize: 'clamp(6rem, 12vw, 16rem)',
                     textShadow: '0 0 40px currentColor'
                   }}>
                {shotClockMs === 0 ? '00' : formatShotClock(shotClockMs).padStart(2, '0')}
              </div>
            </div>

          </div>

          {/* AWAY TEAM */}
          <div className="flex-1 flex flex-col items-center justify-around bg-gray-950 p-4 rounded-2xl border-2 shadow-2xl relative" style={{ borderColor: away.color }}>
             <div className={`absolute inset-0 bg-red-500 opacity-0 transition-opacity duration-300 pointer-events-none rounded-xl ${blinkAway ? 'opacity-20' : ''}`}></div>
            
            <div className="flex items-center gap-4">
              {possession === 'away' && <div className="text-4xl text-yellow-400" style={{ textShadow: '0 0 15px currentColor' }}>▶</div>}
              <h2 className="text-4xl md:text-6xl font-black uppercase truncate max-w-[300px]" style={{ color: away.color }}>{away.name}</h2>
            </div>
            
            <div className="font-mono leading-none font-bold text-white tracking-tighter" 
                 style={{ fontSize: 'clamp(7rem, 15vw, 15rem)', textShadow: '0 0 30px rgba(255,255,255,0.3)' }}>
              {away.score}
            </div>
            
            <div className="flex w-full justify-around mt-4">
              <div className="flex flex-col items-center">
                <span className="text-gray-400 uppercase font-bold text-xl">FOULS</span>
                <span className="text-5xl font-mono text-red-500 font-bold">{away.fouls}</span>
                {renderFoulDots(away.fouls, awayBonus)}
              </div>
              <div className="flex flex-col items-center">
                <span className="text-gray-400 uppercase font-bold text-xl">T.O.L.</span>
                <div className="flex gap-2 mt-2">
                  {[...Array(settings.timeoutsPerTeam)].map((_, i) => (
                    <div key={i} className={`w-8 h-3 rounded-sm ${i < away.timeouts ? 'bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.6)]' : 'bg-gray-800'}`}></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (isDisplayMode) {
    return (
      <div className="w-screen h-screen bg-black overflow-hidden flex items-center justify-center p-2">
        <ScoreboardDisplay />
      </div>
    );
  }

  const ControlButton = ({ onClick, icon: Icon, label, color = "bg-gray-700 hover:bg-gray-600", disabled = false }) => (
    <button 
      onClick={onClick} 
      disabled={disabled}
      className={`flex flex-col items-center justify-center p-3 rounded-lg shadow-md transition-all active:scale-95 ${color} ${disabled ? 'opacity-50 cursor-not-allowed' : 'text-white'}`}
    >
      {Icon && <Icon size={24} className="mb-1" />}
      <span className="text-sm font-bold">{label}</span>
    </button>
  );

  const TeamControls = ({ team, type }) => {
    const data = type === 'home' ? home : away;
    return (
      <div className="bg-gray-800 p-4 rounded-xl space-y-4 border-t-4" style={{ borderColor: data.color }}>
        <h3 className="text-xl font-bold text-center text-white">{data.name}</h3>
        
        {/* Score Controls */}
        <div className="space-y-2">
          <div className="text-gray-400 text-xs font-semibold uppercase">Score</div>
          <div className="grid grid-cols-3 gap-2">
            <ControlButton label="+1" color="bg-green-600 hover:bg-green-500" onClick={() => updateScore(type, 1)} />
            <ControlButton label="+2" color="bg-green-600 hover:bg-green-500" onClick={() => updateScore(type, 2)} />
            <ControlButton label="+3" color="bg-green-600 hover:bg-green-500" onClick={() => updateScore(type, 3)} />
            <ControlButton label="-1" color="bg-red-800 hover:bg-red-700" onClick={() => updateScore(type, -1)} />
            <div className="col-span-2">
              <ControlButton label="ตั้งคะแนน" icon={Settings} onClick={() => {
                const val = prompt(`ตั้งคะแนน ${data.name}:`, data.score);
                if (val !== null && !isNaN(val)) {
                  saveHistorySnapshot();
                  type === 'home' ? setHome({...home, score: parseInt(val)}) : setAway({...away, score: parseInt(val)});
                  addLog(`ตั้งคะแนน ${data.name} เป็น ${val}`);
                }
              }} />
            </div>
          </div>
        </div>

        {/* Foul & Timeout Controls */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="text-gray-400 text-xs font-semibold uppercase">Fouls</div>
            <div className="flex gap-2">
              <ControlButton label="+1" color="bg-yellow-600 hover:bg-yellow-500" onClick={() => updateFouls(type, 1)} />
              <ControlButton label="-1" color="bg-gray-600 hover:bg-gray-500" onClick={() => updateFouls(type, -1)} />
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-gray-400 text-xs font-semibold uppercase">Timeouts ({data.timeouts})</div>
            <ControlButton 
              label="ขอเวลานอก" 
              color="bg-orange-600 hover:bg-orange-500" 
              onClick={() => startTimeout(type)} 
              disabled={activeTimeout !== null || data.timeouts <= 0}
            />
          </div>
        </div>
      </div>
    );
  };

  const SettingsPanel = () => (
    <div className="bg-gray-800 p-6 rounded-xl text-white max-w-4xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold flex items-center gap-2"><Settings /> ตั้งค่าการแข่งขัน</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-300 border-b border-gray-600 pb-2">ข้อมูลทั่วไป</h3>
          <div>
            <label className="block text-sm mb-1">ชื่อการแข่งขัน</label>
            <input type="text" value={settings.gameName} onChange={e => setSettings({...settings, gameName: e.target.value})} className="w-full bg-gray-700 p-2 rounded text-white border border-gray-600" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">ชื่อทีมเหย้า</label>
              <input type="text" value={home.name} onChange={e => setHome({...home, name: e.target.value})} className="w-full bg-gray-700 p-2 rounded" />
            </div>
            <div>
              <label className="block text-sm mb-1">สีทีมเหย้า</label>
              <input type="color" value={home.color} onChange={e => setHome({...home, color: e.target.value})} className="w-full h-10 bg-gray-700 p-1 rounded" />
            </div>
            <div>
              <label className="block text-sm mb-1">ชื่อทีมเยือน</label>
              <input type="text" value={away.name} onChange={e => setAway({...away, name: e.target.value})} className="w-full bg-gray-700 p-2 rounded" />
            </div>
            <div>
              <label className="block text-sm mb-1">สีทีมเยือน</label>
              <input type="color" value={away.color} onChange={e => setAway({...away, color: e.target.value})} className="w-full h-10 bg-gray-700 p-1 rounded" />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-300 border-b border-gray-600 pb-2">กติกาและเวลา</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">เวลาต่อควอเตอร์ (นาที)</label>
              <input type="number" value={settings.quarterMinutes} onChange={e => setSettings({...settings, quarterMinutes: parseInt(e.target.value) || 10})} className="w-full bg-gray-700 p-2 rounded" />
            </div>
            <div>
              <label className="block text-sm mb-1">เวลานอก (วินาที)</label>
              <input type="number" value={settings.timeoutDuration} onChange={e => setSettings({...settings, timeoutDuration: parseInt(e.target.value) || 60})} className="w-full bg-gray-700 p-2 rounded" />
            </div>
            <div>
              <label className="block text-sm mb-1">Shot Clock (วินาที)</label>
              <input type="number" value={settings.shotClockSeconds} onChange={e => setSettings({...settings, shotClockSeconds: parseInt(e.target.value) || 24})} className="w-full bg-gray-700 p-2 rounded" />
            </div>
            <div>
              <label className="block text-sm mb-1">จำนวนเวลานอกต่อทีม</label>
              <input type="number" value={settings.timeoutsPerTeam} onChange={e => {
                const val = parseInt(e.target.value) || 3;
                setSettings({...settings, timeoutsPerTeam: val});
                setHome({...home, timeouts: val});
                setAway({...away, timeouts: val});
              }} className="w-full bg-gray-700 p-2 rounded" />
            </div>
            <div>
              <label className="block text-sm mb-1">โบนัสฟาวล์ทีม (ครั้ง)</label>
              <input type="number" value={settings.bonusFoulLimit} onChange={e => setSettings({...settings, bonusFoulLimit: parseInt(e.target.value) || 5})} className="w-full bg-gray-700 p-2 rounded" />
            </div>
            <div>
              <label className="block text-sm mb-1">ฟาวล์ผู้เล่น (Foul Out)</label>
              <input type="number" value={settings.playerFoulOutLimit} onChange={e => setSettings({...settings, playerFoulOutLimit: parseInt(e.target.value) || 5})} className="w-full bg-gray-700 p-2 rounded" />
            </div>
          </div>
          
          <div className="flex items-center gap-4 pt-4">
             <label className="flex items-center gap-2 cursor-pointer">
               <input type="checkbox" checked={settings.soundEnabled} onChange={e => setSettings({...settings, soundEnabled: e.target.checked})} className="w-5 h-5" />
               เปิดเสียง (นกหวีด/แตร)
             </label>
             {settings.soundEnabled && (
               <input type="range" min="0" max="100" value={settings.soundVolume} onChange={e => setSettings({...settings, soundVolume: parseInt(e.target.value)})} />
             )}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-4 mt-8 pt-4 border-t border-gray-700">
        <button onClick={() => {
            if(window.confirm('ล้างข้อมูลการแข่งขันทั้งหมด?')) {
              localStorage.removeItem('scoreboard_state');
              window.location.reload();
            }
          }} 
          className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white flex items-center gap-2">
          <Trash2 size={18} /> เริ่มการแข่งขันใหม่ (Reset All)
        </button>
      </div>
    </div>
  );

  const RosterPanel = () => {
    const renderTeamRoster = (team, setTeamObj) => (
      <div className="flex-1 bg-gray-800 p-4 rounded-xl border-t-4" style={{ borderColor: team.color }}>
        <h3 className="text-xl font-bold mb-4 text-white">{team.name} - ผู้เล่น</h3>
        <div className="flex gap-2 mb-4">
          <button onClick={() => {
            const num = prompt('หมายเลขเสื้อ:');
            if (!num) return;
            const name = prompt('ชื่อผู้เล่น:');
            setTeamObj({...team, players: [...team.players, { id: generateId(), number: num, name: name || `Player ${num}`, points: 0, fouls: 0, inGame: false }]});
          }} className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-sm text-white flex items-center gap-1"><Plus size={16}/> เพิ่มผู้เล่น</button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-300">
            <thead className="text-xs uppercase bg-gray-700 text-gray-400">
              <tr>
                <th className="px-2 py-2">#</th>
                <th className="px-2 py-2">ชื่อ</th>
                <th className="px-2 py-2">PTS</th>
                <th className="px-2 py-2">FLS</th>
                <th className="px-2 py-2">จัดการคะแนน/ฟาวล์ (ซิงก์ทีม)</th>
              </tr>
            </thead>
            <tbody>
              {team.players.map(p => (
                <tr key={p.id} className={`border-b border-gray-700 ${p.fouls >= settings.playerFoulOutLimit ? 'bg-red-900/50' : ''}`}>
                  <td className="px-2 py-2 font-bold">{p.number}</td>
                  <td className="px-2 py-2">
                    {p.name} {p.fouls >= settings.playerFoulOutLimit && <span className="text-xs bg-red-600 text-white px-1 rounded ml-1">FOUL OUT</span>}
                  </td>
                  <td className="px-2 py-2 font-mono text-lg">{p.points}</td>
                  <td className="px-2 py-2 font-mono text-lg text-red-400">{p.fouls}</td>
                  <td className="px-2 py-2 flex gap-1">
                     <button onClick={() => updateScore(team === home ? 'home' : 'away', 1, p.id)} className="px-2 py-1 bg-green-700 rounded hover:bg-green-600 text-xs">+1P</button>
                     <button onClick={() => updateScore(team === home ? 'home' : 'away', 2, p.id)} className="px-2 py-1 bg-green-700 rounded hover:bg-green-600 text-xs">+2P</button>
                     <button onClick={() => updateScore(team === home ? 'home' : 'away', 3, p.id)} className="px-2 py-1 bg-green-700 rounded hover:bg-green-600 text-xs">+3P</button>
                     <button onClick={() => updateFouls(team === home ? 'home' : 'away', 1, p.id)} className="px-2 py-1 bg-yellow-700 rounded hover:bg-yellow-600 text-xs" disabled={p.fouls >= settings.playerFoulOutLimit}>+F</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {team.players.length === 0 && <p className="text-center text-gray-500 mt-4">ยังไม่มีรายชื่อผู้เล่น</p>}
        </div>
      </div>
    );

    return (
      <div className="flex flex-col md:flex-row gap-6 max-w-6xl mx-auto">
        {renderTeamRoster(home, setHome)}
        {renderTeamRoster(away, setAway)}
      </div>
    );
  };

  const SummaryPanel = () => {
    const handlePrint = () => window.print();
    
    return (
      <div className="bg-white text-black p-8 rounded max-w-4xl mx-auto shadow-lg printable-area">
        <style>{`
          @media print {
            body * { visibility: hidden; }
            .printable-area, .printable-area * { visibility: visible; }
            .printable-area { position: absolute; left: 0; top: 0; width: 100%; }
            .no-print { display: none; }
          }
        `}</style>
        
        <div className="text-center border-b-2 border-gray-800 pb-4 mb-6">
          <h1 className="text-3xl font-black uppercase mb-2">{settings.gameName}</h1>
          <p className="text-gray-600">สรุปผลการแข่งขัน • {new Date().toLocaleDateString('th-TH')}</p>
        </div>

        <div className="flex justify-between items-center mb-8 bg-gray-100 p-6 rounded-xl">
          <div className="text-center w-1/3">
            <h2 className="text-2xl font-bold" style={{ color: home.color }}>{home.name}</h2>
            <p className="text-6xl font-bold mt-2">{home.score}</p>
            <p className="text-sm text-gray-500 mt-2">ฟาวล์รวม: {home.fouls}</p>
          </div>
          <div className="text-2xl font-black text-gray-400">VS</div>
          <div className="text-center w-1/3">
            <h2 className="text-2xl font-bold" style={{ color: away.color }}>{away.name}</h2>
            <p className="text-6xl font-bold mt-2">{away.score}</p>
            <p className="text-sm text-gray-500 mt-2">ฟาวล์รวม: {away.fouls}</p>
          </div>
        </div>

        <div className="text-center text-xl font-bold mb-8">
          ผลการแข่งขัน: {home.score > away.score ? `${home.name} ชนะ` : home.score < away.score ? `${away.name} ชนะ` : 'เสมอ'}
        </div>

        <div className="flex justify-center gap-4 mt-8 no-print">
          <button onClick={handlePrint} className="px-6 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700 flex items-center gap-2">
            <Printer size={20} /> พิมพ์ / บันทึก PDF
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 font-sans flex flex-col">
      {/* Top Navigation */}
      <nav className="bg-gray-900 p-2 border-b border-gray-800 flex justify-between items-center px-4">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-white flex items-center gap-2"><Monitor size={20}/> SB Control</h1>
          <div className="flex bg-gray-800 rounded-lg p-1">
            <button onClick={() => setActiveTab('board')} className={`px-4 py-1 text-sm font-semibold rounded-md ${activeTab === 'board' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>สกอร์บอร์ด</button>
            <button onClick={() => setActiveTab('roster')} className={`px-4 py-1 text-sm font-semibold rounded-md ${activeTab === 'roster' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>ผู้เล่น</button>
            <button onClick={() => setActiveTab('settings')} className={`px-4 py-1 text-sm font-semibold rounded-md ${activeTab === 'settings' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>ตั้งค่า</button>
            <button onClick={() => setActiveTab('summary')} className={`px-4 py-1 text-sm font-semibold rounded-md ${activeTab === 'summary' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>สรุปผล</button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={openDisplayWindow} className="flex items-center gap-1 px-3 py-1.5 bg-green-700 hover:bg-green-600 rounded text-sm font-bold text-white shadow">
            <Maximize size={16} /> เปิดหน้าจอแสดงผล
          </button>
        </div>
      </nav>

      {/* Main Content Area based on Tab */}
      <main className="flex-1 overflow-auto p-4 flex flex-col">
        {activeTab === 'settings' && <SettingsPanel />}
        {activeTab === 'roster' && <RosterPanel />}
        {activeTab === 'summary' && <SummaryPanel />}
        
        {activeTab === 'board' && (
          <div className="flex flex-col lg:flex-row gap-4 h-full">
            
            {/* LEFT: Mini Display & Logs */}
            <div className="w-full lg:w-1/3 flex flex-col gap-4">
              <div className="h-64 rounded-xl overflow-hidden border border-gray-700 relative">
                 <div className="absolute top-1 left-2 text-[10px] text-gray-400 font-mono z-20">PREVIEW</div>
                 <div className="transform scale-[0.4] origin-top-left w-[250%] h-[250%]">
                    <ScoreboardDisplay minimal />
                 </div>
              </div>
              
              <div className="bg-gray-900 rounded-xl p-4 flex-1 border border-gray-800 flex flex-col">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold text-gray-300 text-sm uppercase">ประวัติการทำรายการ</h3>
                  <div className="flex gap-2">
                    <button onClick={handleUndo} disabled={history.length === 0} className={`p-1 rounded ${history.length > 0 ? 'bg-gray-700 hover:bg-gray-600' : 'opacity-30'}`} title="Undo"><Undo size={16}/></button>
                    <button onClick={handleRedo} disabled={redoStack.length === 0} className={`p-1 rounded ${redoStack.length > 0 ? 'bg-gray-700 hover:bg-gray-600' : 'opacity-30'}`} title="Redo"><Redo size={16}/></button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto space-y-1 text-sm text-gray-400 font-mono">
                  {logs.map(log => (
                    <div key={log.id} className="border-b border-gray-800 pb-1">
                      <span className="text-blue-400 mr-2">[{log.time}]</span> {log.msg}
                    </div>
                  ))}
                  {logs.length === 0 && <div className="text-gray-600 text-center mt-4">ไม่มีประวัติ</div>}
                </div>
              </div>
            </div>

            {/* RIGHT: Main Control Panel */}
            <div className="w-full lg:w-2/3 flex flex-col gap-4">
              
              {/* Top Bar Controls (Time & General) */}
              <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 flex flex-wrap gap-4 items-center justify-between">
                
                {/* Clock Controls */}
                <div className="flex items-center gap-2">
                  <button 
                    onClick={toggleClock} 
                    className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold text-white shadow-lg ${isClockRunning ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-500 animate-pulse'}`}
                  >
                    {isClockRunning ? <><Square size={20}/> หยุดเวลา (Space)</> : <><Play size={20}/> เริ่มเวลา (Space)</>}
                  </button>
                  
                  <div className="flex flex-col gap-1 ml-2">
                    <button onClick={() => setClockMs(m => m + 60000)} className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs">+1 นาที</button>
                    <button onClick={() => setClockMs(m => m + 1000)} className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs">+1 วิ</button>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => setClockMs(m => Math.max(0, m - 60000))} className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs">-1 นาที</button>
                    <button onClick={() => setClockMs(m => Math.max(0, m - 1000))} className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs">-1 วิ</button>
                  </div>
                  
                  <button onClick={resetClock} className="p-3 bg-gray-700 hover:bg-gray-600 rounded-lg ml-2" title="รีเซ็ตเวลา (Shift+R)"><RotateCcw size={20}/></button>
                </div>

                {/* Shot Clock Controls */}
                <div className="flex items-center gap-2 bg-gray-800 p-2 rounded-lg">
                  <span className="text-xs font-bold text-gray-400 w-16">SHOT<br/>CLOCK</span>
                  <button onClick={toggleShotClock} className={`p-2 rounded ${isShotClockRunning ? 'bg-red-800' : 'bg-green-800'}`}>
                    {isShotClockRunning ? <Square size={16}/> : <Play size={16}/>}
                  </button>
                  <button onClick={() => resetShotClock(settings.shotClockSeconds)} className="px-3 py-2 bg-blue-900 hover:bg-blue-800 font-mono font-bold rounded text-sm">{settings.shotClockSeconds}</button>
                  <button onClick={() => resetShotClock(settings.shortShotClockSeconds)} className="px-3 py-2 bg-blue-900 hover:bg-blue-800 font-mono font-bold rounded text-sm">{settings.shortShotClockSeconds}</button>
                  <button onClick={() => setShotClockMs(m => m + 1000)} className="px-2 py-2 bg-gray-700 rounded text-xs">+1</button>
                  <button onClick={() => setShotClockMs(m => Math.max(0, m - 1000))} className="px-2 py-2 bg-gray-700 rounded text-xs">-1</button>
                </div>

              </div>

              {/* Middle Bar: Quarter, Possession, Horn */}
              <div className="flex gap-4">
                 <div className="bg-gray-900 p-3 rounded-xl border border-gray-800 flex flex-1 items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-gray-400">ควอเตอร์:</span>
                      <span className="text-2xl font-bold text-white w-12 text-center">{quarter}</span>
                      <button onClick={nextQuarter} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm flex items-center gap-1">ถัดไป <ArrowRight size={14}/></button>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-gray-400">ครองบอล:</span>
                      <button onClick={() => setPossession('home')} className={`px-4 py-1 rounded font-bold transition ${possession === 'home' ? 'bg-yellow-500 text-black' : 'bg-gray-800'}`}>เหย้า ◀</button>
                      <button onClick={() => setPossession('away')} className={`px-4 py-1 rounded font-bold transition ${possession === 'away' ? 'bg-yellow-500 text-black' : 'bg-gray-800'}`}>▶ เยือน</button>
                    </div>

                    <div className="flex gap-2">
                       <button onClick={() => playHorn('quarter', settings.soundVolume/100)} className="p-2 bg-orange-700 hover:bg-orange-600 rounded-lg flex items-center gap-1 text-sm font-bold shadow-lg">
                         <Volume2 size={18}/> แตรยาว (H)
                       </button>
                       {activeTimeout && (
                         <button onClick={stopTimeout} className="p-2 bg-red-700 hover:bg-red-600 rounded-lg text-sm font-bold shadow-lg">
                           จบเวลานอก
                         </button>
                       )}
                    </div>
                 </div>
              </div>

              {/* Team Controls */}
              <div className="grid grid-cols-2 gap-4 flex-1">
                <TeamControls team="home" type="home" />
                <TeamControls team="away" type="away" />
              </div>

            </div>
          </div>
        )}
      </main>
    </div>
  );
}
