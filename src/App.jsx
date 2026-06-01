import { useEffect, useMemo, useState } from 'react';
import AuthPage from './pages/AuthPage';
import HomePage from './pages/HomePage';

const STORE_PREFIX = 'drgrow:data:';
const LAST_MOBILE_KEY = 'drgrow:lastMobile';

const emptyPond = (i) => ({
  name: `Pond ${i + 1}`,
  acres: '',
  on: true,
  rawDate: '',
  seeds: '',
  harvest: '',
});

const categories = [
  { key: 'feed', label: 'Feed', bg: 'bg-[#FFF8E8]', icon: <FeedIcon /> },
  { key: 'health', label: 'Healthcare', bg: 'bg-[#F2ECF8]', icon: <MedicineIcon /> },
  { key: 'diesel', label: 'Diesel', bg: 'bg-[#FFF0E8]', icon: '⛽' },
  { key: 'elec', label: 'Electricity', bg: 'bg-[#E8F7F5]', icon: '⚡' },
  { key: 'labour', label: 'Labour', bg: 'bg-[#EAF2FB]', icon: '👷' },
  { key: 'maint', label: 'Maintenance', bg: 'bg-[#E8F5E9]', icon: '🔧' },
  { key: 'others', label: 'Others', bg: 'bg-[#F5F5F5]', icon: '📦' },
];

const categoryMap = Object.fromEntries(categories.map((cat) => [cat.key, cat]));

function fmt(n) {
  const v = Number(n) || 0;
  if (!v) return '₹0';
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(1)}K`;
  return `₹${v.toLocaleString('en-IN')}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(iso, full = true) {
  if (!iso) return 'Not set';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-IN', full ? { day: '2-digit', month: 'short', year: 'numeric' } : { day: '2-digit', month: 'short' });
}

function calcDOC(rawDate) {
  if (!rawDate) return 0;
  const diff = Math.floor((Date.now() - new Date(rawDate).getTime()) / 86400000);
  return diff >= 0 ? diff : 0;
}

function mobileKey(mobile) {
  const digits = (mobile || '').replace(/\D/g, '').slice(-10);
  return digits.length === 10 ? `${STORE_PREFIX}${digits}` : '';
}

function formattedMobile(mobile) {
  const digits = (mobile || '').replace(/\D/g, '').slice(-10);
  return digits.length === 10 ? `+91 ${digits.slice(0, 5)} ${digits.slice(5)}` : 'Not added';
}

