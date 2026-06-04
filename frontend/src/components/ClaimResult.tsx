import { useState } from 'react';
import {
  CheckCircle2, XCircle, AlertTriangle, Clock,
  ChevronDown, ChevronUp, ArrowLeft, IndianRupee,
  ShieldAlert, Pill, TestTube2, FileText, RefreshCcw,
} from 'lucide-react';

interface Props { data: any; onReset: () => void; }

const statusCfg: Record<string, { label: string; cls: string; Icon: any; color: string }> = {
  APPROVED: { label: 'Approved', cls: 'badge-approved', Icon: CheckCircle2, color: '#10b981' },
  REJECTED: { label: 'Rejected', cls: 'badge-rejected', Icon: XCircle, color: '#ef4444' },
  PARTIAL: { label: 'Partially Approved', cls: 'badge-partial', Icon: AlertTriangle, color: '#f59e0b' },
  MANUAL_REVIEW: { label: 'Manual Review', cls: 'badge-manual-review', Icon: Clock, color: '#3b82f6' },
};

function DataRow({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-200 font-medium text-right max-w-[60%] truncate">{value ?? '—'}</span>
    </div>
  );
}

export default function ClaimResult({ data, onReset }: Props) {
  const [open, setOpen] = useState(false);
  const d = data.decision;
  const ex = data.extracted_data;
  const status = d?.decision || 'REJECTED';
  const cfg = statusCfg[status] || statusCfg.REJECTED;
  const Icon = cfg.Icon;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <button onClick={onReset} className="mb-8 flex items-center gap-2 text-sm text-gray-400 hover:text-plum-300">
        <ArrowLeft className="h-4 w-4" /> Submit Another Claim
      </button>

      {/* Hero */}
      <div className="glass-card p-8 text-center animate-fade-in-up mb-6">
        <div className={`inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-lg font-bold ${cfg.cls} shadow-lg`}>
          <Icon className="h-6 w-6" /> {cfg.label}
        </div>
        <div className="mt-8">
          <p className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-1">Approved Amount</p>
          <p className="text-5xl font-extrabold text-white flex items-center justify-center gap-1">
            <IndianRupee className="h-8 w-8 text-plum-400" />
            {(d?.approved_amount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          {d?.copay_applied > 0 && <p className="mt-2 text-sm text-gray-400">Copay: {d.copay_applied}%</p>}
        </div>
        <div className="mt-8 max-w-xs mx-auto">
          <div className="flex justify-between mb-1.5">
            <span className="text-xs text-gray-400">Confidence</span>
            <span className="text-xs font-semibold text-plum-300">{((d?.confidence_score ?? 0) * 100).toFixed(0)}%</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-surface-elevated overflow-hidden">
            <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${(d?.confidence_score ?? 0) * 100}%`, background: `linear-gradient(90deg, ${cfg.color}, ${cfg.color}cc)` }} />
          </div>
        </div>
        <p className="mt-6 text-xs text-gray-500">Claim ID: <span className="font-mono text-gray-400">{data.claim_id}</span></p>
      </div>

      {/* Rejection Reasons */}
      {d?.rejection_reasons?.length > 0 && (
        <div className="glass-card p-6 mb-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <h3 className="flex items-center gap-2 text-base font-semibold text-red-400 mb-4">
            <ShieldAlert className="h-5 w-5" /> Rejection Reasons
          </h3>
          <ul className="space-y-3">
            {d.rejection_reasons.map((r: string, i: number) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <span className="text-gray-300">{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Notes */}
      {(d?.notes || d?.next_steps) && (
        <div className="glass-card p-6 mb-6 animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
          {d.notes && <div className="mb-4"><p className="text-xs font-semibold uppercase text-gray-500 mb-1">Notes</p><p className="text-sm text-gray-300">{d.notes}</p></div>}
          {d.next_steps && <div className="rounded-xl border border-plum-800/30 bg-plum-900/20 p-4"><p className="text-xs font-semibold uppercase text-plum-400 mb-1">Next Steps</p><p className="text-sm text-gray-300">{d.next_steps}</p></div>}
        </div>
      )}

      {/* Extracted Data */}
      {ex && (
        <div className="glass-card overflow-hidden mb-6 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between p-6 hover:bg-surface-elevated/50">
            <span className="flex items-center gap-2 text-base font-semibold text-white"><FileText className="h-5 w-5 text-plum-400" /> Extracted Data</span>
            {open ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
          </button>
          {open && (
            <div className="border-t border-plum-800/30 p-6 space-y-6">
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase text-plum-400">Patient</h4>
                  <DataRow label="Name" value={ex.patient_name} />
                  <DataRow label="Age" value={ex.patient_age} />
                  <DataRow label="Date" value={ex.treatment_date} />
                  <DataRow label="Diagnosis" value={ex.diagnosis} />
                </div>
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase text-plum-400">Doctor</h4>
                  <DataRow label="Name" value={ex.doctor_name} />
                  <DataRow label="Reg No." value={ex.doctor_registration_number} />
                  <DataRow label="Hospital" value={ex.hospital_name} />
                  <DataRow label="Type" value={ex.treatment_type} />
                </div>
              </div>
              {ex.medicines_prescribed?.length > 0 && (
                <div>
                  <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase text-plum-400 mb-2"><Pill className="h-3.5 w-3.5" /> Medicines</h4>
                  <div className="flex flex-wrap gap-2">{ex.medicines_prescribed.map((m: string, i: number) => <span key={i} className="rounded-lg bg-plum-900/40 border border-plum-800/30 px-3 py-1 text-xs text-gray-300">{m}</span>)}</div>
                </div>
              )}
              {ex.tests_ordered?.length > 0 && (
                <div>
                  <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase text-plum-400 mb-2"><TestTube2 className="h-3.5 w-3.5" /> Tests</h4>
                  <div className="flex flex-wrap gap-2">{ex.tests_ordered.map((t: string, i: number) => <span key={i} className="rounded-lg bg-plum-900/40 border border-plum-800/30 px-3 py-1 text-xs text-gray-300">{t}</span>)}</div>
                </div>
              )}
              {ex.bill_items?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase text-plum-400 mb-2">Bill</h4>
                  <div className="rounded-xl border border-plum-800/30 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-plum-800/30 bg-surface-elevated/50"><th className="px-4 py-2.5 text-left text-gray-400">Description</th><th className="px-4 py-2.5 text-right text-gray-400">Amount</th></tr></thead>
                      <tbody>{ex.bill_items.map((it: any, i: number) => <tr key={i} className="border-b border-plum-800/20 last:border-0"><td className="px-4 py-2.5 text-gray-300">{it.description || '—'}</td><td className="px-4 py-2.5 text-right font-mono text-gray-300">₹{(it.amount ?? 0).toLocaleString('en-IN')}</td></tr>)}</tbody>
                      <tfoot><tr className="bg-surface-elevated/80"><td className="px-4 py-2.5 font-semibold text-white">Total</td><td className="px-4 py-2.5 text-right font-mono font-semibold text-white">₹{(ex.total_amount ?? 0).toLocaleString('en-IN')}</td></tr></tfoot>
                    </table>
                  </div>
                </div>
              )}
              <div>
                <h4 className="text-xs font-semibold uppercase text-plum-400 mb-2">Documents Found</h4>
                <div className="flex gap-3 flex-wrap">
                  {Object.entries(ex.documents_present || {}).map(([k, v]) => (
                    <span key={k} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${v ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
                      {v ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />} {k.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="text-center animate-fade-in-up" style={{ animationDelay: '0.25s' }}>
        <button onClick={onReset} className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-plum-700 to-plum-600 px-8 py-3.5 font-semibold text-white shadow-lg shadow-plum-800/40 hover:scale-[1.01] active:scale-[0.99]">
          <RefreshCcw className="h-4 w-4" /> Submit Another Claim
        </button>
      </div>
    </div>
  );
}
