import { useEffect, useRef, useState } from 'react';
import {
  fetchPredictionsOnce,
  generatePredictions,
  isSafeApple,
  ROW_MULTIPLIERS,
  subscribePredictions,
  type PredictionsMap,
} from './firebase';

const REGISTER_URL =
  'http://refpa48172.com/L?tag=d_6351867m_195736c_&site=6351867&ad=195736';
const PROMO_CODE = 'AXC9';

interface Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  color: string;
  alpha: number;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const keyInputRef = useRef<HTMLInputElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  // Splash loader state
  const [loaderProgress, setLoaderProgress] = useState(0);
  const [showDashboard, setShowDashboard] = useState(false);

  // Toast state
  const [toastMsg, setToastMsg] = useState('تم النسخ بنجاح!');
  const [toastVisible, setToastVisible] = useState(false);

  // Auth form state
  const [accountId, setAccountId] = useState('');
  const [idError, setIdError] = useState(false);
  const [passKey, setPassKey] = useState('');
  const [keyError, setKeyError] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [isActivated, setIsActivated] = useState(false);

  // Modals state
  const [showCheckModal, setShowCheckModal] = useState(false);
  const [modalCheckProgress, setModalCheckProgress] = useState(0);
  const [showWarningModal, setShowWarningModal] = useState(false);

  // Apple game predictor state (synced with Firebase RTDB m11)
  const [appleLevel, setAppleLevel] = useState(0);
  const [predictions, setPredictions] = useState<PredictionsMap | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [stepText, setStepText] = useState('اضغط "ابدأ" لكشف المكان الآمن');
  const [stepKey, setStepKey] = useState(0);

  // 1. Matrix / Particle background canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const createParticle = (): Particle => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 2.2 + 0.5,
      speedX: (Math.random() - 0.5) * 0.45,
      speedY: (Math.random() - 0.5) * 0.45,
      color: Math.random() > 0.5 ? '#ff2a5f' : '#ff6b00',
      alpha: Math.random() * 0.55 + 0.15,
    });

    const particles: Particle[] = Array.from({ length: 50 }, createParticle);

    let rafId = 0;
    const animateCanvas = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.x += p.speedX;
        p.y += p.speedY;
        if (p.x < 0 || p.x > canvas.width || p.y < 0 || p.y > canvas.height) {
          Object.assign(p, createParticle());
        }
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      rafId = requestAnimationFrame(animateCanvas);
    };
    animateCanvas();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  // 2. Splash screen initial loader
  useEffect(() => {
    let progress = 0;
    let switchTimeout: number | null = null;
    const interval = window.setInterval(() => {
      progress += Math.random() * 2.2 + 1.2;
      if (progress >= 100) {
        progress = 100;
        window.clearInterval(interval);
        switchTimeout = window.setTimeout(() => {
          setShowDashboard(true);
        }, 400);
      }
      setLoaderProgress(progress);
    }, 65);

    return () => {
      window.clearInterval(interval);
      if (switchTimeout) window.clearTimeout(switchTimeout);
    };
  }, []);

  // 3. Helper functions
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastVisible(false);
    }, 2500);
  };

  const copyTextToClipboard = (text: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => {
        const temp = document.createElement('textarea');
        temp.value = text;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
      });
    } else {
      const temp = document.createElement('textarea');
      temp.value = text;
      document.body.appendChild(temp);
      temp.select();
      document.execCommand('copy');
      document.body.removeChild(temp);
    }
  };

  const copyPromoCode = () => {
    copyTextToClipboard(PROMO_CODE);
    showToast(`تم نسخ البرومو كود ${PROMO_CODE} بنجاح!`);
  };

  const pasteKeyFromClipboard = async () => {
    if (navigator.clipboard && navigator.clipboard.readText) {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          setPassKey(text);
          showToast('تم لصق كلمة السر بنجاح!');
          return;
        }
      } catch {
        // Fallback below when clipboard read permission is denied in iframe
      }
    }
    keyInputRef.current?.focus();
    showToast('الصق كلمة السر داخل الحقل مباشرة');
  };

  // 4. Verification flow & dialogs
  const startVerificationFlow = () => {
    const trimmedId = accountId.trim();
    const trimmedKey = passKey.trim();

    let hasError = false;
    if (!trimmedId || trimmedId.length < 3) {
      setIdError(true);
      hasError = true;
    } else {
      setIdError(false);
    }

    if (trimmedKey.toUpperCase() !== PROMO_CODE) {
      setKeyError(true);
      hasError = true;
    } else {
      setKeyError(false);
    }

    if (hasError) return;

    setModalCheckProgress(0);
    setShowCheckModal(true);

    let progress = 0;
    const interval = window.setInterval(() => {
      progress += 20;
      setModalCheckProgress(progress);
      if (progress >= 100) {
        window.clearInterval(interval);
        window.setTimeout(() => {
          setShowCheckModal(false);
          setShowWarningModal(true);
        }, 300);
      }
    }, 150);
  };

  const confirmAndOpenGame = () => {
    setShowWarningModal(false);
    setIsActivated(true);
  };

  // 5. Subscribe to Firebase RTDB m11 in real time
  useEffect(() => {
    const unsubscribe = subscribePredictions(
      (data) => {
        setPredictions(data);
      },
      () => {
        showToast('تعذر الاتصال بقاعدة البيانات');
      },
    );
    return () => unsubscribe();
  }, []);

  // 6. AzimutBet Apple Predictor Engine Logic (linked to Firebase RTDB m11)
  const renderAppleStep = (nextLevel: number) => {
    setAppleLevel(nextLevel);
    setStepText(`المرحلة ${nextLevel}: تفاحة سليمة ! 🍎`);
    setStepKey((prev) => prev + 1);
  };

  const startAppleHack = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      let existing = await fetchPredictionsOnce();
      if (!existing || Object.keys(existing).length === 0) {
        existing = await generatePredictions();
      }
      setPredictions(existing);
      renderAppleStep(1);
    } catch {
      showToast('حدث خطأ أثناء الاتصال بالنسخة');
    } finally {
      setIsSyncing(false);
    }
  };

  const nextAppleStep = () => {
    if (appleLevel >= 10) return;
    renderAppleStep(appleLevel + 1);
  };

  const resetAppleHack = () => {
    setAppleLevel(0);
    setStepText('اضغط ابدأ التوقع لكشف المكان الآمن');
  };

  return (
    <>
      <canvas ref={canvasRef} id="bgCanvas" className="fixed inset-0 w-full h-full pointer-events-none z-0" />

      {/* Ambient Glowing Background Elements */}
      <div className="glow-orb-crimson" />
      <div className="glow-orb-purple" />

      {/* Toast Notification Popup */}
      <div
        id="toast"
        className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-slate-900/95 border border-rose-500/50 text-rose-300 font-bold text-xs sm:text-sm shadow-[0_0_35px_rgba(255,42,95,0.6)] transition-all duration-300 flex items-center gap-2 backdrop-blur-md ${
          toastVisible ? '' : 'hidden'
        }`}
      >
        <i className="fa-solid fa-circle-check text-amber-400" />
        <span id="toastMsg">{toastMsg}</span>
      </div>

      {/* MAIN HEADER NAVBAR */}
      <header className="relative z-10 w-full max-w-xl mx-auto flex items-center justify-between p-3.5 sm:p-4 rounded-2xl glass-card mb-4 border-rose-500/40">
        <div className="flex items-center gap-3">
          {/* Dynamic Logo Canvas / Fallback image container */}
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl p-0.5 bg-gradient-to-tr from-rose-600 via-orange-500 to-purple-600 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(255,42,95,0.6)] overflow-hidden">
            <img
              src="/hu.png"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = 'https://placehold.co/100x100/05040a/ff2a5f?text=AzimutBet';
              }}
              alt="AzimutBet Logo"
              className="w-full h-full object-cover rounded-[14px]"
            />
          </div>
          <div className="flex flex-col">
            <span className="cyber-font font-black text-lg sm:text-xl tracking-wider flex items-center gap-1.5 text-white">
              <span>AzimutBet</span>
              <span className="text-[9px] text-rose-400 font-mono bg-rose-500/20 px-2 py-0.5 rounded-full border border-rose-500/40">
                APPLE PRO v9.2
              </span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
              AzimutBet ENGINE ACTIVE
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={copyPromoCode}
            title="نسخ البرومو كود"
            className="px-2.5 py-1.5 rounded-xl bg-slate-950/90 border border-orange-500/50 text-orange-300 text-xs font-bold flex items-center gap-1.5 hover:bg-orange-500/20 transition-all shadow-[0_0_15px_rgba(255,107,0,0.25)] cursor-pointer whitespace-nowrap shrink-0"
          >
            <i className="fa-solid fa-ticket text-orange-400 text-xs" />
            <span className="cyber-font font-black tracking-wider">{PROMO_CODE}</span>
            <i className="fa-solid fa-copy text-[10px] text-orange-400/80" />
          </button>

          <a
            href={REGISTER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-xl bg-orange-500/20 border border-orange-400/50 text-orange-300 text-xs font-bold flex items-center gap-1.5 hover:bg-orange-500/30 transition-all shadow-[0_0_15px_rgba(255,107,0,0.3)] whitespace-nowrap shrink-0"
          >
            <i className="fa-solid fa-user-plus text-xs" />
            <span className="hidden sm:inline">تسجيل جديد</span>
          </a>
        </div>
      </header>

      {/* SCREEN 1: SPLASH LOADER */}
      {!showDashboard && (
        <div id="screen1_Loader" className="relative z-10 w-full max-w-xl mx-auto my-auto text-center py-6">
          <div className="flex items-center justify-between gap-2 mb-8 px-2 text-xs">
            <div className="flex items-center gap-2 bg-slate-950/90 border border-rose-500/40 px-3.5 py-1.5 rounded-full text-rose-400 backdrop-blur-md shadow-lg">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
              </span>
              <span className="font-bold tracking-wider uppercase text-[10px] sm:text-xs">AZIMUTBET CORE: ACTIVE</span>
            </div>

            <div className="flex items-center gap-2 bg-slate-950/90 border border-orange-500/40 px-3.5 py-1.5 rounded-full text-orange-300 backdrop-blur-md shadow-lg">
              <i className="fa-solid fa-apple-whole text-orange-400 text-xs animate-spin" />
              <span className="font-bold tracking-wider text-[10px] sm:text-xs">APPLE PREDICTOR</span>
            </div>
          </div>

          {/* NEW AGGRESSIVE CYBER-PUNK LOADER */}
          <div className="relative w-52 h-52 sm:w-60 sm:h-60 mx-auto mb-8 flex items-center justify-center">
            <div className="loader-portal">
              <div className="loader-ring loader-ring-1" />
              <div className="loader-ring loader-ring-2" />
              <div className="loader-ring loader-ring-3" />
              <div className="loader-core-pulse" />

              <div className="relative z-10 flex flex-col items-center justify-center">
                <span className="text-5xl sm:text-6xl mb-1 filter drop-shadow-[0_0_20px_rgba(255,42,95,0.9)] animate-bounce">
                  🍎
                </span>
                <h1 className="cyber-font text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-[0_0_20px_rgba(255,42,95,0.9)]">
                  AzimutBet
                </h1>
                <span className="text-[9px] text-orange-300 font-mono tracking-widest uppercase">VIP SCRIPT v9.2</span>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <span className="text-xs sm:text-sm font-bold text-slate-200 bg-slate-950/90 border border-rose-500/50 px-5 py-2 rounded-full backdrop-blur-md shadow-lg inline-block">
              <i className="fa-solid fa-microchip text-rose-400 me-2 animate-pulse" />
              جاري الاتصال بسيرفرات منصة AzimutBet...
            </span>
          </div>

          <div className="space-y-3 max-w-md mx-auto px-2">
            <div className="flex justify-between items-center text-xs font-bold">
              <span id="loaderStatusMsg" className="text-rose-300 flex items-center gap-2">
                <i className="fa-solid fa-circle-notch fa-spin text-orange-400" />
                تحضير خوارزمية كشف التفاح...
              </span>
              <span id="loaderPercent" className="cyber-font text-lg text-orange-400 tabular-nums">
                {Math.floor(loaderProgress)}%
              </span>
            </div>

            <div className="w-full h-4 bg-slate-950 border border-rose-500/40 rounded-full p-0.5 shadow-inner overflow-hidden">
              <div
                id="loaderBar"
                className="h-full bg-gradient-to-r from-rose-600 via-orange-500 to-amber-400 rounded-full transition-all duration-200 shadow-[0_0_25px_rgba(255,42,95,0.9)]"
                style={{ width: `${loaderProgress}%` }}
              />
            </div>

            <div className="flex justify-between text-[11px] text-slate-400 font-mono">
              <span id="loaderBytes" className="tabular-nums">
                {loaderProgress > 0
                  ? `${Math.floor((loaderProgress / 100) * 3800)} / 3800 KEYS READY`
                  : '0 KB / 3800 KEYS VAULT'}
              </span>
              <span className="text-rose-400">STATUS: READY</span>
            </div>
          </div>
        </div>
      )}

      {/* SCREEN 2: DASHBOARD */}
      {showDashboard && (
        <div id="screen2_Dashboard" className="relative z-10 w-full max-w-xl mx-auto space-y-5 pb-10 my-auto">
          {/* PROMO CODE & DIRECT REGISTRATION LINK CARD */}
          <div className="glass-card p-4 sm:p-5 border-orange-500/40 shadow-[0_0_35px_rgba(255,107,0,0.18)] space-y-4">
            <div className="text-center border-b border-slate-800 pb-3">
              <h2 className="cyber-font font-black text-xl sm:text-2xl text-white">
                سكربت لعبة التفاحة - <span className="text-orange-400">منصة AzimutBet</span>
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                استخدم البرومو كود الخاص بنا لضمان أفضل دقة لتوقعات السكربت
              </p>
            </div>

            {/* PROMO CODE DISPLAY BOX */}
            <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-orange-500/50 flex items-center justify-between gap-3 shadow-inner">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-orange-500/20 border border-orange-400/60 flex items-center justify-center text-orange-400 text-xl shrink-0 shadow-[0_0_15px_rgba(255,107,0,0.4)]">
                  <i className="fa-solid fa-ticket" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-mono block">البرومو كود المعتمد:</span>
                  <span className="cyber-font text-2xl font-black tracking-wider text-orange-300">{PROMO_CODE}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={copyPromoCode}
                className="btn-orange px-4 py-2.5 rounded-xl text-slate-950 font-black text-xs uppercase flex items-center gap-2 active:scale-95 shrink-0 cursor-pointer"
              >
                <i className="fa-solid fa-copy" />
                <span>نسخ البرومو</span>
              </button>
            </div>

            {/* DIRECT REGISTRATION BUTTON */}
            <div>
              <a
                href={REGISTER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-crimson w-full py-3.5 px-4 rounded-xl text-white font-black text-xs sm:text-sm uppercase flex items-center justify-center gap-2 shadow-xl active:scale-95"
              >
                <i className="fa-solid fa-arrow-up-right-from-square text-base" />
                <span>رابط التسجيل المباشر في منصة AzimutBet</span>
              </a>
            </div>
          </div>

          {/* AUTHENTICATION & PASSWORD SECTION */}
          {!isActivated && (
            <div
              id="authSection"
              className="glass-card p-4 sm:p-5 border-rose-500/40 space-y-4 shadow-[0_0_30px_rgba(255,42,95,0.2)]"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-400/50 flex items-center justify-center text-rose-400 text-base">
                    <i className="fa-solid fa-key" />
                  </div>
                  <div>
                    <h3 className="cyber-font font-bold text-sm sm:text-base text-white">تفعيل سكربت AzimutBet</h3>
                    <span className="text-[10px] text-slate-400">أدخل ID الحساب وكلمة السر لبدء تشغيل السكربت</span>
                  </div>
                </div>
              </div>

              {/* Account ID Input Field (Numbers Only) */}
              <div className="space-y-1.5">
                <label htmlFor="idInput" className="block text-xs font-bold text-slate-300">
                  <i className="fa-solid fa-id-card me-1 text-rose-400" /> ID الحساب (أرقام فقط):
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="idInput"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={accountId}
                    onChange={(e) => {
                      setAccountId(e.target.value.replace(/[^0-9]/g, ''));
                      if (idError) setIdError(false);
                    }}
                    placeholder="أدخل ID الحساب الخاص بك..."
                    className="w-full glass-input rounded-xl px-4 py-3 text-white text-sm font-mono tracking-wider placeholder:text-slate-500"
                  />
                </div>
                {idError && (
                  <p id="idErrorText" className="text-rose-400 text-xs font-bold mt-1 flex items-center gap-1">
                    <i className="fa-solid fa-circle-xmark" />
                    <span>يرجى إدخال ID الحساب (أرقام فقط)!</span>
                  </p>
                )}
              </div>

              {/* Encrypted Password Field */}
              <div className="space-y-1.5">
                <label htmlFor="keyInput" className="block text-xs font-bold text-slate-300">
                  <i className="fa-solid fa-lock me-1 text-orange-400" /> كلمة السر الخاصة بالسكربت:
                </label>
                <div className="relative">
                  <input
                    ref={keyInputRef}
                    type={showPass ? 'text' : 'password'}
                    id="keyInput"
                    value={passKey}
                    onChange={(e) => {
                      setPassKey(e.target.value);
                      if (keyError) setKeyError(false);
                    }}
                    placeholder="أدخل كلمة السر هنا..."
                    className="w-full glass-input rounded-xl px-4 py-3 text-white text-sm font-mono tracking-wider placeholder:text-slate-500 pl-24"
                  />
                  <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowPass((prev) => !prev)}
                      className="p-1.5 text-slate-400 hover:text-white text-xs cursor-pointer"
                      aria-label="إظهار أو إخفاء كلمة السر"
                    >
                      <i id="eyeIcon" className={`fa-solid ${showPass ? 'fa-eye-slash' : 'fa-eye'}`} />
                    </button>
                    <button
                      type="button"
                      onClick={pasteKeyFromClipboard}
                      className="text-xs text-orange-400 font-bold bg-orange-500/10 px-2 py-1 rounded-lg border border-orange-500/30 hover:bg-orange-500/20 cursor-pointer"
                    >
                      لصق
                    </button>
                  </div>
                </div>
                {keyError && (
                  <p id="keyErrorText" className="text-rose-400 text-xs font-bold mt-1 flex items-center gap-1">
                    <i className="fa-solid fa-circle-xmark" />
                    <span>كلمة السر غير صحيحة! يرجى إدخال كلمة السر المعتمدة.</span>
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={startVerificationFlow}
                className="btn-crimson w-full py-3.5 px-4 rounded-xl text-white font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-2xl active:scale-98 cursor-pointer"
              >
                <i className="fa-solid fa-bolt text-orange-300 animate-pulse text-base" />
                <span>تأكيد البيانات وتفعيل السكربت</span>
              </button>
            </div>
          )}

          {/* APPLE GAME ENGINE INTERFACE */}
          {isActivated && (
            <div id="activeGameContainer" className="space-y-4">
              <div
                id="engineApple"
                className="glass-card p-4 sm:p-5 space-y-4 border-rose-500/50 shadow-[0_0_30px_rgba(255,42,95,0.25)]"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-400/60 flex items-center justify-center text-2xl">
                      🍎
                    </div>
                    <div>
                      <h3 className="cyber-font font-bold text-sm sm:text-base text-white">
                        سكربت التفاحة - AzimutBet VIP
                      </h3>
                      <span id="appleStepText" className="text-xs text-rose-400 font-mono block">
                        {stepText}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between px-1">
                  <span
                    id="appleLevelBadge"
                    className="text-xs text-rose-300 font-mono font-bold bg-slate-950 px-3.5 py-1.5 rounded-full border border-rose-500/40 tabular-nums"
                  >
                    المرحلة {appleLevel}/10
                  </span>
                  <span className="text-[11px] text-orange-400 font-bold bg-orange-500/10 px-2.5 py-1 rounded-lg border border-orange-500/30 tabular-nums">
                    <i className="fa-solid fa-shield-check me-1" />
                    {appleLevel > 0 ? `${ROW_MULTIPLIERS[appleLevel - 1]} · متصل بالنسخة` : 'متصل بالنسخة'}
                  </span>
                </div>

                {/* 5 SLOTS GRID */}
                <div id="appleSlotsGrid" className="grid grid-cols-5 gap-2 py-3">
                  {Array.from({ length: 5 }, (_, idx) => {
                    if (appleLevel === 0) {
                      return (
                        <div
                          key={`empty-${idx}`}
                          className="aspect-square rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-600 text-xl"
                        >
                          <i className="fa-solid fa-question" />
                        </div>
                      );
                    }
                    const currentRowIdx = appleLevel - 1;
                    const safe = isSafeApple(predictions, currentRowIdx, idx);
                    if (safe) {
                      return (
                        <div
                          key={`safe-${stepKey}-${idx}`}
                          className="aspect-square rounded-xl bg-rose-950/80 border-2 border-rose-400 p-1 flex items-center justify-center slot-pop shadow-[0_0_25px_rgba(255,42,95,0.85)]"
                        >
                          <span className="text-2xl sm:text-3xl animate-bounce">🍎</span>
                        </div>
                      );
                    }
                    return (
                      <div
                        key={`bad-${stepKey}-${idx}`}
                        className="aspect-square rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-center text-slate-700"
                      >
                        <i className="fa-solid fa-xmark" />
                      </div>
                    );
                  })}
                </div>

                {/* CONTROLS BUTTONS */}
                <div className="flex gap-2 pt-1">
                  {appleLevel === 0 ? (
                    <button
                      type="button"
                      id="appleStartBtn"
                      onClick={startAppleHack}
                      disabled={isSyncing}
                      className="btn-crimson w-full py-3.5 rounded-xl text-white font-black text-sm active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                    >
                      <i className={`fa-solid ${isSyncing ? 'fa-circle-notch fa-spin' : 'fa-play'} text-xs`} />
                      <span>{isSyncing ? 'جاري الربط...' : 'ابدأ'}</span>
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        id="appleNextBtn"
                        onClick={nextAppleStep}
                        className="btn-orange flex-1 py-3.5 rounded-xl text-slate-950 font-black text-sm active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <span>التالي</span>
                        <i className="fa-solid fa-arrow-left" />
                      </button>
                      <button
                        type="button"
                        id="appleResetBtn"
                        onClick={resetAppleHack}
                        className="btn-purple px-5 py-3.5 rounded-xl text-white text-sm font-bold active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <i className="fa-solid fa-rotate-right" />
                        <span>إعادة</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* DIALOG 1: BEAUTIFUL CHECKING DIALOG */}
      {showCheckModal && (
        <div
          id="checkModal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
        >
          <div className="glass-card p-6 sm:p-8 max-w-sm w-full text-center border-rose-500/50 shadow-[0_0_60px_rgba(255,42,95,0.35)] space-y-4">
            <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
              <div className="loader-ring loader-ring-1" />
              <i className="fa-solid fa-shield-halved text-2xl text-orange-400 animate-pulse" />
            </div>

            <h3 className="cyber-font font-bold text-lg text-white">جاري التحقق من كلمة السر...</h3>
            <p className="text-xs text-slate-300">يتم الآن الاتصال بالسيرفر</p>

            <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-rose-500/30">
              <div
                id="modalCheckBar"
                className="h-full bg-rose-500 transition-all duration-300"
                style={{ width: `${modalCheckProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* DIALOG 2: WARNING ALERT MODAL */}
      {showWarningModal && (
        <div
          id="warningModal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl"
        >
          <div className="glass-card p-6 sm:p-7 max-w-md w-full border-rose-500/70 shadow-[0_0_70px_rgba(255,42,95,0.4)] space-y-5 text-right relative">
            {/* Warning Header Icon */}
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-400/60 flex items-center justify-center text-rose-400 text-2xl shrink-0">
                ⚠️
              </div>
              <div>
                <h3 className="cyber-font font-black text-lg sm:text-xl text-rose-400">تنبيه هام</h3>
                <span className="text-[10px] text-slate-400 font-mono">تعليمات تشغيل سكربت لعبة التفاحة</span>
              </div>
            </div>

            {/* Alert Body Text */}
            <div className="space-y-3 text-xs sm:text-sm text-slate-200 leading-relaxed bg-slate-950/90 p-4 rounded-2xl border border-slate-800">
              <p className="font-bold text-white leading-relaxed">
                الاسكربت يعمل فقط على منصه{' '}
                <a
                  href={REGISTER_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-400 underline hover:text-orange-300 font-black"
                >
                  AzimutBet
                </a>{' '}
                و الحسابات المسجّلة بالبرومو كود الخاص بنا لضمان التشغيل الصحيح 💯
              </p>

              <div className="pt-2 border-t border-slate-800/80 space-y-2">
                <p className="font-bold text-rose-400 flex items-center gap-1.5">
                  <i className="fa-solid fa-circle-check" />
                  <span>✅ سجّل الآن على منصة AzimutBet واستخدم البرومو كود الخاص بنا:</span>
                </p>

                <div className="p-2.5 rounded-xl bg-slate-900 border border-orange-500/40 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-300">🎟️ Promo Code:</span>
                  <span className="cyber-font text-base font-black text-orange-300">{PROMO_CODE}</span>
                  <button
                    type="button"
                    onClick={copyPromoCode}
                    className="text-[10px] bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 px-2 py-1 rounded-lg border border-orange-500/40 font-bold cursor-pointer"
                  >
                    نسخ
                  </button>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <a
                href={REGISTER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-orange flex-1 py-3 px-4 rounded-xl text-slate-950 font-black text-xs text-center uppercase flex items-center justify-center gap-2 active:scale-95"
              >
                <i className="fa-solid fa-link" />
                <span>التسجيل في AzimutBet</span>
              </a>

              <button
                type="button"
                onClick={confirmAndOpenGame}
                className="btn-crimson flex-1 py-3 px-4 rounded-xl text-white font-bold text-xs text-center uppercase flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
              >
                <i className="fa-solid fa-check-double" />
                <span>فهمت ذلك</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
