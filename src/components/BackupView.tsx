/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { Download, Upload, Database, CheckCircle2, Lock, ShieldAlert } from 'lucide-react';
import { AppState } from '../types';

interface BackupViewProps {
  state: AppState;
  onImportBackup: (importedState: AppState) => void;
  onResetAll: () => void;
  onShowToast: (msg: string, isError?: boolean) => void;
  onReorganizeFirebase?: () => Promise<void>;
}

export default function BackupView({ state, onImportBackup, onResetAll, onShowToast, onReorganizeFirebase }: BackupViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [organizing, setOrganizing] = useState(false);

  const handleSyncDatabase = async () => {
    if (!onReorganizeFirebase) return;
    setOrganizing(true);
    try {
      await onReorganizeFirebase();
    } finally {
      setOrganizing(false);
    }
  };

  const handleExportBackup = () => {
    try {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `counterpro-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      onShowToast('Backup exported successfully');
    } catch (e) {
      onShowToast('Export failed', true);
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (!parsed.trips || !parsed.settings) {
          throw new Error('Invalid schema format');
        }
        onImportBackup(parsed);
      } catch (err) {
        onShowToast('Corrupted or invalid JSON backup file', true);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <section className="view relative overflow-hidden" id="view-backup">
      {/* Centered Professional Locked Notice Overlay */}
      <div 
        className="absolute inset-0 z-30 flex items-center justify-center p-4 sm:p-6"
        id="backup-lock-overlay"
      >
        <div className="max-w-lg w-full bg-[#121820]/95 dark:bg-[#0E141C]/95 backdrop-blur-md border border-amber-500/30 rounded-2xl p-6 sm:p-8 text-center shadow-2xl shadow-black/60 relative">
          {/* Subtle Ambient glow */}
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-32 h-32 bg-amber-500/15 rounded-full blur-2xl pointer-events-none" />

          {/* Lock Icon */}
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto mb-4 text-amber-400 shadow-inner">
            <Lock size={26} strokeWidth={2.2} />
          </div>

          {/* Locked Status Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-semibold tracking-wide uppercase mb-3">
            <ShieldAlert size={13} />
            <span>Feature Locked</span>
          </div>

          {/* Primary Bengali Message */}
          <h2 className="text-base sm:text-lg font-bold text-white mb-2 leading-relaxed tracking-normal font-display">
            “এই optionটা এখন বন্ধ রাখা হয়েছে। Developer পরে এটি unlock করবেন।”
          </h2>

          {/* English Subtitle */}
          <p className="text-xs sm:text-sm text-white/70 font-medium leading-relaxed">
            “This option is currently disabled. The developer will unlock it later.”
          </p>
        </div>
      </div>

      {/* Visually Disabled Background Content with ~50% opacity and blur, interactions disabled */}
      <div className="opacity-50 blur-[1.5px] pointer-events-none select-none filter transition-all duration-300">
        <div className="view-head">
          <div>
            <h1>Backup &amp; Restore</h1>
            <p className="view-sub">All data is stored locally in this browser</p>
          </div>
        </div>

        <div className="backup-grid">
          <div className="panel" style={{ gridColumn: '1 / -1', border: '1px solid var(--accent)', background: 'var(--panel-2)' }}>
            <div className="panel-head">
              <div className="flex items-center gap-2">
                <Database size={18} className="text-[var(--accent)]" />
                <h3>Firebase Database Auto-Organizer (Workflow Clean &amp; Sync)</h3>
              </div>
            </div>
            <p className="panel-text" style={{ marginBottom: '14px' }}>
              আপনার Firebase Firestore ডাটাবেজ সম্পূর্ণ নতুন Workflow অনুযায়ী সাজিয়ে দেওয়া হবে: <br />
              ১. <strong><code>data/&#123;AgencyName&#125;/trips</code></strong> এবং <strong><code>data/&#123;AgencyName&#125;/settings</code></strong> এ কাজের সমস্ত ডেটা আলাদা ফোল্ডারে থাকবে। <br />
              ২. <strong><code>users/&#123;userId&#125;</code></strong> এ <strong><code>information</code></strong> ও <strong><code>management</code></strong> (Agency Code, Account Status, User name ইত্যাদি) নিঁখুতভাবে সাজানো হবে। <br />
              ৩. পুরাতন অপ্রয়োজনীয় বা এলোমেলো ফাইলগুলো সম্পূর্ণ মুছে ক্লিন করে দেওয়া হবে।
            </p>
            <button 
              type="button" 
              onClick={handleSyncDatabase} 
              disabled={organizing}
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              {organizing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>সাজানো ও ক্লিন হচ্ছে (Organizing &amp; Cleaning)...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  <span>Sync &amp; Clean Firebase Now</span>
                </>
              )}
            </button>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h3>Export Backup</h3>
            </div>
            <p className="panel-text">
              Download every trip, seat, passenger record and setting as a single JSON file. Keep it safe —
              it's the only copy outside this browser.
            </p>
            <button onClick={handleExportBackup} className="btn btn-primary" id="exportJsonBtn">
              <Download size={16} />
              Export Backup (.json)
            </button>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h3>Import Backup</h3>
            </div>
            <p className="panel-text">
              Restore from a previously exported JSON file. This replaces all current data in this browser —
              export a fresh backup first if unsure.
            </p>
            <label className="btn btn-ghost file-btn cursor-pointer">
              <Upload size={16} />
              Choose Backup File
              <input
                ref={fileInputRef}
                type="file"
                id="importJsonInput"
                accept="application/json"
                hidden
                onChange={handleImportFile}
              />
            </label>
          </div>
        </div>

        <div className="panel danger-panel">
          <div className="panel-head">
            <h3>Reset All Data</h3>
          </div>
          <p className="panel-text">
            Permanently erase every trip, booking and setting from this browser. This cannot be undone.
          </p>
          <button onClick={onResetAll} className="btn btn-danger" id="resetAllBtn">
            Erase All Data
          </button>
        </div>
      </div>
    </section>
  );
}
