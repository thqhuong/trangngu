import {
  ArrowLeft, BarChart3, CheckCircle2, ExternalLink, FileCheck2, FileText,
  Gauge, KeyRound, Languages, LoaderCircle, LockKeyhole, RefreshCw,
  ScanText, ShieldCheck, TriangleAlert,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import type { AdminStats } from "../shared/contracts";
import { ApiError, loadAdminStats } from "./api";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export function AdminDashboard({ onBack }: { onBack: () => void }) {
  const [accessKey, setAccessKey] = useState("");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (key: string) => {
    setLoading(true);
    setError(null);
    try {
      setStats(await loadAdminStats(key));
    } catch (caught) {
      const message = caught instanceof ApiError && caught.code === "ADMIN_RATE_LIMITED"
        ? "Too many failed attempts. Wait 15 minutes before trying again."
        : caught instanceof ApiError && caught.code === "ADMIN_DISABLED"
          ? "The dashboard access key has not been configured on this deployment."
          : "That access key was not accepted.";
      setStats(null);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (accessKey.length >= 24 && !loading) void load(accessKey);
  };

  const chart = useMemo(() => {
    if (!stats) return [];
    const days = [...stats.daily].reverse().slice(-14);
    const maximum = Math.max(1, ...days.map((day) => day.pagesTranslated));
    return days.map((day) => ({ ...day, percentage: Math.max(3, day.pagesTranslated / maximum * 100) }));
  }, [stats]);

  if (!stats) {
    return <div className="admin-shell">
      <header className="admin-topbar">
        <button type="button" className="admin-back" onClick={onBack}><ArrowLeft size={17} /> Back to TrangNgữ</button>
        <span><LockKeyhole size={15} /> Private dashboard</span>
      </header>
      <main className="admin-login-page">
        <section className="admin-login-card" aria-labelledby="admin-login-title">
          <span className="admin-login-icon"><KeyRound size={28} /></span>
          <div className="eyebrow"><ShieldCheck size={15} /> Owner access</div>
          <h1 id="admin-login-title">Admin overview</h1>
          <p>Use the access key stored in Google Secret Manager. It is sent only over HTTPS and stays in this tab's memory.</p>
          <form onSubmit={submit}>
            <label htmlFor="admin-access-key">Admin access key</label>
            <input id="admin-access-key" type="password" value={accessKey} minLength={24} maxLength={256}
              autoComplete="current-password" onChange={(event) => setAccessKey(event.target.value)} autoFocus />
            {error && <div className="admin-login-error" role="alert"><TriangleAlert size={16} /> {error}</div>}
            <button className="primary-button" type="submit" disabled={accessKey.length < 24 || loading}>
              {loading ? <LoaderCircle className="spin" size={18} /> : <LockKeyhole size={18} />}
              {loading ? "Checking access…" : "Open dashboard"}
            </button>
          </form>
          <small>No key is saved in local storage, cookies, source code, or analytics.</small>
        </section>
      </main>
    </div>;
  }

  const ocrPercentage = Math.min(100, stats.limits.monthlyOcrPagesUsed / stats.limits.monthlyOcrPageCap * 100);
  return <div className="admin-shell">
    <header className="admin-topbar">
      <button type="button" className="admin-back" onClick={onBack}><ArrowLeft size={17} /> Back to TrangNgữ</button>
      <div className="admin-topbar-actions">
        <span><CheckCircle2 size={15} /> Aggregated counters only</span>
        <button type="button" className="admin-refresh" onClick={() => void load(accessKey)} disabled={loading}>
          <RefreshCw className={loading ? "spin" : ""} size={16} /> Refresh
        </button>
        <button type="button" className="admin-signout" onClick={() => { setStats(null); setAccessKey(""); }}>Lock</button>
      </div>
    </header>
    <main className="admin-dashboard">
      <section className="admin-heading">
        <div><div className="eyebrow"><BarChart3 size={16} /> Owner dashboard</div><h1>TrangNgữ at a glance</h1>
          <p>Usage, reliability, and quota signals without collecting document content.</p></div>
        <span>Updated {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(stats.generatedAt))}</span>
      </section>

      <section className="admin-kpis" aria-label="Today's key statistics">
        <article><span className="admin-kpi-icon green"><FileText size={20} /></span><small>Pages translated today</small><strong>{formatNumber(stats.today.pagesTranslated)}</strong><p>{formatNumber(stats.period.pagesTranslated)} in the last {stats.periodDays} days</p></article>
        <article><span className="admin-kpi-icon blue"><Languages size={20} /></span><small>Completed jobs today</small><strong>{formatNumber(stats.today.jobsCompleted)}</strong><p>{formatNumber(stats.period.jobsCompleted)} completed · {formatNumber(stats.period.jobsFailed)} failed</p></article>
        <article><span className="admin-kpi-icon amber"><ScanText size={20} /></span><small>OCR pages this month</small><strong>{formatNumber(stats.limits.monthlyOcrPagesUsed)}</strong><p>of {formatNumber(stats.limits.monthlyOcrPageCap)} app allowance</p></article>
        <article><span className="admin-kpi-icon red"><FileCheck2 size={20} /></span><small>Exports today</small><strong>{formatNumber(stats.today.exportsCompleted)}</strong><p>{formatNumber(stats.period.pagesExported)} pages exported in {stats.periodDays} days</p></article>
      </section>

      <div className="admin-grid">
        <section className="admin-panel usage-chart" aria-labelledby="usage-chart-title">
          <div className="admin-panel-heading"><div><span>Last 14 days</span><h2 id="usage-chart-title">Translated pages</h2></div><b>{formatNumber(stats.period.pagesTranslated)} <small>30-day total</small></b></div>
          <div className="bar-chart" role="img" aria-label="Pages translated per day over the last 14 days">
            {chart.map((day) => <div className="bar-column" key={day.date} title={`${day.date}: ${day.pagesTranslated} pages`}>
              <span>{day.pagesTranslated || ""}</span><i style={{ height: `${day.percentage}%` }} className={day.date === stats.today.date ? "is-today" : ""} />
              <small>{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${day.date}T00:00:00Z`))}</small>
            </div>)}
          </div>
          <div className="chart-legend"><span><i className="legend-pages" /> Pages translated</span><span>Today is highlighted</span></div>
        </section>

        <section className="admin-panel gemini-panel" aria-labelledby="gemini-panel-title">
          <div className="admin-panel-heading"><div><span>Provider signal</span><h2 id="gemini-panel-title">Gemini quota</h2></div><span className={`quota-health${stats.gemini.quotaErrors ? " has-warning" : ""}`}><Gauge size={16} /> {stats.gemini.quotaErrors ? "Check quota" : "No quota errors"}</span></div>
          <dl><div><dt>Configured model</dt><dd>{stats.gemini.model}</dd></div><div><dt>Observed completed jobs</dt><dd>{formatNumber(stats.gemini.observedCompletedJobs)}</dd></div><div><dt>Quota errors, {stats.periodDays} days</dt><dd>{formatNumber(stats.gemini.quotaErrors)}</dd></div><div><dt>Remaining provider quota</dt><dd>Not exposed by the API</dd></div></dl>
          <p>TrangNgữ can observe successful work and quota errors, but Gemini's authoritative remaining free-tier quota must be checked in Google Cloud.</p>
          <a href={stats.gemini.quotaConsoleUrl} target="_blank" rel="noreferrer">Open Google quota console <ExternalLink size={15} /></a>
        </section>

        <section className="admin-panel allowance-panel" aria-labelledby="allowance-title">
          <div className="admin-panel-heading"><div><span>Cost guardrail</span><h2 id="allowance-title">Application allowances</h2></div><ShieldCheck size={20} /></div>
          <div className="allowance-meter"><div><span>Monthly OCR pages</span><strong>{Math.round(ocrPercentage)}%</strong></div><i><b style={{ width: `${ocrPercentage}%` }} /></i></div>
          <ul><li><span>Pages per job</span><b>{stats.limits.maxPagesPerJob}</b></li><li><span>Jobs per requester / day</span><b>{stats.limits.dailyJobLimitPerRequester}</b></li><li><span>Pages per requester / day</span><b>{stats.limits.dailyPageLimitPerRequester}</b></li></ul>
          <small>Application limits reduce accidental usage; they are not provider billing caps.</small>
        </section>

        <section className="admin-panel reliability-panel" aria-labelledby="reliability-title">
          <div className="admin-panel-heading"><div><span>Last {stats.periodDays} days</span><h2 id="reliability-title">Reliability</h2></div><CheckCircle2 size={20} /></div>
          <div className="reliability-row"><span>Jobs received</span><b>{formatNumber(stats.period.jobsReceived)}</b></div>
          <div className="reliability-row"><span>Jobs completed</span><b>{formatNumber(stats.period.jobsCompleted)}</b></div>
          <div className="reliability-row"><span>Translation failures</span><b>{formatNumber(stats.period.jobsFailed)}</b></div>
          <div className="reliability-row"><span>Provider errors</span><b>{formatNumber(stats.period.providerErrors)}</b></div>
          <div className="reliability-row"><span>Failed exports</span><b>{formatNumber(stats.period.exportsFailed)}</b></div>
        </section>
      </div>

      <aside className="admin-privacy"><ShieldCheck size={19} /><div><strong>Privacy boundary</strong><p>{stats.privacy}</p></div></aside>
    </main>
  </div>;
}
