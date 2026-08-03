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
      // ปรับปรุงเสียงแตรยาวให้มีความดุดันเหมือนแตรสนาม
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, ctx.currentTime);
      
      const osc2 = ctx.createOscillator();
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(125, ctx.currentTime);
      osc2.connect(gainNode);
      
      gainNode.gain.setValueAtTime(volume, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 2.0);
      
      osc.start();
      osc2.start();
      osc.stop(ctx.currentTime + 2.0);
      osc2.stop(ctx.currentTime + 2.0);
    } else if (type === 'shotclock') {
      // สังเคราะห์เสียง Buzzer ให้มีความทุ้มและแตกพร่าคล้ายของจริง
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(110, ctx.currentTime);
      
      // เพิ่ม Oscillator ตัวที่ 2 (ปรับความถี่เพี้ยนเล็กน้อยเพื่อสร้างเสียงรัว/Buzzer effect)
      const osc2 = ctx.createOscillator();
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(115, ctx.currentTime); 
      osc2.connect(gainNode);
      
      // เพิ่ม Oscillator ตัวที่ 3 (คลื่นสี่เหลี่ยมเสียงทุ้มต่ำเพื่อสร้างมวลเสียง)
      const osc3 = ctx.createOscillator();
      osc3.type = 'square';
      osc3.frequency.setValueAtTime(55, ctx.currentTime); 
      osc3.connect(gainNode);

      // ลด Gain ลงเล็กน้อยเพื่อป้องกันเสียงแตก (Clipping) จากการรวมคลื่น
      gainNode.gain.setValueAtTime(volume / 2.5, ctx.currentTime);
      gainNode.gain.setValueAtTime(volume / 2.5, ctx.currentTime + 1.0);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
      
      osc.start();
      osc2.start();
      osc3.start();
      osc.stop(ctx.currentTime + 1.2);
      osc2.stop(ctx.currentTime + 1.2);
      osc3.stop(ctx.currentTime + 1.2);
    } else if (type === 'timeout') {
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
  color: "#000000",
  players: [],
};

const generateId = () => Math.random().toString(36).substr(2, 9);

