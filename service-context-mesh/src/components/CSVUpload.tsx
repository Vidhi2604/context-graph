"use client";

import { useState, useRef, useCallback } from "react";

interface CSVUploadResult {
  filename: string;
  total_rows: number;
  total_ingested: number;
  total_failed: number;
  total_skipped: number;
  parse_errors: number;
  batch_errors: { batch: number; error: string }[];
}

interface CSVUploadProps {
  orgId: string;
  vertical: string;
  onClose: () => void;
}

type UploadState = "idle" | "uploading" | "done" | "error";

export default function CSVUpload({ orgId, vertical, onClose }: CSVUploadProps) {
  const [state, setState] = useState<UploadState>("idle");
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<CSVUploadResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isRetail = vertical === "retail";

  const expectedColumns = isRetail
    ? ["profile_id", "name", "event_type", "timestamp", "amount", "channel", "status", "tier", "city", "product_id", "brand", "category", "payment_method"]
    : ["profile_id", "name", "visit_id", "type", "timestamp", "department", "status", "priority", "diagnosis_name", "icd_code", "provider_name", "insurance_provider"];

  const handleFile = useCallback((f: File) => {
    const isCSV = f.name.endsWith(".csv");
    const isTSV = f.name.endsWith(".tsv") || f.name.endsWith(".txt");
    if (!isCSV && !isTSV) {
      setErrorMsg("Only .csv or .tsv files are supported");
      return;
    }
    if (f.size > 100 * 1024 * 1024) {
      setErrorMsg("File must be under 100MB");
      return;
    }
    setFile(f);
    setErrorMsg(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleUpload = async () => {
    if (!file) return;
    setState("uploading");
    setProgress(10);

    const formData = new FormData();
    formData.append("file", file);

    try {
      setProgress(30);
      const res = await fetch("/api/ingest/csv", {
        method: "POST",
        headers: { "x-org-id": orgId },
        body: formData,
      });

      setProgress(90);
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error ?? "Upload failed");
        setState("error");
        return;
      }

      setResult(data);
      setState("done");
      setProgress(100);
    } catch (e) {
      setErrorMsg(String(e));
      setState("error");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-950 border border-gray-800 rounded-xl w-full max-w-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div>
            <h2 className="text-white font-semibold text-lg">Bulk CSV Upload</h2>
            <p className="text-gray-500 text-xs mt-0.5">
              Import up to 1,00,000 rows · {isRetail ? "Retail" : "Healthcare"} vertical
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Expected columns hint */}
          <div className="bg-gray-900 rounded-lg p-3 border border-gray-800">
            <p className="text-gray-400 text-xs font-medium mb-2">Expected columns (any order, extras ignored):</p>
            <div className="flex flex-wrap gap-1.5">
              {expectedColumns.map((col) => (
                <span key={col} className="bg-gray-800 text-gray-300 text-[10px] px-2 py-0.5 rounded font-mono">
                  {col}
                </span>
              ))}
            </div>
          </div>

          {/* Drop zone */}
          {state === "idle" && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                dragOver
                  ? "border-emerald-500 bg-emerald-500/5"
                  : file
                  ? "border-emerald-600 bg-emerald-500/5"
                  : "border-gray-700 hover:border-gray-500"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv,.txt"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />

              {file ? (
                <div>
                  <div className="text-emerald-400 text-3xl mb-2">📄</div>
                  <p className="text-white font-medium">{file.name}</p>
                  <p className="text-gray-500 text-sm mt-1">{(file.size / 1024).toFixed(1)} KB · Click to change</p>
                </div>
              ) : (
                <div>
                  <div className="text-gray-500 text-3xl mb-2">☁️</div>
                  <p className="text-gray-300 font-medium">Drop your CSV here</p>
                  <p className="text-gray-600 text-sm mt-1">or click to browse · .csv or .tsv · max 100MB · 1,00,000 rows</p>
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {errorMsg && (
            <div className="bg-red-950/50 border border-red-800 rounded-lg px-4 py-3 text-red-400 text-sm">
              {errorMsg}
            </div>
          )}

          {/* Uploading */}
          {state === "uploading" && (
            <div className="space-y-3">
              <div className="flex justify-between text-sm text-gray-400">
                <span>Uploading and processing {file?.name}...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-gray-600 text-xs">
                AI maps your columns, then writes 1,000 rows at a time directly to Neo4j. Usually under 30s for 25k rows.
              </p>
            </div>
          )}

          {/* Result */}
          {state === "done" && result && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Total Rows", value: result.total_rows.toLocaleString(), color: "text-white" },
                  { label: "Ingested", value: result.total_ingested.toLocaleString(), color: "text-emerald-400" },
                  { label: "Skipped", value: result.total_skipped.toLocaleString(), color: "text-yellow-400" },
                  { label: "Failed", value: result.total_failed.toLocaleString(), color: "text-red-400" },
                ].map((s) => (
                  <div key={s.label} className="bg-gray-900 rounded-lg p-3 text-center border border-gray-800">
                    <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                    <div className="text-gray-500 text-[10px] mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>

              {result.batch_errors.length > 0 && (
                <div className="bg-red-950/30 border border-red-900 rounded-lg p-3">
                  <p className="text-red-400 text-xs font-medium mb-2">Batch errors:</p>
                  {result.batch_errors.map((e) => (
                    <p key={e.batch} className="text-red-500 text-xs">Batch {e.batch}: {e.error}</p>
                  ))}
                </div>
              )}

              {result.parse_errors > 0 && (
                <p className="text-yellow-500 text-xs">{result.parse_errors} rows could not be parsed and were skipped.</p>
              )}

              <div className="bg-emerald-950/30 border border-emerald-900 rounded-lg px-4 py-3 text-emerald-400 text-sm">
                ✓ Upload complete. Search your data in the dashboard.
              </div>
            </div>
          )}

          {state === "error" && (
            <button
              onClick={() => { setState("idle"); setErrorMsg(null); }}
              className="text-sm text-gray-400 hover:text-white underline"
            >
              ← Try again
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white"
          >
            {state === "done" ? "Close" : "Cancel"}
          </button>
          {state === "idle" && (
            <button
              onClick={handleUpload}
              disabled={!file}
              className="px-5 py-2 text-sm bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg font-medium transition-colors"
            >
              Upload & Ingest
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
