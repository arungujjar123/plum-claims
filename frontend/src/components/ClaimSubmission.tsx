import { useState, useCallback } from 'react';
import {
  Upload,
  FileText,
  X,
  Send,
  Loader2,
  User,
  CreditCard,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  FileImage,
} from 'lucide-react';
import axios from 'axios';
import ClaimResult from './ClaimResult';

interface FilePreview {
  file: File;
  id: string;
}

export default function ClaimSubmission() {
  const [memberName, setMemberName] = useState('');
  const [memberId, setMemberId] = useState('');
  const [policyId, setPolicyId] = useState('PLUM_OPD_2024');
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // ── File handling ──
  const addFiles = useCallback((incoming: FileList | File[]) => {
    const newFiles = Array.from(incoming)
      .filter((f) => {
        const ext = f.name.toLowerCase();
        return (
          ext.endsWith('.pdf') ||
          ext.endsWith('.png') ||
          ext.endsWith('.jpg') ||
          ext.endsWith('.jpeg') ||
          ext.endsWith('.webp') ||
          ext.endsWith('.tiff')
        );
      })
      .map((f) => ({ file: f, id: crypto.randomUUID() }));
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // Drag handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  // ── Submit ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberName.trim() || !memberId.trim() || files.length === 0) return;

    setIsSubmitting(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('member_name', memberName);
    formData.append('member_id', memberId);
    formData.append('policy_id', policyId);
    files.forEach((fp) => formData.append('files', fp.file));

    try {
      const res = await axios.post('/api/claims', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120_000,
      });
      setResult(res.data);
    } catch (err: any) {
      const msg =
        err.response?.data?.detail ||
        err.message ||
        'Something went wrong. Please try again.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setMemberName('');
    setMemberId('');
    setPolicyId('PLUM_OPD_2024');
    setFiles([]);
    setResult(null);
    setError(null);
  };

  // ── If we have a result, show ClaimResult instead ──
  if (result) {
    return <ClaimResult data={result} onReset={resetForm} />;
  }

  // ── Form ──
  const isValid = memberName.trim() && memberId.trim() && files.length > 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-10 text-center animate-fade-in-up">
        <div className="inline-flex items-center gap-2 rounded-full bg-plum-900/40 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-plum-300 mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          AI-Powered Adjudication
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-2">
          Submit OPD Claim
        </h1>
        <p className="text-gray-400 max-w-lg mx-auto">
          Upload your medical documents and our AI will extract data, verify coverage, and
          deliver an instant adjudication decision.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        {/* Member Info */}
        <div className="glass-card p-6 space-y-5">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <User className="w-5 h-5 text-plum-400" />
            Member Information
          </h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="memberName" className="block text-sm font-medium text-gray-300 mb-1.5">
                Member Name
              </label>
              <input
                id="memberName"
                type="text"
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                placeholder="Enter full name"
                required
                className="w-full rounded-xl border border-plum-800/40 bg-surface-elevated px-4 py-3 text-sm text-white placeholder-gray-500 outline-none transition-all focus:border-plum-500 focus:ring-2 focus:ring-plum-500/20"
              />
            </div>
            <div>
              <label htmlFor="memberId" className="block text-sm font-medium text-gray-300 mb-1.5">
                Member ID
              </label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  id="memberId"
                  type="text"
                  value={memberId}
                  onChange={(e) => setMemberId(e.target.value)}
                  placeholder="e.g. MEM-001"
                  required
                  className="w-full rounded-xl border border-plum-800/40 bg-surface-elevated pl-10 pr-4 py-3 text-sm text-white placeholder-gray-500 outline-none transition-all focus:border-plum-500 focus:ring-2 focus:ring-plum-500/20"
                />
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="policyId" className="block text-sm font-medium text-gray-300 mb-1.5">
              Policy ID
            </label>
            <div className="relative">
              <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                id="policyId"
                type="text"
                value={policyId}
                onChange={(e) => setPolicyId(e.target.value)}
                className="w-full rounded-xl border border-plum-800/40 bg-surface-elevated pl-10 pr-4 py-3 text-sm text-white placeholder-gray-500 outline-none transition-all focus:border-plum-500 focus:ring-2 focus:ring-plum-500/20"
              />
            </div>
          </div>
        </div>

        {/* Document Upload */}
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-plum-400" />
            Medical Documents
          </h2>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-300 cursor-pointer ${
              isDragging
                ? 'border-plum-400 bg-plum-900/30 scale-[1.01]'
                : 'border-plum-800/40 bg-surface-elevated/50 hover:border-plum-600/60 hover:bg-surface-elevated'
            }`}
            onClick={() => document.getElementById('fileInput')?.click()}
          >
            <input
              id="fileInput"
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.webp,.tiff"
              className="hidden"
              onChange={(e) => e.target.files && addFiles(e.target.files)}
            />
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-plum-600/20 to-plum-800/20">
              <Upload className={`h-7 w-7 text-plum-400 transition-transform ${isDragging ? 'scale-110' : ''}`} />
            </div>
            <p className="text-sm font-medium text-gray-300">
              {isDragging ? 'Drop files here' : 'Drag & drop files or click to browse'}
            </p>
            <p className="mt-1 text-xs text-gray-500">PDF, PNG, JPG, WebP, TIFF — multiple files allowed</p>
          </div>

          {/* File previews */}
          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((fp) => (
                <div
                  key={fp.id}
                  className="flex items-center gap-3 rounded-xl border border-plum-800/30 bg-surface-elevated px-4 py-3 transition-all hover:border-plum-700/50"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-plum-900/50">
                    {fp.file.type.startsWith('image/') ? (
                      <FileImage className="h-4 w-4 text-plum-400" />
                    ) : (
                      <FileText className="h-4 w-4 text-plum-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-200">{fp.file.name}</p>
                    <p className="text-xs text-gray-500">{(fp.file.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(fp.id);
                    }}
                    className="rounded-lg p-1.5 text-gray-500 transition hover:bg-red-500/10 hover:text-red-400"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 animate-fade-in-up">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
            <div>
              <p className="text-sm font-medium text-red-300">Submission Failed</p>
              <p className="mt-1 text-sm text-red-400/80">{error}</p>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!isValid || isSubmitting}
          className={`w-full flex items-center justify-center gap-3 rounded-2xl py-4 text-base font-semibold transition-all duration-300 ${
            isValid && !isSubmitting
              ? 'bg-gradient-to-r from-plum-700 to-plum-600 text-white shadow-lg shadow-plum-800/40 hover:shadow-plum-700/50 hover:scale-[1.01] active:scale-[0.99]'
              : 'bg-surface-elevated text-gray-500 cursor-not-allowed'
          }`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>AI is analyzing your documents…</span>
            </>
          ) : (
            <>
              <Send className="h-5 w-5" />
              <span>Submit Claim</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
