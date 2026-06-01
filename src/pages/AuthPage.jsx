import { useEffect, useState } from 'react';
import aquaconnectLogo from '../../assets/aquaconnect-logo.svg';
import logo from '../../assets/logo.svg';

const STORE_PREFIX = 'drgrow:data:';

export default function AuthPage({ initialMode = 'signin', mobile, setMobile, onDetectLocation, onAuth }) {
  const [mode, setMode] = useState(initialMode);
  const [pin, setPin] = useState('');
  const [name, setName] = useState('');
  const [loc, setLoc] = useState('');
  const [pondCount, setPondCount] = useState(3);
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState('');
  const validMobile = mobile.replace(/\D/g, '').length === 10;
  const validPin = pin.length === 4;
  const isForgot = mode === 'forgot';
  const isSignUp = mode === 'signup';
  const validProfile = name.trim() && loc.trim();

  useEffect(() => {
    setMode(initialMode);
    setError('');
  }, [initialMode]);

  useEffect(() => {
    const digits = mobile.replace(/\D/g, '').slice(-10);
    if (digits.length !== 10 || mode === 'forgot') return;

    const saved = localStorage.getItem(`${STORE_PREFIX}${digits}`);
    if (!saved) {
      setMode('signup');
      setError('No profile found for this number. Please complete your account setup.');
      return;
    }

    try {
      const data = JSON.parse(saved);
      if (!data.app?.name) {
        setMode('signup');
        setError('Please complete your account profile to continue.');
      }
    } catch {
      setMode('signup');
      setError('No profile found for this number. Please complete your account setup.');
    }
  }, [mobile, mode]);

  function submit(event) {
    event.preventDefault();
    if (isForgot) {
      if (validMobile) {
        setError('Use any 4 digit PIN for this demo');
      } else {
        setError('Enter a valid mobile number');
      }
      return;
    }

    setError('');
    const ok = onAuth(mobile, pin, {
      isNewUser: isSignUp,
      profile: isSignUp ? { name: name.trim(), loc: loc.trim(), pondCount } : null,
    });
    if (ok === 'needsProfile') {
      switchMode('signup');
      setError('Please complete your account profile to continue.');
      return;
    }

    if (!ok) {
      setError('Enter a valid mobile number and 4 digit PIN');
      setPin('');
    }
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setError('');
    setPin('');
  }

  async function autoDetectLocation() {
    setDetecting(true);
    setError('');
    try {
      setLoc(await onDetectLocation());
    } catch (error) {
      setError(error.message || 'Unable to detect location');
    } finally {
      setDetecting(false);
    }
  }

  return (
    <Screen>
      <div className="flex min-h-full flex-1 flex-col overflow-y-auto bg-white px-4 py-6 sm:px-6">
        <div className="mx-auto flex w-full max-w-[430px] flex-1 flex-col">
          <div className="flex shrink-0 justify-center">
            <img className="w-[min(168px,42vw)] max-[360px]:w-[min(140px,46vw)]" src={logo} alt="Dr. Grow" />
          </div>

          <div className="mt-8 grid w-full grid-cols-4 gap-3 sm:gap-4">
            <FeatureIcon label="Pond" bg="bg-[#E8F7F5]" icon={<PondIcon />} />
            <FeatureIcon label="Medicine" bg="bg-[#F2ECF8]" icon={<MedicineIcon />} />
            <FeatureIcon label="Feed" bg="bg-[#FFF8E8]" icon={<FeedIcon />} />
            <FeatureIcon label="Expense" bg="bg-[#EAF2FB]" icon="📊" />
          </div>

          <div className="mt-8 w-full text-center">
            <h1 className="text-xl font-extrabold text-drgrow-ink sm:text-2xl">
              {isForgot ? 'Forgot PIN' : isSignUp ? 'Sign up' : 'Sign in'}
            </h1>
            <p className="mt-1 text-sm text-neutral-500 sm:text-base">
              {isForgot ? 'Recover your demo access' : isSignUp ? 'Create your farm profile' : 'Welcome back'}
            </p>
          </div>

          <form className="mt-8 w-full" onSubmit={submit}>
            <div className="mb-4 grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
              <button className={mode === 'signin' ? 'auth-tab-active' : 'auth-tab'} onClick={() => switchMode('signin')} type="button">
                Sign in
              </button>
              <button className={mode === 'signup' ? 'auth-tab-active' : 'auth-tab'} onClick={() => switchMode('signup')} type="button">
                Sign up
              </button>
            </div>

            <div className="mb-4 flex overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2 border-r border-slate-200 bg-slate-200/70 px-3 py-4 text-sm font-semibold sm:px-4">
                <span>🇮🇳</span>
                <span>+91</span>
              </div>
              <input
                className="min-w-0 flex-1 bg-transparent px-4 py-4 text-[15px] font-semibold outline-none placeholder:font-normal placeholder:text-slate-300"
                inputMode="numeric"
                placeholder="Mobile number"
                value={mobile}
                onChange={(event) => {
                  setError('');
                  setMobile(event.target.value.replace(/\D/g, '').slice(0, 10));
                }}
              />
            </div>

            {!isForgot && (
              <input
                className="mb-4 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-center text-xl font-extrabold tracking-[0.45em] text-drgrow-ink outline-none placeholder:text-base placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-300 focus:border-drgrow-teal"
                inputMode="numeric"
                maxLength={4}
                placeholder="PIN"
                type="password"
                value={pin}
                onChange={(event) => {
                  setError('');
                  setPin(event.target.value.replace(/\D/g, '').slice(0, 4));
                }}
              />
            )}

            {isSignUp && (
              <div className="mb-4 space-y-3">
                <input
                  className="input-box !rounded-2xl !py-4"
                  placeholder="Farmer name"
                  value={name}
                  onChange={(event) => {
                    setError('');
                    setName(event.target.value);
                  }}
                />
                <div className="flex gap-3">
                  <input
                    className="input-box !rounded-2xl !py-4"
                    placeholder="Village / District"
                    value={loc}
                    onChange={(event) => {
                      setError('');
                      setLoc(event.target.value);
                    }}
                  />
                  <button className="min-h-12 rounded-2xl bg-drgrow-navy px-4 text-sm font-bold text-white disabled:opacity-60" disabled={detecting} onClick={autoDetectLocation} type="button">
                    {detecting ? '...' : '📍'}
                  </button>
                </div>
                <div className="flex overflow-hidden rounded-2xl bg-slate-100">
                  <button className="h-14 w-14 bg-drgrow-navy text-2xl text-white" onClick={() => setPondCount(Math.max(1, pondCount - 1))} type="button">
                    -
                  </button>
                  <div className="flex flex-1 items-center justify-center text-sm font-extrabold">
                    {pondCount} Pond{pondCount === 1 ? '' : 's'}
                  </div>
                  <button className="h-14 w-14 bg-drgrow-navy text-2xl text-drgrow-teal" onClick={() => setPondCount(Math.min(20, pondCount + 1))} type="button">
                    +
                  </button>
                </div>
              </div>
            )}

            {error && <p className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-center text-sm font-bold text-red-600">{error}</p>}

            <button className={validMobile && (isForgot || (validPin && (!isSignUp || validProfile))) ? 'btn-orange' : 'btn-disabled'} disabled={!validMobile || (!isForgot && (!validPin || (isSignUp && !validProfile)))} type="submit">
              {isForgot ? 'Get PIN' : isSignUp ? 'Create Account' : 'Sign in'}
            </button>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm font-semibold">
              {!isForgot && (
                <button className="text-drgrow-teal" onClick={() => switchMode('forgot')} type="button">
                  Forgot PIN?
                </button>
              )}
              {isForgot && (
                <button className="text-drgrow-teal" onClick={() => switchMode('signin')} type="button">
                  Back to sign in
                </button>
              )}
              {!isSignUp && !isForgot && (
                <>
                  <span className="text-slate-300">|</span>
                  <span className="text-slate-400">New user?</span>
                  <button className="text-drgrow-orange" onClick={() => switchMode('signup')} type="button">
                    Sign up
                  </button>
                </>
              )}
              {isSignUp && (
                <>
                  <span className="text-slate-400">Already have an account?</span>
                  <button className="text-drgrow-teal" onClick={() => switchMode('signin')} type="button">
                    Sign in
                  </button>
                </>
              )}
            </div>
          </form>

          <div className="mt-auto pt-8 text-center">
            <BrandFooter />
          </div>
        </div>
      </div>
    </Screen>
  );
}

function BrandFooter() {
  return (
    <>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">A brand of</p>
      <img className="mx-auto w-[min(170px,48vw)]" src={aquaconnectLogo} alt="Aquaconnect" />
    </>
  );
}

function Screen({ children }) {
  return <section className="absolute inset-0 flex flex-col overflow-hidden bg-drgrow-bg">{children}</section>;
}

function FeatureIcon({ label, icon, bg }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-2">
      <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-xl sm:h-14 sm:w-14 sm:text-2xl ${bg}`}>{icon}</div>
      <span className="text-center text-[11px] font-medium leading-tight text-neutral-500 sm:text-xs">{label}</span>
    </div>
  );
}

function PondIcon() {
  return <span className="pond-ico" />;
}

function FeedIcon() {
  return <span className="feed-ico" />;
}

function MedicineIcon() {
  return <span className="med-ico" />;
}