function formatCoordinates(latitude, longitude) {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

async function detectLocationName() {
  if (!navigator.geolocation) {
    throw new Error('Location is not supported on this device');
  }

  const position = await new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      maximumAge: 60000,
      timeout: 12000,
    });
  });

  const { latitude, longitude } = position.coords;
  const fallback = formatCoordinates(latitude, longitude);

  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`);
    if (!response.ok) return fallback;
    const data = await response.json();
    const address = data.address || {};
    return [address.village || address.town || address.city || address.suburb, address.state || address.county]
      .filter(Boolean)
      .join(', ') || data.display_name || fallback;
  } catch {
    return fallback;
  }
}

function initialState() {
  const lastMobile = localStorage.getItem(LAST_MOBILE_KEY) || '';
  return {
    app: { name: '', loc: '', mobile: lastMobile },
    ponds: [emptyPond(0), emptyPond(1), emptyPond(2)],
    entries: [],
    cultureData: {},
  };
}

export default function App() {
  const [screen, setScreen] = useState('auth');
  const [app, setApp] = useState(initialState().app);
  const [ponds, setPonds] = useState(initialState().ponds);
  const [entries, setEntries] = useState(initialState().entries);
  const [cultureData, setCultureData] = useState(initialState().cultureData);
  const [toast, setToast] = useState('');
  const [fabOpen, setFabOpen] = useState(false);

  useEffect(() => {
    const key = mobileKey(app.mobile);
    if (!key) return;
    localStorage.setItem(key, JSON.stringify({ app, ponds, entries, cultureData }));
    localStorage.setItem(LAST_MOBILE_KEY, app.mobile.replace(/\D/g, '').slice(-10));
  }, [app, ponds, entries, cultureData]);

  const totals = useMemo(() => {
    return entries.reduce(
      (acc, entry) => {
        acc[entry.cat] = (acc[entry.cat] || 0) + Number(entry.val || 0);
        if (entry.cat === 'feed') acc.feedT += Number(entry.qty || 0);
        if (entry.cat === 'diesel') acc.dieselL += Number(entry.qty || 0);
        if (entry.cat === 'elec') acc.elecK += Number(entry.qty || 0);
        return acc;
      },
      { feed: 0, feedT: 0, health: 0, diesel: 0, dieselL: 0, elec: 0, elecK: 0, labour: 0, maint: 0, others: 0 },
    );
  }, [entries]);

  const totalExpense = Object.keys(totals)
    .filter((key) => !['feedT', 'dieselL', 'elecK'].includes(key))
    .reduce((sum, key) => sum + totals[key], 0);

  function notify(message) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2200);
  }

  function navigate(next) {
    setFabOpen(false);
    setScreen(next);
  }

  function authenticate(mobile, pin, options = {}) {
    const isNewUser = Boolean(options.isNewUser);
    const profile = options.profile;
    const digits = mobile.replace(/\D/g, '').slice(-10);
    if (digits.length !== 10 || pin.length !== 4) {
      notify('Enter valid mobile number and PIN');
      return false;
    }

    const key = mobileKey(digits);
    const saved = key ? localStorage.getItem(key) : null;
    setApp((prev) => ({ ...prev, mobile: digits }));
    if (isNewUser && profile) {
      const pondCount = Math.min(20, Math.max(1, Number(profile.pondCount) || 3));
      setApp({ name: profile.name, loc: profile.loc, mobile: digits });
      setPonds(Array.from({ length: pondCount }, (_, i) => normalizePond(emptyPond(i))));
      setEntries([]);
      setCultureData({});
      navigate('home');
      notify(`Welcome ${profile.name}`);
      return true;
    }

    if (saved && !isNewUser) {
      try {
        const data = JSON.parse(saved);
        setApp({ ...(data.app || {}), mobile: digits });
        setPonds((data.ponds?.length ? data.ponds : [emptyPond(0), emptyPond(1), emptyPond(2)]).map(normalizePond));
        setEntries(data.entries || []);
        setCultureData(data.cultureData || {});
        if (data.app?.name && data.app?.loc) {
          navigate('home');
          notify('Saved farm data restored');
          return true;
        }
      } catch {
        notify('Unable to restore saved data');
      }
    }

    if (!saved && !isNewUser) {
      notify('New user? Please sign up first');
      return false;
    }

    notify('Please sign up to create your farm profile');
    return false;
  }

  function logout() {
    navigate('auth');
    notify('Logged out. Your data is saved locally.');
  }

  function addEntry(entry) {
    setEntries((prev) => [{ ...entry, id: crypto.randomUUID(), dateISO: entry.dateISO || todayISO() }, ...prev]);
    navigate('home');
    notify('Entry saved');
  }

  function updatePond(index, patch) {
    setPonds((prev) => prev.map((pond, i) => (i === index ? normalizePond({ ...pond, ...patch }) : pond)));
  }

  function addPond() {
    setPonds((prev) => [...prev, emptyPond(prev.length)]);
    notify('New pond added');
  }

  function saveFeedLog(pondIndex, log) {
    setCultureData((prev) => {
      const pond = prev[pondIndex] || { feedLogs: [], growthLogs: [] };
      return {
        ...prev,
        [pondIndex]: { ...pond, feedLogs: [{ ...log, id: crypto.randomUUID(), dateISO: log.dateISO || todayISO() }, ...(pond.feedLogs || [])] },
      };
    });
    notify('Feed log saved');
  }

  function saveGrowthLog(pondIndex, log) {
    setCultureData((prev) => {
      const pond = prev[pondIndex] || { feedLogs: [], growthLogs: [] };
      return {
        ...prev,
        [pondIndex]: { ...pond, growthLogs: [{ ...log, id: crypto.randomUUID(), dateISO: log.dateISO || todayISO() }, ...(pond.growthLogs || [])] },
      };
    });
    notify('Growth log saved');
  }

  const shared = {
    app,
    ponds,
    entries,
    totals,
    totalExpense,
    cultureData,
    navigate,
    notify,
    updatePond,
    addPond,
    setApp,
    setPonds,
    addEntry,
    logout,
    saveFeedLog,
    saveGrowthLog,
  };

  return (
    <div className="relative mx-auto h-screen h-dvh w-full max-w-[430px] overflow-hidden bg-drgrow-bg text-drgrow-ink shadow-2xl shadow-slate-900/10">
      {screen === 'auth' && <AuthPage mobile={app.mobile} setMobile={(mobile) => setApp((prev) => ({ ...prev, mobile }))} onDetectLocation={detectLocationName} onAuth={authenticate} />}
      {screen === 'home' && <HomePage {...shared} fabOpen={fabOpen} setFabOpen={setFabOpen} />}
      {screen === 'add' && <AddEntryScreen {...shared} />}
      {screen === 'cost' && <CostTrackerScreen {...shared} />}
      {screen === 'culture' && <CultureDataScreen {...shared} />}
      {screen === 'farm' && <FarmManagementScreen {...shared} />}
      {screen === 'profile' && <ProfileScreen {...shared} />}
      <Toast message={toast} />
    </div>
  );
}

function normalizePond(pond) {
  return {
    ...pond,
    doc: calcDOC(pond.rawDate),
    date: pond.rawDate ? fmtDate(pond.rawDate) : '',
  };
}

function AddEntryScreen({ addEntry, navigate }) {
  const [form, setForm] = useState({
    feedTons: '',
    feedValue: '',
    healthValue: '',
    dieselLiters: '',
    dieselValue: '',
    elecUnits: '',
    elecValue: '',
    labourValue: '',
    maintValue: '',
    othersValue: '',
    dateISO: todayISO(),
  });

  function submit() {
    const rows = [
      ['feed', form.feedValue, form.feedTons ? `${form.feedTons} T` : '', form.feedTons],
      ['health', form.healthValue, '', ''],
      ['diesel', form.dieselValue, form.dieselLiters ? `${form.dieselLiters} L` : '', form.dieselLiters],
      ['elec', form.elecValue, form.elecUnits ? `${form.elecUnits} units` : '', form.elecUnits],
      ['labour', form.labourValue, '', ''],
      ['maint', form.maintValue, '', ''],
      ['others', form.othersValue, '', ''],
    ].filter(([, value]) => Number(value) > 0);

    rows.forEach(([cat, value, qtyLabel, qty]) => addEntry({ cat, val: Number(value), qty: Number(qty) || 0, qtyLabel, dateISO: form.dateISO }));
  }

  return (
    <Screen>
      <Header title="Add Entry" subtitle="Record daily farm expenses" back={() => navigate('home')} />
      <Body>
        <Field label="Entry Date">
          <input className="input" type="date" value={form.dateISO} onChange={(event) => setForm({ ...form, dateISO: event.target.value })} />
        </Field>
        <EntrySection title="Feed" icon={<FeedIcon />} bg="bg-[#FFF8E8]">
          <TwoInputs first={['Tons', 'feedTons']} second={['Value', 'feedValue']} form={form} setForm={setForm} />
        </EntrySection>
        <EntrySection title="Healthcare" icon={<MedicineIcon />} bg="bg-[#F2ECF8]">
          <MoneyInput id="healthValue" form={form} setForm={setForm} />
        </EntrySection>
        <EntrySection title="Diesel" icon="⛽" bg="bg-[#FFF0E8]">
          <TwoInputs first={['Liters', 'dieselLiters']} second={['Value', 'dieselValue']} form={form} setForm={setForm} />
        </EntrySection>
        <EntrySection title="Electricity" icon="⚡" bg="bg-[#E8F7F5]">
          <TwoInputs first={['Units', 'elecUnits']} second={['Value', 'elecValue']} form={form} setForm={setForm} />
        </EntrySection>
        <EntrySection title="Labour" icon="👷" bg="bg-[#EAF2FB]">
          <MoneyInput id="labourValue" form={form} setForm={setForm} />
        </EntrySection>
        <EntrySection title="Maintenance" icon="🔧" bg="bg-[#E8F5E9]">
          <MoneyInput id="maintValue" form={form} setForm={setForm} />
        </EntrySection>
        <EntrySection title="Others" icon="📦" bg="bg-[#F5F5F5]">
          <MoneyInput id="othersValue" form={form} setForm={setForm} />
        </EntrySection>
        <button className="btn-orange mb-8" onClick={submit}>Save Entry</button>
      </Body>
    </Screen>
  );
}

function CostTrackerScreen({ entries, totals, totalExpense, navigate }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const filtered = entries.filter((entry) => (!from || entry.dateISO >= from) && (!to || entry.dateISO <= to));
  const filteredTotal = filtered.reduce((sum, entry) => sum + Number(entry.val || 0), 0);

  return (
    <Screen>
      <Header title="Cost Tracker" subtitle="All expenses in one place" back={() => navigate('home')} />
      <Body withNav>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Filtered Total" value={fmt(filteredTotal)} />
          <StatCard label="All Time Total" value={fmt(totalExpense)} />
        </div>
        <Card title="Filter">
          <div className="grid grid-cols-2 gap-3">
            <input className="input-box" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            <input className="input-box" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </div>
        </Card>
        <Card title="Category Totals">
          <div className="space-y-2">
            {categories.map((cat) => (
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3" key={cat.key}>
                <div className="flex items-center gap-3">
                  <div className={`grid h-10 w-10 place-items-center rounded-xl ${cat.bg}`}>{cat.icon}</div>
                  <span className="text-sm font-bold">{cat.label}</span>
                </div>
                <span className="text-sm font-extrabold text-drgrow-orange">{fmt(totals[cat.key])}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Entries">
          <EntryList entries={filtered} />
        </Card>
      </Body>
      <BottomNav active="cost" navigate={navigate} />
    </Screen>
  );
}

function CultureDataScreen({ ponds, cultureData, saveFeedLog, saveGrowthLog, navigate }) {
  const [active, setActive] = useState(0);
  const [feedKg, setFeedKg] = useState('');
  const [abw, setAbw] = useState('');
  const data = cultureData[active] || { feedLogs: [], growthLogs: [] };
  const totalFeed = (data.feedLogs || []).reduce((sum, log) => sum + Number(log.kg || 0), 0);
  const latestAbw = data.growthLogs?.[0]?.abw || '';

  return (
    <Screen>
      <Header title="Culture Data" subtitle="Feed and growth records" back={() => navigate('home')} />
      <Body withNav>
        <div className="mb-4 flex gap-2 overflow-x-auto">
          {ponds.map((pond, index) => (
            <button key={pond.name} className={active === index ? 'tab-active' : 'tab'} onClick={() => setActive(index)}>
              {pond.name}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Feed Used" value={`${totalFeed || 0} kg`} />
          <StatCard label="Latest ABW" value={`${latestAbw || 0} g`} />
        </div>
        <Card title="Add Feed Log">
          <div className="flex gap-3">
            <input className="input-box flex-1" type="number" placeholder="Feed kg" value={feedKg} onChange={(event) => setFeedKg(event.target.value)} />
            <button
              className="btn-teal !w-auto px-5"
              onClick={() => {
                if (!feedKg) return;
                saveFeedLog(active, { kg: Number(feedKg), dateISO: todayISO() });
                setFeedKg('');
              }}
            >
              Save
            </button>
          </div>
        </Card>
        <Card title="Add Growth Log">
          <div className="flex gap-3">
            <input className="input-box flex-1" type="number" placeholder="ABW grams" value={abw} onChange={(event) => setAbw(event.target.value)} />
            <button
              className="btn-orange !w-auto px-5"
              onClick={() => {
                if (!abw) return;
                saveGrowthLog(active, { abw: Number(abw), dateISO: todayISO() });
                setAbw('');
              }}
            >
              Save
            </button>
          </div>
        </Card>
        <Card title="Recent Logs">
          <LogList logs={[...(data.feedLogs || []).map((log) => ({ ...log, type: 'Feed', value: `${log.kg} kg` })), ...(data.growthLogs || []).map((log) => ({ ...log, type: 'Growth', value: `${log.abw} g` }))]} />
        </Card>
      </Body>
      <BottomNav active="culture" navigate={navigate} />
    </Screen>
  );
}

function FarmManagementScreen({ ponds, updatePond, addPond, totals, cultureData, navigate }) {
  const [editIndex, setEditIndex] = useState(-1);

  return (
    <Screen>
      <Header title="Farm Management" subtitle="Manage pond status and stocking" action={<button className="rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white" onClick={() => navigate('profile')}>Profile</button>} />
      <Body withNav>
        {ponds.map((pond, index) => (
          <PondCard
            key={index}
            pond={pond}
            index={index}
            open={editIndex === index}
            feedUsed={cultureData[index]?.feedLogs?.reduce((sum, log) => sum + Number(log.kg || 0), 0) || 0}
            onToggle={() => updatePond(index, { on: !pond.on })}
            onEdit={() => setEditIndex(editIndex === index ? -1 : index)}
            onSave={(patch) => {
              updatePond(index, patch);
              setEditIndex(-1);
            }}
          />
        ))}
        <button className="mb-24 flex w-full items-center justify-between rounded-2xl border-2 border-dashed border-drgrow-teal bg-white p-4 text-left" onClick={addPond}>
          <span>
            <span className="block font-bold text-drgrow-teal">Add More Pond</span>
            <span className="text-xs text-slate-400">Add another pond to your farm</span>
          </span>
          <span className="text-2xl text-drgrow-teal">+</span>
        </button>
      </Body>
      <BottomNav active="farm" navigate={navigate} />
    </Screen>
  );
}

function ProfileScreen({ app, setApp, ponds, updatePond, logout, navigate }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name: app.name, loc: app.loc });

  return (
    <Screen>
      <Header title={app.name || 'Profile'} subtitle={app.loc || 'Farm location'} back={() => navigate('home')} />
      <Body withNav>
        <Card title="Farmer Info" action={<button className="text-xs font-bold text-drgrow-teal" onClick={() => setEditing(!editing)}>{editing ? 'Cancel' : 'Edit'}</button>}>
          {editing ? (
            <div className="space-y-3">
              <input className="input-box" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
              <input className="input-box" value={draft.loc} onChange={(event) => setDraft({ ...draft, loc: event.target.value })} />
              <button
                className="btn-orange"
                onClick={() => {
                  setApp((prev) => ({ ...prev, ...draft }));
                  setEditing(false);
                }}
              >
                Save Profile
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              <ProfileRow label="Name" value={app.name || 'Not added'} />
              <ProfileRow label="Location" value={app.loc || 'Not added'} />
              <ProfileRow label="Mobile" value={formattedMobile(app.mobile)} />
            </div>
          )}
        </Card>
        <Card title="Ponds">
          <div className="space-y-3">
            {ponds.map((pond, index) => (
              <div key={index} className="rounded-2xl bg-slate-50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-bold">{pond.name}</span>
                  <button className={pond.on ? 'status-on' : 'status-off'} onClick={() => updatePond(index, { on: !pond.on })}>
                    {pond.on ? 'Active' : 'Inactive'}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <Mini label="DOC" value={calcDOC(pond.rawDate) || 0} />
                  <Mini label="Stocked" value={pond.rawDate ? fmtDate(pond.rawDate, false) : 'Not set'} />
                  <Mini label="Seeds" value={pond.seeds || 0} />
                </div>
              </div>
            ))}
          </div>
        </Card>
        <button className="btn-orange mb-24" onClick={logout}>Logout</button>
      </Body>
      <BottomNav active="profile" navigate={navigate} />
    </Screen>
  );
}

function PondCard({ pond, index, open, feedUsed, onToggle, onEdit, onSave }) {
  const [draft, setDraft] = useState(pond);
  useEffect(() => setDraft(pond), [pond, open]);

  return (
    <div className="mb-4 overflow-hidden rounded-2xl border border-slate-100 bg-white">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-drgrow-navy text-2xl">
            <PondIcon />
          </div>
          <div>
            <p className="font-extrabold">{pond.name}</p>
            <p className="text-xs text-slate-400">{pond.acres ? `${pond.acres} Acres • ` : ''}{pond.on ? 'Active' : 'Inactive'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500" onClick={onEdit}>{open ? 'Cancel' : 'Edit'}</button>
          <Toggle checked={pond.on} onClick={onToggle} />
        </div>
      </div>
      {open ? (
        <div className="space-y-3 border-t border-slate-100 p-4">
          <input className="input-box" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <input className="input-box" type="date" value={draft.rawDate} onChange={(event) => setDraft({ ...draft, rawDate: event.target.value })} />
            <input className="input-box" type="number" placeholder="Acres" value={draft.acres} onChange={(event) => setDraft({ ...draft, acres: event.target.value })} />
          </div>
          <input className="input-box" type="number" placeholder="Seeds stocked" value={String(draft.seeds).replace(/,/g, '')} onChange={(event) => setDraft({ ...draft, seeds: event.target.value })} />
          <input className="input-box" type="date" value={draft.harvest} onChange={(event) => setDraft({ ...draft, harvest: event.target.value, on: event.target.value ? false : draft.on })} />
          <button className="btn-orange" onClick={() => onSave({ ...draft, seeds: draft.seeds ? Number(String(draft.seeds).replace(/,/g, '')).toLocaleString('en-IN') : '' })}>Save</button>
        </div>
      ) : (
        <div className="border-t border-slate-100 p-4">
          {pond.rawDate ? (
            <div className="grid grid-cols-3 gap-1 overflow-hidden rounded-xl bg-slate-200">
              <Mini label="DOC" value={calcDOC(pond.rawDate)} />
              <Mini label="Feed" value={feedUsed ? `${(feedUsed / 1000).toFixed(2)}T` : '0T'} />
              <Mini label="Seeds" value={pond.seeds || 0} />
            </div>
          ) : (
            <div className="rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-400">No stocking data yet</div>
          )}
        </div>
      )}
    </div>
  );
}

function Screen({ children }) {
  return <section className="absolute inset-0 flex flex-col overflow-hidden bg-drgrow-bg">{children}</section>;
}

function Header({ title, subtitle, back, action, children }) {
  return (
    <div className="shrink-0 bg-drgrow-navy px-5 py-4 text-white">
      <div className="mb-1 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {back && <button className="grid h-9 w-9 place-items-center rounded-xl bg-white/10" onClick={back}>←</button>}
          <div className="min-w-0">
            <p className="truncate text-lg font-extrabold">{title}</p>
            {subtitle && <p className="truncate text-xs text-white/50">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Body({ children, withNav = false }) {
  return (
    <div className={`flex-1 overflow-y-auto px-4 py-4 ${withNav ? 'pb-24' : ''}`}>
      <div className="mx-auto w-full max-w-[430px]">{children}</div>
    </div>
  );
}

function Card({ title, action, children }) {
  return (
    <section className="mb-4 rounded-2xl border border-slate-100 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-extrabold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label className="mb-4 block rounded-2xl border border-slate-200 bg-white p-4">
      <span className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function StatCard({ label, value, hint }) {
  return (
    <div className="mb-4 rounded-2xl border border-slate-100 bg-white p-4 text-center">
      <p className="text-lg font-extrabold text-drgrow-ink">{value}</p>
      {hint && <p className="text-xs font-bold text-drgrow-teal">{hint}</p>}
      <p className="mt-1 text-[11px] font-semibold text-slate-400">{label}</p>
    </div>
  );
}

function EntrySection({ title, icon, bg, children }) {
  return (
    <section className="mb-3 rounded-2xl border border-slate-100 bg-white p-4">
      <div className="mb-3 flex items-center gap-3">
        <div className={`grid h-10 w-10 place-items-center rounded-xl text-xl ${bg}`}>{icon}</div>
        <p className="font-bold">{title}</p>
      </div>
      {children}
    </section>
  );
}

function MoneyInput({ id, form, setForm }) {
  return <input className="input-box" type="number" placeholder="Value ₹" value={form[id]} onChange={(event) => setForm({ ...form, [id]: event.target.value })} />;
}

function TwoInputs({ first, second, form, setForm }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <input className="input-box" type="number" placeholder={first[0]} value={form[first[1]]} onChange={(event) => setForm({ ...form, [first[1]]: event.target.value })} />
      <input className="input-box" type="number" placeholder={second[0]} value={form[second[1]]} onChange={(event) => setForm({ ...form, [second[1]]: event.target.value })} />
    </div>
  );
}

function EntryList({ entries }) {
  if (!entries.length) return <div className="py-6 text-center text-sm font-semibold text-slate-400">No entries yet</div>;
  return (
    <div className="space-y-2">
      {entries.map((entry) => {
        const cat = categoryMap[entry.cat] || categoryMap.others;
        return (
          <div key={entry.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
            <div className="flex items-center gap-3">
              <div className={`grid h-10 w-10 place-items-center rounded-xl ${cat.bg}`}>{cat.icon}</div>
              <div>
                <p className="text-sm font-bold">{cat.label}{entry.qtyLabel ? ` - ${entry.qtyLabel}` : ''}</p>
                <p className="text-xs text-slate-400">{fmtDate(entry.dateISO, false)}</p>
              </div>
            </div>
            <span className="text-sm font-extrabold text-drgrow-orange">-{fmt(entry.val)}</span>
          </div>
        );
      })}
    </div>
  );
}

function LogList({ logs }) {
  if (!logs.length) return <div className="py-5 text-center text-sm text-slate-400">No logs yet</div>;
  return (
    <div className="space-y-2">
      {logs.slice(0, 8).map((log) => (
        <div key={log.id} className="flex justify-between rounded-xl bg-slate-50 p-3 text-sm">
          <span className="font-bold">{log.type}</span>
          <span>{log.value}</span>
          <span className="text-slate-400">{fmtDate(log.dateISO, false)}</span>
        </div>
      ))}
    </div>
  );
}

function ProfileRow({ label, value }) {
  return (
    <div className="flex justify-between py-3 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

function Mini({ label, value }) {
  return (
    <div className="bg-slate-50 p-3 text-center">
      <p className="text-sm font-extrabold text-drgrow-ink">{value}</p>
      <p className="mt-1 text-[10px] font-semibold text-slate-400">{label}</p>
    </div>
  );
}

function Toggle({ checked, onClick }) {
  return (
    <button className={`relative h-8 w-14 rounded-full p-1 transition ${checked ? 'bg-drgrow-teal' : 'bg-slate-300'}`} onClick={onClick}>
      <span className={`block h-6 w-6 rounded-full bg-white shadow transition ${checked ? 'translate-x-6' : 'translate-x-0'}`} />
    </button>
  );
}

function BottomNav({ active, navigate }) {
  const items = [
    ['home', 'Home', '⌂'],
    ['cost', 'Cost', '▤'],
    ['culture', 'Culture', '↗'],
    ['farm', 'Farm', '≋'],
  ];
  return (
    <nav className="absolute bottom-0 left-0 right-0 z-30 flex border-t border-slate-100 bg-white pb-[calc(10px+env(safe-area-inset-bottom))] pt-2">
      {items.map(([key, label, icon]) => (
        <button key={key} className={`flex flex-1 flex-col items-center gap-1 text-xs ${active === key ? 'font-bold text-drgrow-ink' : 'text-slate-400'}`} onClick={() => navigate(key)}>
          <span className="text-xl">{icon}</span>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

function Toast({ message }) {
  return <div className={`absolute bottom-24 left-1/2 z-[999] -translate-x-1/2 rounded-full bg-drgrow-teal px-5 py-3 text-sm font-bold text-drgrow-navy shadow-xl transition ${message ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'}`}>{message}</div>;
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
