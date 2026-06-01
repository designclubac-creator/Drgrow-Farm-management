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

export default function HomePage({ app, ponds, totals, totalExpense, entries, navigate, fabOpen, setFabOpen }) {
  const active = ponds.filter((pond) => pond.on).length;
  const minDoc = ponds.filter((pond) => pond.on && calcDOC(pond.rawDate)).map((pond) => calcDOC(pond.rawDate));

  return (
    <Screen>
      <Header
        title={app.name ? `${app.name}'s Farm` : 'My Farm'}
        subtitle="Good morning"
        action={<button className="rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white" onClick={() => navigate('profile')}>Profile</button>}
      >
        <div className="mt-3 flex flex-wrap gap-2">
          <Pill>{active} Active Pond{active === 1 ? '' : 's'}</Pill>
          <Pill muted>{ponds.length - active} Inactive</Pill>
          <Pill orange>DOC: {minDoc.length ? Math.min(...minDoc) : 0}</Pill>
        </div>
      </Header>
      <Body withNav>
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Expense" value={fmt(totalExpense)} />
          <StatCard label="Feed" value={fmt(totals.feed)} hint={totals.feedT ? `${totals.feedT.toFixed(1)} T` : '0 T'} />
          <StatCard label="Healthcare" value={fmt(totals.health)} />
        </div>
        <Card title="Expense Split">
          {categories.slice(0, 5).map((cat) => (
            <ProgressRow key={cat.key} label={cat.label} value={totalExpense ? Math.round(((totals[cat.key] || 0) / totalExpense) * 100) : 0} />
          ))}
        </Card>
        <Card title="Recent Entries" action={<button className="text-xs font-bold text-drgrow-teal" onClick={() => navigate('cost')}>View all</button>}>
          <EntryList entries={entries.slice(0, 4)} />
        </Card>
      </Body>
      <Fab open={fabOpen} setOpen={setFabOpen} navigate={navigate} />
      <BottomNav active="home" navigate={navigate} />
    </Screen>
  );
}

function fmt(n) {
  const v = Number(n) || 0;
  if (!v) return '₹0';
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(1)}K`;
  return `₹${v.toLocaleString('en-IN')}`;
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

function StatCard({ label, value, hint }) {
  return (
    <div className="mb-4 rounded-2xl border border-slate-100 bg-white p-4 text-center">
      <p className="text-lg font-extrabold text-drgrow-ink">{value}</p>
      {hint && <p className="text-xs font-bold text-drgrow-teal">{hint}</p>}
      <p className="mt-1 text-[11px] font-semibold text-slate-400">{label}</p>
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

function ProgressRow({ label, value }) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex justify-between text-xs font-bold">
        <span>{label}</span>
        <span>{value || 0}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-drgrow-teal" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function Pill({ children, muted, orange }) {
  const classes = orange
    ? 'border-drgrow-orange bg-drgrow-orange/10 text-drgrow-orange'
    : muted
      ? 'border-slate-200 bg-white/5 text-white/70'
      : 'border-drgrow-teal bg-drgrow-teal/10 text-drgrow-teal';
  return <span className={`rounded-full border px-3 py-1 text-xs font-bold ${classes}`}>{children}</span>;
}

function Fab({ open, setOpen, navigate }) {
  return (
    <>
      {open && <button className="absolute inset-0 z-40 bg-black/40" onClick={() => setOpen(false)} />}
      <div className={`absolute bottom-24 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-3 transition ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
        <button className="fab-option" onClick={() => navigate('add')}>💰 Add Expense</button>
        <button className="fab-option" onClick={() => navigate('culture')}>📈 Culture Data</button>
      </div>
      <button className="absolute bottom-12 left-1/2 z-50 grid h-14 w-14 -translate-x-1/2 place-items-center rounded-full border-4 border-white bg-drgrow-orange text-3xl text-white shadow-xl" onClick={() => setOpen(!open)}>
        +
      </button>
    </>
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

function FeedIcon() {
  return <span className="feed-ico" />;
}

function MedicineIcon() {
  return <span className="med-ico" />;
}