const formatTime = (ms) => {
  if (ms < 0) ms = 0;
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const tenths = Math.floor((ms % 1000) / 100);

  if (minutes === 0 && seconds < 60) {
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${tenths}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const formatShotClock = (ms) => {
  if (ms < 0) ms = 0;
  return Math.ceil(ms / 1000).toString();
};

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

const CustomModal = ({ isOpen, type, title, message, defaultValue, onClose, onConfirm }) => {
  const [input1, setInput1] = useState('');
  const [input2, setInput2] = useState('');

  useEffect(() => { 
    if (isOpen) {
      setInput1(defaultValue !== undefined ? String(defaultValue) : ''); 
      setInput2(''); 
    }
  }, [isOpen, defaultValue]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 p-6 rounded-xl border border-gray-600 shadow-2xl max-w-sm w-full text-white transform transition-all">
        <h3 className="text-xl font-bold mb-2">{title}</h3>
        {message && <p className="text-gray-300 mb-4 text-sm">{message}</p>}

        {type === 'prompt' && (
          <input type="number" value={input1} onChange={e => setInput1(e.target.value)} className="w-full bg-gray-900 border border-gray-700 p-2 rounded mb-4 text-white focus:outline-none focus:border-blue-500" autoFocus />
        )}
        {type === 'addPlayer' && (
          <div className="flex flex-col gap-3 mb-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">หมายเลขเสื้อ *</label>
              <input type="text" placeholder="เช่น 0, 23, 99" value={input1} onChange={e => setInput1(e.target.value)} className="w-full bg-gray-900 border border-gray-700 p-2 rounded text-white focus:outline-none focus:border-blue-500" autoFocus />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">ชื่อผู้เล่น (ตัวเลือก)</label>
              <input type="text" placeholder="ชื่อผู้เล่น" value={input2} onChange={e => setInput2(e.target.value)} className="w-full bg-gray-900 border border-gray-700 p-2 rounded text-white focus:outline-none focus:border-blue-500" />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6">
          {type !== 'alert' && (
            <button onClick={onClose} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 transition-colors rounded-lg text-sm font-semibold">ยกเลิก</button>
          )}
          <button onClick={() => {
            if (type === 'prompt') onConfirm(input1);
            else if (type === 'addPlayer') onConfirm({ number: input1, name: input2 });
            else if (onConfirm) onConfirm();
            onClose();
          }} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 transition-colors rounded-lg text-sm font-bold shadow-lg">ตกลง</button>
        </div>
      </div>
    </div>
  );
};

export default function Scoreboard() {
  const isDisplayMode = new URLSearchParams(window.location.search).get('mode') === 'display';

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [home, setHome] = useState({ ...DEFAULT_TEAM, name: "HOME", color: "#1e3a8a" });
  const [away, setAway] = useState({ ...DEFAULT_TEAM, name: "AWAY", color: "#991b1b" });
  const [quarter, setQuarter] = useState("Q1");
  const [possession, setPossession] = useState("home");
  const [clockMs, setClockMs] = useState(10 * 60 * 1000);
  const [isClockRunning, setIsClockRunning] = useState(false);
  const [shotClockMs, setShotClockMs] = useState(24 * 1000);
  const [isShotClockRunning, setIsShotClockRunning] = useState(false);
  const [timeoutMs, setTimeoutMs] = useState(0);
  const [activeTimeout, setActiveTimeout] = useState(null);
  const [logs, setLogs] = useState([]);
  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [activeTab, setActiveTab] = useState('board');
  const [blinkHome, setBlinkHome] = useState(false);
  const [blinkAway, setBlinkAway] = useState(false);

  // Modal State mapping
  const [modalConfig, setModalConfig] = useState({ isOpen: false, type: 'alert', title: '', message: '', defaultValue: '', onConfirm: null });

  const clockRef = useRef(null);
  const lastTickRef = useRef(Date.now());
  const bcRef = useRef(null);
  
  // Use useRef to keep the latest state for replying when display window requests
  const stateRef = useRef();
  useEffect(() => {
    stateRef.current = {
      settings, home, away, quarter, possession, clockMs, isClockRunning, 
      shotClockMs, isShotClockRunning, timeoutMs, activeTimeout, blinkHome, blinkAway
    };
  });

  useEffect(() => {
    bcRef.current = new BroadcastChannel('basketball_scoreboard');
    
    if (isDisplayMode) {
      // Fetch initial data from LocalStorage
      const saved = localStorage.getItem('scoreboard_state');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.settings) setSettings(parsed.settings);
          if (parsed.home) setHome(parsed.home);
          if (parsed.away) setAway(parsed.away);
          if (parsed.quarter) setQuarter(parsed.quarter);
          if (parsed.clockMs !== undefined) setClockMs(parsed.clockMs);
        } catch (e) {}
      }

      // Request latest data from the control panel
      bcRef.current.postMessage({ type: 'REQUEST_SYNC' });

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
      // Load from LocalStorage for Control Panel
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
        } catch (e) {}
      }

      // Listen for sync requests from Display Window
      bcRef.current.onmessage = (event) => {
        if (event.data.type === 'REQUEST_SYNC' && stateRef.current) {
          bcRef.current.postMessage({ type: 'SYNC_STATE', state: stateRef.current });
        }
      };
    }

    return () => bcRef.current.close();
  }, [isDisplayMode]);

  useEffect(() => {
    if (!isDisplayMode) {
      if (bcRef.current && stateRef.current) {
        bcRef.current.postMessage({ type: 'SYNC_STATE', state: stateRef.current });
      }
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
      try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } 
      catch (err) {}
    };
    requestWakeLock();
    return () => { if (wakeLock) wakeLock.release(); };
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


  const showConfirm = (title, message, onConfirm) => setModalConfig({ isOpen: true, type: 'confirm', title, message, onConfirm });
  const showAlert = (title, message) => setModalConfig({ isOpen: true, type: 'alert', title, message, onConfirm: null });
  const showPrompt = (title, message, defaultValue, onConfirm) => setModalConfig({ isOpen: true, type: 'prompt', title, message, defaultValue, onConfirm });
  const showAddPlayer = (team, onConfirm) => setModalConfig({ isOpen: true, type: 'addPlayer', title: `เพิ่มผู้เล่น ${team.name}`, message: '', onConfirm });
  const closeModal = () => setModalConfig({ ...modalConfig, isOpen: false });

  const toggleClock = () => {
    if (activeTimeout) return;
    setIsClockRunning(!isClockRunning);
    if (!isClockRunning && shotClockMs > 0 && clockMs > 0) setIsShotClockRunning(true);
    else setIsShotClockRunning(false);
  };

  const resetClock = () => {
    showConfirm('ยืนยันการทำรายการ', 'ยืนยันการรีเซ็ตเวลาการแข่งขัน?', () => {
      setIsClockRunning(false);
      setClockMs(settings.quarterMinutes * 60000);
      setShotClockMs(settings.shotClockSeconds * 1000);
    });
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
    setRedoStack([]);
  };

  const updateScore = (team, points, playerId = null) => {
    saveHistorySnapshot();
    const isHome = team === 'home';
    const setter = isHome ? setHome : setAway;
    const teamData = isHome ? home : away;
    const newScore = Math.max(0, teamData.score + points);
    
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
    if (teamData.timeouts <= 0) {
      showAlert('แจ้งเตือน', 'จำนวนเวลานอกสำหรับทีมนี้หมดแล้ว');
      return;
    }
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
    showConfirm('ยืนยัน', 'ยืนยันการเปลี่ยนควอเตอร์? (ระบบจะรีเซ็ตเวลาและฟาวล์ทีม)', () => {
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
    });
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    setRedoStack(prev => [{ home, away, logs }, ...prev]);
    const prev = history[history.length - 1];
    setHome(prev.home); setAway(prev.away); setLogs(prev.logs);
    setHistory(history.slice(0, -1));
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    setHistory(prev => [...prev, { home, away, logs }]);
    const next = redoStack[0];
    setHome(next.home); setAway(next.away); setLogs(next.logs);
    setRedoStack(redoStack.slice(1));
  };

  const openDisplayWindow = () => {
    window.open(window.location.href + '?mode=display', 'ScoreboardDisplay', 'width=1280,height=720,menubar=no,toolbar=no');
  };

  useEffect(() => {
    if (isDisplayMode) return;
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (modalConfig.isOpen) return; // Prevent shortcuts if a modal is open
      switch(e.code) {
        case 'Space': e.preventDefault(); toggleClock(); break;
        case 'KeyH': playHorn('quarter', settings.soundVolume / 100); break;
        case 'ArrowLeft': setPossession('home'); break;
        case 'ArrowRight': setPossession('away'); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isClockRunning, clockMs, shotClockMs, settings, activeTimeout, isDisplayMode, modalConfig.isOpen]);

  const renderFoulDots = (fouls, isBonus) => {
    const dots = [];
    for (let i = 0; i < settings.bonusFoulLimit; i++) {
      dots.push(<span key={i} className={`inline-block w-4 h-4 rounded-full mx-1 ${i < fouls ? 'bg-red-500' : 'bg-gray-700'}`}></span>);
    }
    return (
      <div className="flex flex-col items-center mt-2">
        <div className="flex">{dots}</div>
        <div className={`mt-1 font-bold text-xl tracking-widest ${isBonus ? 'text-yellow-400 animate-pulse' : 'text-gray-800'}`}>BONUS</div>
      </div>
    );
  };

  const renderScoreboardDisplay = (minimal = false) => {
    const homeBonus = home.fouls >= settings.bonusFoulLimit;
    const awayBonus = away.fouls >= settings.bonusFoulLimit;
    const clockColor = clockMs <= 60000 ? (clockMs <= 10000 ? 'text-red-500' : 'text-yellow-400') : 'text-white';
    const shotClockColor = shotClockMs <= 5000 ? 'text-red-500' : 'text-yellow-400';

    return (
      <div className="flex flex-col w-full h-full bg-black text-white font-sans select-none border-4 border-gray-800 overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
        
        <div className="text-center py-2 bg-gray-900 border-b border-gray-700">
          <h1 className="text-2xl md:text-5xl font-bold tracking-wide uppercase text-gray-200">{settings.gameName}</h1>
        </div>

        <div className="flex flex-1 flex-col md:flex-row items-stretch justify-between p-2 md:p-4 gap-4">
          {/* HOME TEAM */}
          <div className="flex-1 flex flex-col items-center justify-around bg-gray-950 p-4 rounded-2xl border-2 shadow-2xl relative" style={{ borderColor: home.color }}>
            <div className={`absolute inset-0 bg-blue-500 opacity-0 transition-opacity duration-300 pointer-events-none rounded-xl ${blinkHome ? 'opacity-20' : ''}`}></div>
            <div className="flex items-center gap-4">
              <h2 className="text-4xl md:text-6xl font-black uppercase truncate max-w-[280px]" style={{ color: home.color }}>{home.name}</h2>
              {possession === 'home' && <div className="text-4xl text-yellow-400" style={{ textShadow: '0 0 15px currentColor' }}>◀</div>}
            </div>
            <div className="font-mono leading-none font-bold text-white tracking-tighter" style={{ fontSize: 'clamp(6rem, 13vw, 15rem)', textShadow: '0 0 30px rgba(255,255,255,0.3)' }}>{home.score}</div>
            <div className="flex w-full justify-around mt-2">
              <div className="flex flex-col items-center">
                <span className="text-gray-400 uppercase font-bold text-xl">FOULS</span>
                <span className="text-5xl font-mono text-red-500 font-bold">{home.fouls}</span>
                {renderFoulDots(home.fouls, homeBonus)}
              </div>
              <div className="flex flex-col items-center">
                <span className="text-gray-400 uppercase font-bold text-base md:text-xl text-center leading-tight">Time Outs Left</span>
                <div className="flex gap-2 mt-2">
                  {[...Array(settings.timeoutsPerTeam)].map((_, i) => (
                    <div key={i} className={`w-8 h-3 rounded-sm ${i < home.timeouts ? 'bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.6)]' : 'bg-gray-800'}`}></div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* CENTER - CLOCKS */}
          <div className="flex-[1.5] flex flex-col items-center justify-center bg-gray-900 p-2 md:p-6 rounded-3xl border-2 border-gray-700 shadow-2xl z-10 relative overflow-hidden">
            {activeTimeout ? (
              <div className="flex flex-col items-center mb-4 w-full bg-yellow-600 rounded-lg p-4 animate-pulse">
                <span className="text-2xl md:text-5xl font-bold uppercase text-black">TIMEOUT - {activeTimeout === 'home' ? home.name : away.name}</span>
                <div className="text-7xl md:text-9xl font-mono font-bold text-black tracking-tighter">{formatTime(timeoutMs)}</div>
              </div>
            ) : null}

            <div className="text-4xl md:text-5xl font-bold text-gray-400 mb-1 uppercase tracking-widest">{quarter}</div>
            
            {/* GAME CLOCK */}
            <div className={`font-mono font-bold leading-none tracking-tighter ${clockColor} ${!isClockRunning && clockMs > 0 ? 'opacity-90' : ''}`}
                 style={{ fontSize: 'clamp(5rem, 12vw, 15rem)', fontVariantNumeric: 'tabular-nums', textShadow: '0 5px 15px rgba(0,0,0,0.5), 0 0 20px currentColor' }}>
              {formatTime(clockMs)}
            </div>
            {clockMs === 0 && !isClockRunning && <div className="text-red-500 font-bold text-4xl md:text-5xl mt-2 mb-4 animate-pulse shadow-black drop-shadow-2xl">END OF {quarter}</div>}
            
            {/* SHOT CLOCK */}
            <div className="mt-4 md:mt-6 flex flex-col items-center bg-black px-6 py-3 md:px-8 md:py-4 rounded-2xl border-2 border-gray-800 w-full max-w-[16rem] md:max-w-[20rem]">
              <span className="text-gray-500 text-lg md:text-xl font-bold uppercase tracking-widest mb-1">SHOT CLOCK</span>
              <div className={`font-mono font-bold leading-none ${shotClockColor}`} style={{ fontSize: 'clamp(4rem, 9vw, 11rem)', textShadow: '0 0 15px currentColor' }}>
                {shotClockMs === 0 ? '00' : formatShotClock(shotClockMs).padStart(2, '0')}
              </div>
            </div>
          </div>

          {/* AWAY TEAM */}
          <div className="flex-1 flex flex-col items-center justify-around bg-gray-950 p-4 rounded-2xl border-2 shadow-2xl relative" style={{ borderColor: away.color }}>
             <div className={`absolute inset-0 bg-red-500 opacity-0 transition-opacity duration-300 pointer-events-none rounded-xl ${blinkAway ? 'opacity-20' : ''}`}></div>
            <div className="flex items-center gap-4">
              {possession === 'away' && <div className="text-4xl text-yellow-400" style={{ textShadow: '0 0 15px currentColor' }}>▶</div>}
              <h2 className="text-4xl md:text-6xl font-black uppercase truncate max-w-[280px]" style={{ color: away.color }}>{away.name}</h2>
            </div>
            <div className="font-mono leading-none font-bold text-white tracking-tighter" style={{ fontSize: 'clamp(6rem, 13vw, 15rem)', textShadow: '0 0 30px rgba(255,255,255,0.3)' }}>{away.score}</div>
            <div className="flex w-full justify-around mt-2">
              <div className="flex flex-col items-center">
                <span className="text-gray-400 uppercase font-bold text-xl">FOULS</span>
                <span className="text-5xl font-mono text-red-500 font-bold">{away.fouls}</span>
                {renderFoulDots(away.fouls, awayBonus)}
              </div>
              <div className="flex flex-col items-center">
                <span className="text-gray-400 uppercase font-bold text-base md:text-xl text-center leading-tight">Time Outs Left</span>
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

  const renderTeamControls = (type) => {
    const data = type === 'home' ? home : away;
    return (
      <div className="bg-gray-800 p-4 rounded-xl space-y-4 border-t-4 shadow" style={{ borderColor: data.color }}>
        <h3 className="text-xl font-bold text-center text-white">{data.name}</h3>
        <div className="space-y-2">
          <div className="text-gray-400 text-xs font-semibold uppercase">Score</div>
          <div className="grid grid-cols-3 gap-2">
            <ControlButton label="+1" color="bg-green-600 hover:bg-green-500" onClick={() => updateScore(type, 1)} />
            <ControlButton label="+2" color="bg-green-600 hover:bg-green-500" onClick={() => updateScore(type, 2)} />
            <ControlButton label="+3" color="bg-green-600 hover:bg-green-500" onClick={() => updateScore(type, 3)} />
            <ControlButton label="-1" color="bg-red-800 hover:bg-red-700" onClick={() => updateScore(type, -1)} />
            <div className="col-span-2">
              <ControlButton label="ตั้งคะแนน" icon={Settings} onClick={() => {
                showPrompt('ตั้งคะแนน', `ตั้งคะแนนใหม่สำหรับ ${data.name}:`, data.score, (val) => {
                  const parsed = parseInt(val);
                  if (!isNaN(parsed) && parsed >= 0) {
                    saveHistorySnapshot();
                    type === 'home' ? setHome({...home, score: parsed}) : setAway({...away, score: parsed});
                    addLog(`ตั้งคะแนน ${data.name} เป็น ${parsed}`);
                  }
                });
              }} />
            </div>
          </div>
        </div>
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
            <ControlButton label="ขอเวลานอก" color="bg-orange-600 hover:bg-orange-500" onClick={() => startTimeout(type)} disabled={activeTimeout !== null || data.timeouts <= 0} />
          </div>
        </div>
      </div>
    );
  };

  const renderSettingsPanel = () => (
    <div className="bg-gray-800 p-6 rounded-xl text-white max-w-4xl mx-auto space-y-6 shadow-xl w-full">
      <h2 className="text-2xl font-bold flex items-center gap-2"><Settings /> ตั้งค่าการแข่งขัน</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-300 border-b border-gray-600 pb-2">ข้อมูลทั่วไป</h3>
          <div>
            <label className="block text-sm mb-1 text-gray-400">ชื่อการแข่งขัน</label>
            <input type="text" value={settings.gameName} onChange={e => setSettings({...settings, gameName: e.target.value})} className="w-full bg-gray-900 p-2 rounded text-white border border-gray-700 focus:outline-none focus:border-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1 text-gray-400">ชื่อทีมเหย้า</label>
              <input type="text" value={home.name} onChange={e => setHome({...home, name: e.target.value})} className="w-full bg-gray-900 p-2 rounded border border-gray-700" />
            </div>
            <div>
              <label className="block text-sm mb-1 text-gray-400">สีทีมเหย้า</label>
              <input type="color" value={home.color} onChange={e => setHome({...home, color: e.target.value})} className="w-full h-10 bg-gray-900 p-1 rounded border border-gray-700 cursor-pointer" />
            </div>
            <div>
              <label className="block text-sm mb-1 text-gray-400">ชื่อทีมเยือน</label>
              <input type="text" value={away.name} onChange={e => setAway({...away, name: e.target.value})} className="w-full bg-gray-900 p-2 rounded border border-gray-700" />
            </div>
            <div>
              <label className="block text-sm mb-1 text-gray-400">สีทีมเยือน</label>
              <input type="color" value={away.color} onChange={e => setAway({...away, color: e.target.value})} className="w-full h-10 bg-gray-900 p-1 rounded border border-gray-700 cursor-pointer" />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-300 border-b border-gray-600 pb-2">กติกาและเวลา</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1 text-gray-400">เวลาต่อควอเตอร์ (นาที)</label>
              <input type="number" value={settings.quarterMinutes} onChange={e => setSettings({...settings, quarterMinutes: parseInt(e.target.value) || 10})} className="w-full bg-gray-900 p-2 rounded border border-gray-700" />
            </div>
            <div>
              <label className="block text-sm mb-1 text-gray-400">เวลานอก (วินาที)</label>
              <input type="number" value={settings.timeoutDuration} onChange={e => setSettings({...settings, timeoutDuration: parseInt(e.target.value) || 60})} className="w-full bg-gray-900 p-2 rounded border border-gray-700" />
            </div>
            <div>
              <label className="block text-sm mb-1 text-gray-400">Shot Clock (วินาที)</label>
              <input type="number" value={settings.shotClockSeconds} onChange={e => setSettings({...settings, shotClockSeconds: parseInt(e.target.value) || 24})} className="w-full bg-gray-900 p-2 rounded border border-gray-700" />
            </div>
            <div>
              <label className="block text-sm mb-1 text-gray-400">จำนวนเวลานอกต่อทีม</label>
              <input type="number" value={settings.timeoutsPerTeam} onChange={e => {
                const val = parseInt(e.target.value) || 3;
                setSettings({...settings, timeoutsPerTeam: val});
                setHome({...home, timeouts: val});
                setAway({...away, timeouts: val});
              }} className="w-full bg-gray-900 p-2 rounded border border-gray-700" />
            </div>
            <div>
              <label className="block text-sm mb-1 text-gray-400">โบนัสฟาวล์ทีม (ครั้ง)</label>
              <input type="number" value={settings.bonusFoulLimit} onChange={e => setSettings({...settings, bonusFoulLimit: parseInt(e.target.value) || 5})} className="w-full bg-gray-900 p-2 rounded border border-gray-700" />
            </div>
            <div>
              <label className="block text-sm mb-1 text-gray-400">ฟาวล์ผู้เล่น (Foul Out)</label>
              <input type="number" value={settings.playerFoulOutLimit} onChange={e => setSettings({...settings, playerFoulOutLimit: parseInt(e.target.value) || 5})} className="w-full bg-gray-900 p-2 rounded border border-gray-700" />
            </div>
          </div>
          <div className="flex items-center gap-4 pt-4 border-t border-gray-700 mt-4">
             <label className="flex items-center gap-2 cursor-pointer font-semibold">
               <input type="checkbox" checked={settings.soundEnabled} onChange={e => setSettings({...settings, soundEnabled: e.target.checked})} className="w-5 h-5 accent-blue-600" /> เปิดเสียง (ระบบ Web Audio)
             </label>
             {settings.soundEnabled && <input type="range" min="0" max="100" value={settings.soundVolume} onChange={e => setSettings({...settings, soundVolume: parseInt(e.target.value)})} className="flex-1 accent-blue-600" />}
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-4 mt-8 pt-4 border-t border-gray-700">
        <button onClick={() => {
            showConfirm('ล้างข้อมูล', 'ล้างข้อมูลการแข่งขันทั้งหมดและเริ่มใหม่?', () => { 
              localStorage.removeItem('scoreboard_state'); 
              window.location.reload(); 
            });
          }} 
          className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white flex items-center gap-2 shadow font-semibold transition-colors"><Trash2 size={18} /> เริ่มการแข่งขันใหม่ (Reset All)
        </button>
      </div>
    </div>
  );

  const renderRosterPanel = () => {
    const r = (team, setTeamObj) => (
      <div className="flex-1 bg-gray-800 p-5 rounded-xl border-t-4 shadow-xl" style={{ borderColor: team.color }}>
        <h3 className="text-xl font-bold mb-4 text-white flex items-center gap-2"><Users size={20}/> {team.name} - ผู้เล่น</h3>
        <button onClick={() => {
            showAddPlayer(team, (data) => {
              if (data && data.number) {
                 setTeamObj({...team, players: [...team.players, { id: generateId(), number: data.number, name: data.name || `Player ${data.number}`, points: 0, fouls: 0, inGame: false }]});
              }
            });
        }} className="mb-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm font-semibold text-white flex items-center gap-2 transition-colors"><Plus size={16}/> เพิ่มผู้เล่น</button>
        <div className="overflow-x-auto rounded-lg border border-gray-700">
          <table className="w-full text-sm text-left text-gray-300">
            <thead className="text-xs uppercase bg-gray-900 text-gray-400">
              <tr><th className="px-3 py-3 rounded-tl-lg">#</th><th className="px-3 py-3">ชื่อ</th><th className="px-3 py-3">PTS</th><th className="px-3 py-3">FLS</th><th className="px-3 py-3 rounded-tr-lg">จัดการ</th></tr>
            </thead>
            <tbody>
              {team.players.map(p => (
                <tr key={p.id} className={`border-t border-gray-700 ${p.fouls >= settings.playerFoulOutLimit ? 'bg-red-900/30' : 'hover:bg-gray-700/50'}`}>
                  <td className="px-3 py-2 font-bold">{p.number}</td>
                  <td className="px-3 py-2">{p.name} {p.fouls >= settings.playerFoulOutLimit && <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded ml-2 shadow font-semibold">FOUL OUT</span>}</td>
                  <td className="px-3 py-2 font-mono text-lg font-bold">{p.points}</td>
                  <td className="px-3 py-2 font-mono text-lg font-bold text-red-400">{p.fouls}</td>
                  <td className="px-3 py-2 flex gap-1">
                     <button onClick={() => updateScore(team === home ? 'home' : 'away', 1, p.id)} className="px-2 py-1 bg-green-700 rounded hover:bg-green-600 text-xs font-bold">+1</button>
                     <button onClick={() => updateScore(team === home ? 'home' : 'away', 2, p.id)} className="px-2 py-1 bg-green-700 rounded hover:bg-green-600 text-xs font-bold">+2</button>
                     <button onClick={() => updateScore(team === home ? 'home' : 'away', 3, p.id)} className="px-2 py-1 bg-green-700 rounded hover:bg-green-600 text-xs font-bold">+3</button>
                     <button onClick={() => updateFouls(team === home ? 'home' : 'away', 1, p.id)} className="px-2 py-1 bg-yellow-700 rounded hover:bg-yellow-600 text-xs font-bold ml-2" disabled={p.fouls >= settings.playerFoulOutLimit}>+F</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {team.players.length === 0 && <p className="text-center text-gray-500 py-8 bg-gray-900/50">ยังไม่มีรายชื่อผู้เล่นในทีมนี้</p>}
        </div>
      </div>
    );
    return <div className="flex flex-col md:flex-row gap-6 max-w-6xl mx-auto w-full">{r(home, setHome)}{r(away, setAway)}</div>;
  };

  const renderSummaryPanel = () => (
    <div className="bg-white text-black p-8 rounded-xl max-w-4xl mx-auto shadow-2xl printable-area w-full">
      <style>{`@media print { body * { visibility: hidden; } .printable-area, .printable-area * { visibility: visible; } .printable-area { position: absolute; left: 0; top: 0; width: 100%; } .no-print { display: none; } }`}</style>
      <div className="text-center border-b-2 border-gray-300 pb-4 mb-6">
        <h1 className="text-3xl font-black uppercase mb-2">{settings.gameName}</h1>
        <p className="text-gray-600 font-medium">สรุปผลการแข่งขัน • {new Date().toLocaleDateString('th-TH')}</p>
      </div>
      <div className="flex justify-between items-center mb-8 bg-gray-50 p-6 rounded-xl border border-gray-200">
        <div className="text-center w-1/3"><h2 className="text-3xl font-black mb-2" style={{ color: home.color }}>{home.name}</h2><p className="text-7xl font-bold leading-none">{home.score}</p><p className="text-sm text-gray-500 mt-3 font-semibold uppercase">ฟาวล์รวม: {home.fouls}</p></div>
        <div className="text-3xl font-black text-gray-300">VS</div>
        <div className="text-center w-1/3"><h2 className="text-3xl font-black mb-2" style={{ color: away.color }}>{away.name}</h2><p className="text-7xl font-bold leading-none">{away.score}</p><p className="text-sm text-gray-500 mt-3 font-semibold uppercase">ฟาวล์รวม: {away.fouls}</p></div>
      </div>
      <div className="text-center text-2xl font-bold mb-8 p-4 bg-gray-100 rounded-lg">ผลการแข่งขัน: {home.score > away.score ? `${home.name} ชนะ` : home.score < away.score ? `${away.name} ชนะ` : 'เสมอ'}</div>
      <div className="flex justify-center gap-4 mt-8 no-print"><button onClick={() => window.print()} className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg shadow-lg hover:bg-blue-700 transition-colors flex items-center gap-2"><Printer size={20} /> พิมพ์ / บันทึก PDF</button></div>
    </div>
  );

  if (isDisplayMode) {
    return <div className="w-screen h-screen bg-black overflow-hidden flex items-center justify-center">{renderScoreboardDisplay()}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 font-sans flex flex-col">
      <CustomModal {...modalConfig} onClose={closeModal} />
      
      <nav className="bg-gray-900 p-3 border-b border-gray-800 flex flex-wrap gap-4 justify-between items-center shadow-lg">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-black text-white flex items-center gap-2 tracking-wide"><Monitor size={22} className="text-blue-500"/> ARENA COMMAND</h1>
          <div className="flex bg-gray-800 rounded-lg p-1 shadow-inner">
            <button onClick={() => setActiveTab('board')} className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${activeTab === 'board' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>สกอร์บอร์ด</button>
            <button onClick={() => setActiveTab('roster')} className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${activeTab === 'roster' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>ผู้เล่น</button>
            <button onClick={() => setActiveTab('settings')} className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${activeTab === 'settings' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>ตั้งค่า</button>
            <button onClick={() => setActiveTab('summary')} className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${activeTab === 'summary' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>สรุปผล</button>
          </div>
        </div>
        <button onClick={openDisplayWindow} className="flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-600 transition-colors rounded-lg text-sm font-bold text-white shadow-lg"><Maximize size={18} /> เปิดหน้าจอแสดงผล</button>
      </nav>

      <main className="flex-1 overflow-auto p-4 md:p-6 flex flex-col">
        {activeTab === 'settings' && renderSettingsPanel()}
        {activeTab === 'roster' && renderRosterPanel()}
        {activeTab === 'summary' && renderSummaryPanel()}
        
        {}
        {activeTab === 'board' && (
          <div className="flex flex-col lg:flex-row gap-6 h-full max-w-[1600px] mx-auto w-full">
            <div className="w-full lg:w-1/3 flex flex-col gap-6">
              <div className="h-64 rounded-2xl overflow-hidden border-2 border-gray-700 relative bg-black shadow-2xl">
                 <div className="absolute top-2 left-3 px-2 py-1 bg-black/70 rounded text-[10px] text-gray-300 font-bold tracking-widest z-20 shadow">PREVIEW</div>
                 <div className="transform scale-[0.4] origin-top-left w-[250%] h-[250%] pointer-events-none">
                    {renderScoreboardDisplay(true)}
                 </div>
              </div>
              <div className="bg-gray-900 rounded-2xl p-5 flex-1 border border-gray-800 flex flex-col shadow-xl">
                <div className="flex justify-between items-center mb-3 border-b border-gray-800 pb-2">
                  <h3 className="font-bold text-gray-300 text-xs tracking-widest uppercase flex items-center gap-2"><FileText size={14}/> ประวัติการทำรายการ</h3>
                  <div className="flex gap-2">
                    <button onClick={handleUndo} disabled={history.length === 0} className={`p-1.5 rounded-lg transition-colors ${history.length > 0 ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'opacity-30 text-gray-500'}`}><Undo size={16}/></button>
                    <button onClick={handleRedo} disabled={redoStack.length === 0} className={`p-1.5 rounded-lg transition-colors ${redoStack.length > 0 ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'opacity-30 text-gray-500'}`}><Redo size={16}/></button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto space-y-1.5 text-xs text-gray-400 font-mono pr-2">
                  {logs.map(log => <div key={log.id} className="border-b border-gray-800/50 pb-1.5 flex"><span className="text-blue-400 mr-3 shrink-0">[{log.time}]</span> <span>{log.msg}</span></div>)}
                  {logs.length === 0 && <div className="text-center py-4 opacity-50 italic">ยังไม่มีประวัติการทำรายการ</div>}
                </div>
              </div>
            </div>

            <div className="w-full lg:w-2/3 flex flex-col gap-6">
              <div className="bg-gray-900 p-5 rounded-2xl border border-gray-800 flex flex-wrap gap-6 items-center justify-between shadow-xl">
                <div className="flex items-center gap-3">
                  <button onClick={toggleClock} className={`flex items-center gap-2 px-6 py-4 rounded-xl font-bold text-white shadow-lg transition-all ${isClockRunning ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-500 shadow-[0_0_15px_rgba(22,163,74,0.4)]'}`}>
                    {isClockRunning ? <><Square size={20}/> หยุดเวลา (Space)</> : <><Play size={20}/> เริ่มเวลา (Space)</>}
                  </button>
                  <div className="flex flex-col gap-1 ml-2"><button onClick={() => setClockMs(m => m + 60000)} className="px-2.5 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs font-semibold">+1 นาที</button><button onClick={() => setClockMs(m => m + 1000)} className="px-2.5 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs font-semibold">+1 วิ</button></div>
                  <div className="flex flex-col gap-1"><button onClick={() => setClockMs(m => Math.max(0, m - 60000))} className="px-2.5 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs font-semibold">-1 นาที</button><button onClick={() => setClockMs(m => Math.max(0, m - 1000))} className="px-2.5 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs font-semibold">-1 วิ</button></div>
                  <button onClick={resetClock} className="p-3 bg-gray-700 hover:bg-gray-600 rounded-xl ml-2 text-gray-300 transition-colors" title="รีเซ็ตเวลา"><RotateCcw size={20}/></button>
                </div>
                <div className="flex items-center gap-3 bg-gray-950 p-3 rounded-xl border border-gray-800 shadow-inner">
                  <span className="text-[10px] font-black text-gray-500 w-12 tracking-widest leading-tight">SHOT<br/>CLOCK</span>
                  <button onClick={toggleShotClock} className={`p-3 rounded-lg shadow transition-colors ${isShotClockRunning ? 'bg-red-800 hover:bg-red-700 text-white' : 'bg-green-800 hover:bg-green-700 text-white'}`}>{isShotClockRunning ? <Square size={18}/> : <Play size={18}/>}</button>
                  <button onClick={() => resetShotClock(settings.shotClockSeconds)} className="px-4 py-2.5 bg-blue-900 hover:bg-blue-800 text-blue-100 font-mono font-bold rounded-lg text-sm transition-colors">{settings.shotClockSeconds}</button>
                  <button onClick={() => resetShotClock(settings.shortShotClockSeconds)} className="px-4 py-2.5 bg-blue-900 hover:bg-blue-800 text-blue-100 font-mono font-bold rounded-lg text-sm transition-colors">{settings.shortShotClockSeconds}</button>
                  <div className="flex flex-col gap-1 ml-1">
                    <button onClick={() => setShotClockMs(m => m + 1000)} className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-[10px] font-semibold text-gray-400">+1</button>
                    <button onClick={() => setShotClockMs(m => Math.max(0, m - 1000))} className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-[10px] font-semibold text-gray-400">-1</button>
                  </div>
                </div>
              </div>

              <div className="flex gap-6">
                 <div className="bg-gray-900 p-4 rounded-2xl border border-gray-800 flex flex-wrap gap-4 flex-1 items-center justify-between shadow-xl">
                    <div className="flex items-center gap-3 bg-gray-950 p-2 rounded-xl border border-gray-800">
                      <span className="text-xs font-bold text-gray-500 uppercase px-2">ควอเตอร์</span>
                      <span className="text-3xl font-black text-white w-14 text-center">{quarter}</span>
                      <button onClick={nextQuarter} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors">ถัดไป <ArrowRight size={14}/></button>
                    </div>
                    <div className="flex items-center gap-3 bg-gray-950 p-2 rounded-xl border border-gray-800">
                      <span className="text-xs font-bold text-gray-500 uppercase px-2">ครองบอล</span>
                      <button onClick={() => setPossession('home')} className={`px-5 py-2 rounded-lg font-black transition-all ${possession === 'home' ? 'bg-yellow-500 text-black shadow-[0_0_10px_rgba(234,179,8,0.5)]' : 'bg-gray-800 text-gray-400'}`}>เหย้า ◀</button>
                      <button onClick={() => setPossession('away')} className={`px-5 py-2 rounded-lg font-black transition-all ${possession === 'away' ? 'bg-yellow-500 text-black shadow-[0_0_10px_rgba(234,179,8,0.5)]' : 'bg-gray-800 text-gray-400'}`}>▶ เยือน</button>
                    </div>
                    <div className="flex gap-3">
                       <button onClick={() => playHorn('quarter', settings.soundVolume/100)} className="px-4 py-3 bg-orange-700 hover:bg-orange-600 rounded-xl flex items-center gap-2 text-sm font-bold shadow-lg transition-colors"><Volume2 size={20}/> แตรยาว (H)</button>
                       {activeTimeout && <button onClick={stopTimeout} className="px-4 py-3 bg-red-700 hover:bg-red-600 rounded-xl text-sm font-bold shadow-lg transition-colors flex items-center gap-2"><Clock size={20}/> จบเวลานอก</button>}
                    </div>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
                {renderTeamControls("home")}
                {renderTeamControls("away")}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
