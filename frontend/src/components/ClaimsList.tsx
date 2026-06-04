import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  CheckCircle2, XCircle, AlertTriangle, Clock,
  Eye, Loader2, RefreshCw, Inbox, IndianRupee,
} from 'lucide-react';

interface Claim {
  claim_id: string;
  member_name: string;
  member_id: string;
  policy_id: string;
  status: string;
  decision_status: string | null;
  approved_amount: number | null;
  total_amount: number | null;
  created_at: string | null;
}

const badgeCfg: Record<string, { label: string; cls: string; Icon: any }> = {
  APPROVED: { label: 'Approved', cls: 'badge-approved', Icon: CheckCircle2 },
  REJECTED: { label: 'Rejected', cls: 'badge-rejected', Icon: XCircle },
  PARTIAL: { label: 'Partial', cls: 'badge-partial', Icon: AlertTriangle },
  MANUAL_REVIEW: { label: 'Review', cls: 'badge-manual-review', Icon: Clock },
};

export default function ClaimsList() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);

  const fetchClaims = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get('/api/claims');
      setClaims(res.data.claims);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to load claims');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClaims(); }, []);

  const viewClaim = async (id: string) => {
    try {
      const res = await axios.get(`/api/claims/${id}`);
      setDetail(res.data);
    } catch { /* ignore */ }
  };

  // ── Detail Modal ──
  if (detail) {
    const d = detail.decision;
    const status = d?.decision || 'REJECTED';
    const cfg = badgeCfg[status] || badgeCfg.REJECTED;
    const Icon = cfg.Icon;
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <button onClick={() => setDetail(null)} className="mb-6 text-sm text-gray-400 hover:text-plum-300">← Back to list</button>
        <div className="glass-card p-6 mb-6 animate-fade-in-up">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Claim {detail.claim_id}</h2>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${cfg.cls}`}>
              <Icon className="h-3.5 w-3.5" /> {cfg.label}
            </span>
          </div>
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-500">Member:</span> <span className="ml-2 text-gray-200">{detail.member_name}</span></div>
            <div><span className="text-gray-500">Member ID:</span> <span className="ml-2 text-gray-200">{detail.member_id}</span></div>
            <div><span className="text-gray-500">Policy:</span> <span className="ml-2 text-gray-200">{detail.policy_id}</span></div>
            <div><span className="text-gray-500">Request ID:</span> <span className="ml-2 font-mono text-gray-200 text-xs">{detail.request_id}</span></div>
          </div>
        </div>
        {d && (
          <div className="glass-card p-6 mb-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            <div className="grid sm:grid-cols-3 gap-6 text-center">
              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">Approved</p>
                <p className="text-2xl font-bold text-white flex items-center justify-center gap-1">
                  <IndianRupee className="h-5 w-5 text-plum-400" />{(d.approved_amount ?? 0).toLocaleString('en-IN')}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">Copay</p>
                <p className="text-2xl font-bold text-white">{d.copay_applied}%</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">Confidence</p>
                <p className="text-2xl font-bold text-white">{((d.confidence_score ?? 0) * 100).toFixed(0)}%</p>
              </div>
            </div>
            {d.rejection_reasons?.length > 0 && (
              <div className="mt-6 space-y-2">
                {d.rejection_reasons.map((r: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-red-400">
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0" /> {r}
                  </div>
                ))}
              </div>
            )}
            {d.next_steps && (
              <div className="mt-4 rounded-xl bg-plum-900/20 border border-plum-800/30 p-4">
                <p className="text-xs uppercase text-plum-400 font-semibold mb-1">Next Steps</p>
                <p className="text-sm text-gray-300">{d.next_steps}</p>
              </div>
            )}
          </div>
        )}
        {detail.error && (
          <div className="glass-card p-6 mb-6 border-red-500/20">
            <p className="text-sm text-red-400">{detail.error}</p>
          </div>
        )}
      </div>
    );
  }

  // ── List View ──
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-8 animate-fade-in-up">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">All Claims</h1>
          <p className="text-gray-400 text-sm mt-1">Track and manage submitted OPD claims</p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchClaims} className="flex items-center gap-2 rounded-xl border border-plum-800/40 bg-surface-elevated px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:border-plum-600/50 transition">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <Link to="/" className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-plum-700 to-plum-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-plum-800/30 hover:scale-[1.01] transition">
            + New Claim
          </Link>
        </div>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Loader2 className="h-8 w-8 animate-spin text-plum-400 mb-3" />
          <p className="text-sm">Loading claims…</p>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400 mb-6">
          {error}
        </div>
      )}

      {!loading && !error && claims.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Inbox className="h-12 w-12 mb-4 text-plum-800" />
          <p className="text-lg font-medium text-gray-300">No claims yet</p>
          <p className="text-sm mt-1">Submit your first OPD claim to get started</p>
          <Link to="/" className="mt-6 rounded-xl bg-plum-700 px-6 py-2.5 text-sm font-medium text-white hover:bg-plum-600 transition">
            Submit Claim
          </Link>
        </div>
      )}

      {!loading && claims.length > 0 && (
        <div className="glass-card overflow-hidden animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-plum-800/30 bg-surface-elevated/50">
                  <th className="px-5 py-3.5 text-left font-medium text-gray-400">Claim ID</th>
                  <th className="px-5 py-3.5 text-left font-medium text-gray-400">Member</th>
                  <th className="px-5 py-3.5 text-left font-medium text-gray-400">Date</th>
                  <th className="px-5 py-3.5 text-center font-medium text-gray-400">Decision</th>
                  <th className="px-5 py-3.5 text-right font-medium text-gray-400">Amount</th>
                  <th className="px-5 py-3.5 text-right font-medium text-gray-400"></th>
                </tr>
              </thead>
              <tbody>
                {claims.map((c) => {
                  const cfg2 = c.decision_status ? (badgeCfg[c.decision_status] || badgeCfg.REJECTED) : null;
                  const Ic = cfg2?.Icon;
                  return (
                    <tr key={c.claim_id} className="border-b border-plum-800/20 last:border-0 hover:bg-surface-elevated/30 transition">
                      <td className="px-5 py-4 font-mono text-xs text-plum-300">{c.claim_id}</td>
                      <td className="px-5 py-4">
                        <p className="font-medium text-gray-200">{c.member_name}</p>
                        <p className="text-xs text-gray-500">{c.member_id}</p>
                      </td>
                      <td className="px-5 py-4 text-gray-400 text-xs">
                        {c.created_at ? new Date(c.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td className="px-5 py-4 text-center">
                        {cfg2 && Ic ? (
                          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${cfg2.cls}`}>
                            <Ic className="h-3 w-3" /> {cfg2.label}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-500">{c.status}</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right font-mono text-gray-200">
                        {c.approved_amount != null ? `₹${c.approved_amount.toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button onClick={() => viewClaim(c.claim_id)} className="inline-flex items-center gap-1.5 rounded-lg border border-plum-800/40 px-3 py-1.5 text-xs text-gray-300 hover:text-white hover:border-plum-600/50 transition">
                          <Eye className="h-3.5 w-3.5" /> View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-plum-800/20">
            {claims.map((c) => {
              const cfg2 = c.decision_status ? (badgeCfg[c.decision_status] || badgeCfg.REJECTED) : null;
              const Ic = cfg2?.Icon;
              return (
                <div key={c.claim_id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-plum-300">{c.claim_id}</span>
                    {cfg2 && Ic && (
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${cfg2.cls}`}>
                        <Ic className="h-3 w-3" /> {cfg2.label}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-200">{c.member_name}</span>
                    <span className="font-mono text-sm text-gray-200">{c.approved_amount != null ? `₹${c.approved_amount.toLocaleString('en-IN')}` : '—'}</span>
                  </div>
                  <button onClick={() => viewClaim(c.claim_id)} className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-plum-800/40 py-2 text-xs text-gray-300 hover:text-white transition">
                    <Eye className="h-3.5 w-3.5" /> View Details
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
