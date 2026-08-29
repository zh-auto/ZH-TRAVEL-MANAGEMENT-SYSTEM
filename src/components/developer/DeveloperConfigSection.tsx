/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Sliders,
  Mail,
  Key,
  ShieldCheck,
  Save,
  CheckCircle2,
  AlertTriangle,
  BadgeAlert,
  Users,
  Lock,
  Sparkles,
  Info,
  Image as ImageIcon,
  Upload,
  RefreshCw,
  Eye,
  Trash2,
  Link as LinkIcon,
} from 'lucide-react';
import { SystemConfig } from './types';
import { AuthUser } from '../../types';
import { ZH_OFFICIAL_LOGO } from '../../assets/logo';

interface DeveloperConfigSectionProps {
  currentUser: AuthUser;
  systemConfig: SystemConfig;
  configSaving: boolean;
  onSaveConfig: (updated: SystemConfig) => Promise<void>;
  formatTimestamp: (ts: any) => string;
}

export default function DeveloperConfigSection({
  currentUser,
  systemConfig,
  configSaving,
  onSaveConfig,
  formatTimestamp,
}: DeveloperConfigSectionProps) {
  const [formData, setFormData] = useState<SystemConfig>({
    developerEmail: systemConfig.developerEmail || currentUser.email || '',
    developerCode: systemConfig.developerCode || currentUser.agencyCode || '',
    maintenanceMode: systemConfig.maintenanceMode ?? false,
    maintenanceMessage:
      systemConfig.maintenanceMessage ||
      'System is undergoing scheduled maintenance. Please check back shortly.',
    allowNewRegistrations: systemConfig.allowNewRegistrations ?? true,
    defaultCodePrefix: systemConfig.defaultCodePrefix || 'ZH-SNT-',
    systemNotice: systemConfig.systemNotice || '',
    showNotice: systemConfig.showNotice ?? false,
    sessionTimeoutMinutes: systemConfig.sessionTimeoutMinutes || 120,
    appLogo: systemConfig.appLogo || '',
    updatedAt: systemConfig.updatedAt,
    updatedBy: systemConfig.updatedBy,
  });

  const [validationError, setValidationError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFormData({
      developerEmail: systemConfig.developerEmail || currentUser.email || '',
      developerCode: systemConfig.developerCode || currentUser.agencyCode || '',
      maintenanceMode: systemConfig.maintenanceMode ?? false,
      maintenanceMessage:
        systemConfig.maintenanceMessage ||
        'System is undergoing scheduled maintenance. Please check back shortly.',
      allowNewRegistrations: systemConfig.allowNewRegistrations ?? true,
      defaultCodePrefix: systemConfig.defaultCodePrefix || 'ZH-SNT-',
      systemNotice: systemConfig.systemNotice || '',
      showNotice: systemConfig.showNotice ?? false,
      sessionTimeoutMinutes: systemConfig.sessionTimeoutMinutes || 120,
      appLogo: systemConfig.appLogo || '',
      updatedAt: systemConfig.updatedAt,
      updatedBy: systemConfig.updatedBy,
    });
  }, [systemConfig, currentUser]);

  // Helper to process, resize and convert image to high-quality compressed Base64
  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setValidationError('Please upload a valid image file (PNG, JPG, WEBP, or SVG).');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setValidationError('Image size too large. Please select an image under 8MB.');
      return;
    }

    setIsProcessingImage(true);
    setValidationError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (!result) {
        setIsProcessingImage(false);
        return;
      }

      // Resize image on canvas to keep base64 optimized for Firestore (<400KB)
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 512;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          // Use PNG if transparent or JPEG with 0.92 quality
          const isPng = file.type === 'image/png' || file.type === 'image/svg+xml';
          const compressedDataUrl = isPng
            ? canvas.toDataURL('image/png')
            : canvas.toDataURL('image/jpeg', 0.92);

          setFormData((prev) => ({ ...prev, appLogo: compressedDataUrl }));
        } else {
          setFormData((prev) => ({ ...prev, appLogo: result }));
        }
        setIsProcessingImage(false);
      };
      img.onerror = () => {
        setFormData((prev) => ({ ...prev, appLogo: result }));
        setIsProcessingImage(false);
      };
      img.src = result;
    };
    reader.onerror = () => {
      setValidationError('Failed to read selected image file.');
      setIsProcessingImage(false);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processImageFile(files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processImageFile(e.dataTransfer.files[0]);
    }
  };

  const handleApplyUrl = () => {
    if (!customUrlInput.trim()) return;
    setFormData((prev) => ({ ...prev, appLogo: customUrlInput.trim() }));
    setCustomUrlInput('');
    setShowUrlInput(false);
  };

  const handleResetToOfficialLogo = () => {
    setFormData((prev) => ({ ...prev, appLogo: ZH_OFFICIAL_LOGO }));
  };

  const handleClearCustomLogo = () => {
    setFormData((prev) => ({ ...prev, appLogo: '' }));
  };

  const currentActiveLogo = formData.appLogo || ZH_OFFICIAL_LOGO;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setSaveSuccess(false);

    if (!formData.developerEmail || !formData.developerEmail.includes('@')) {
      setValidationError('Please enter a valid Developer Email address.');
      return;
    }

    if (!formData.developerCode || formData.developerCode.trim().length < 4) {
      setValidationError('Developer Code must be at least 4 characters long.');
      return;
    }

    try {
      await onSaveConfig({
        ...formData,
        developerEmail: formData.developerEmail.trim().toLowerCase(),
        developerCode: formData.developerCode.trim(),
        appLogo: formData.appLogo || '',
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      setValidationError(err.message || 'Failed to save configuration.');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header Banner */}
      <div className="bg-[#0E141C] border border-[#1E2633] rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sliders size={20} className="text-amber-400" />
            <h2 className="text-base font-bold text-white">Developer Configuration &amp; Authorization</h2>
          </div>
          <p className="text-xs text-white/80">
            Configure Developer Login authorization credentials, official brand logo, and system-wide behavioral parameters stored in Firebase.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono flex items-center gap-1.5">
            <ShieldCheck size={14} />
            <span>Root Authority Active</span>
          </div>
        </div>
      </div>

      {validationError && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-center gap-2.5">
          <AlertTriangle size={16} className="shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400 flex items-center gap-2.5">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>Configuration &amp; Brand Logo saved successfully to Firebase! All portal views, headers, and login screens have been updated in real-time.</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SECTION 1: OFFICIAL SYSTEM BRAND LOGO MANAGEMENT */}
        <div className="bg-[#0E141C] border border-[#1E2633] rounded-2xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#1E2633]">
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ImageIcon size={16} className="text-amber-400" />
                <span>Official System Brand Logo (সিস্টেম ব্র্যান্ড লোগো পরিবর্তন)</span>
              </h3>
              <p className="text-[11px] text-white/70">
                Change the global website logo from here. Once saved, it updates the Login page, User Topbar, Developer Topbar, and Print Tickets across the entire system.
              </p>
            </div>
            <span className="text-[10px] font-mono px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 self-start sm:self-auto flex items-center gap-1.5">
              <Sparkles size={12} />
              <span>Firebase Synced</span>
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Logo Preview Frames */}
            <div className="lg:col-span-5 space-y-3">
              <span className="text-xs font-semibold text-white/90 flex items-center gap-1.5">
                <Eye size={14} className="text-amber-400" />
                <span>Live Logo Preview (লাইভ প্রিভিউ)</span>
              </span>

              <div className="grid grid-cols-2 gap-3">
                {/* Dark Frame Preview */}
                <div className="p-3.5 rounded-xl bg-[#090D14] border border-[#232D3B] flex flex-col items-center justify-center text-center space-y-2">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-white border border-white/20 shadow-md p-1.5 flex items-center justify-center overflow-hidden">
                    <img
                      src={currentActiveLogo}
                      alt="Brand Logo Preview Dark"
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = ZH_OFFICIAL_LOGO;
                      }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-white/70">Dark Header Preview</span>
                </div>

                {/* Light Frame Preview */}
                <div className="p-3.5 rounded-xl bg-[#F1F5F9] border border-gray-300 flex flex-col items-center justify-center text-center space-y-2 text-gray-800">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-white border border-gray-200 shadow-sm p-1.5 flex items-center justify-center overflow-hidden">
                    <img
                      src={currentActiveLogo}
                      alt="Brand Logo Preview Light"
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = ZH_OFFICIAL_LOGO;
                      }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-gray-600">Light Ticket Preview</span>
                </div>
              </div>

              {/* Status info */}
              <div className="p-2.5 rounded-xl bg-[#141A23] border border-[#232D3B] flex items-center justify-between text-[11px]">
                <span className="text-white/70">Current State:</span>
                <span className="font-mono font-bold text-amber-400">
                  {formData.appLogo ? 'Custom Uploaded Logo' : 'Default Official ZH Logo'}
                </span>
              </div>
            </div>

            {/* Right: Upload & Actions Area */}
            <div className="lg:col-span-7 space-y-4">
              <span className="text-xs font-semibold text-white/90 flex items-center gap-1.5">
                <Upload size={14} className="text-amber-400" />
                <span>Upload New Logo (নতুন লোগো আপলোড করুন)</span>
              </span>

              {/* Drag & Drop Upload Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                  dragOver
                    ? 'border-amber-400 bg-amber-500/10'
                    : 'border-[#2D394A] bg-[#141A23] hover:border-amber-400/60 hover:bg-[#18212D]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png, image/jpeg, image/webp, image/svg+xml"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <Upload size={18} />
                </div>

                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-white">
                    {isProcessingImage ? 'Processing & Optimizing Image...' : 'Click to Browse or Drag & Drop image file'}
                  </p>
                  <p className="text-[11px] text-white/60">
                    Supports PNG, JPG, WebP, SVG (Recommended: 512×512 square transparent or white background)
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleResetToOfficialLogo}
                  className="px-3 py-2 rounded-xl bg-[#1A2330] hover:bg-[#232F42] border border-[#2D394A] text-white/90 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <RefreshCw size={13} className="text-amber-400" />
                  <span>Reset to Official ZH Logo (ডিফল্ট ZH লোগো)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowUrlInput((prev) => !prev)}
                  className="px-3 py-2 rounded-xl bg-[#1A2330] hover:bg-[#232F42] border border-[#2D394A] text-white/90 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <LinkIcon size={13} className="text-blue-400" />
                  <span>Enter Image URL</span>
                </button>

                {formData.appLogo && (
                  <button
                    type="button"
                    onClick={handleClearCustomLogo}
                    className="px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ml-auto"
                  >
                    <Trash2 size={13} />
                    <span>Clear Custom</span>
                  </button>
                )}
              </div>

              {/* URL Input Form if toggled */}
              {showUrlInput && (
                <div className="p-3 rounded-xl bg-[#141A23] border border-[#232D3B] flex items-center gap-2">
                  <input
                    type="url"
                    value={customUrlInput}
                    onChange={(e) => setCustomUrlInput(e.target.value)}
                    placeholder="https://example.com/logo.png"
                    className="flex-1 bg-[#0E141C] border border-[#232D3B] rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-amber-400 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleApplyUrl}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg cursor-pointer transition-all"
                  >
                    Apply URL
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 2: DEVELOPER LOGIN AUTHORIZATION CREDENTIALS */}
        <div className="bg-[#0E141C] border border-[#1E2633] rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#1E2633]">
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Key size={16} className="text-amber-400" />
                <span>Developer Login Authorization Credentials</span>
              </h3>
              <p className="text-[11px] text-white/70">
                These credentials determine authorized Developer Login access to this control panel.
              </p>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Required for Dev Auth
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Developer Email */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Mail size={14} className="text-amber-400" />
                <span>Developer Email</span>
              </label>
              <input
                type="email"
                required
                value={formData.developerEmail}
                onChange={(e) => setFormData({ ...formData, developerEmail: e.target.value })}
                placeholder="zihanalam.at@gmail.com"
                className="w-full bg-[#141A23] border border-[#232D3B] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-white/50 focus:outline-none focus:border-amber-400 font-mono"
              />
              <p className="text-[11px] text-white/70">
                Authorized developer account email address for login verification.
              </p>
            </div>

            {/* Developer Code */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Key size={14} className="text-amber-400" />
                <span>Developer Code</span>
              </label>
              <input
                type="text"
                required
                value={formData.developerCode}
                onChange={(e) => setFormData({ ...formData, developerCode: e.target.value })}
                placeholder="Enter unique developer security code"
                className="w-full bg-[#141A23] border border-[#232D3B] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-white/50 focus:outline-none focus:border-amber-400 font-mono tracking-wider"
              />
              <p className="text-[11px] text-white/70">
                Special security passcode required in the Developer Login &quot;Developer Code&quot; input.
              </p>
            </div>
          </div>

          {/* Security Notice Box */}
          <div className="p-3.5 rounded-xl bg-[#141A23] border border-[#232D3B] flex items-start gap-3">
            <Lock size={16} className="text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <span className="font-semibold text-white">Firebase Authentication Security</span>
              <p className="text-white/80 text-[11px] leading-relaxed">
                Developer passwords remain securely managed by <strong>Firebase Authentication</strong> with industry-standard cryptographic hashing and are <strong>never</strong> stored in plain text in Firestore.
              </p>
            </div>
          </div>
        </div>

        {/* SECTION 3: SYSTEM GOVERNANCE & POLICY */}
        <div className="bg-[#0E141C] border border-[#1E2633] rounded-2xl p-6 space-y-5">
          <div className="pb-3 border-b border-[#1E2633]">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders size={16} className="text-amber-400" />
              <span>System Policies &amp; Agency Governance</span>
            </h3>
            <p className="text-[11px] text-white/70 mt-0.5">
              Control agency registration availability and maintenance state.
            </p>
          </div>

          <div className="space-y-4 text-xs">
            {/* Maintenance Mode */}
            <div className="p-4 rounded-xl bg-[#141A23] border border-[#232D3B] flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="font-bold text-white flex items-center gap-2">
                  <BadgeAlert size={15} className="text-amber-400" />
                  <span>System Maintenance Mode</span>
                </div>
                <p className="text-white/80 text-[11px]">
                  When active, agency portals display a maintenance notice. Developer access remains unrestricted.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={formData.maintenanceMode}
                  onChange={(e) => setFormData({ ...formData, maintenanceMode: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[#232D3B] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>

            {/* Allow New Registrations */}
            <div className="p-4 rounded-xl bg-[#141A23] border border-[#232D3B] flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="font-bold text-white flex items-center gap-2">
                  <Users size={15} className="text-emerald-400" />
                  <span>Allow New Agency Registrations</span>
                </div>
                <p className="text-white/80 text-[11px]">
                  Enable or disable new user onboarding on the public authentication view.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={formData.allowNewRegistrations}
                  onChange={(e) => setFormData({ ...formData, allowNewRegistrations: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[#232D3B] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            {/* Default License Code Prefix */}
            <div className="p-4 rounded-xl bg-[#141A23] border border-[#232D3B] space-y-2">
              <label className="font-bold text-white block">
                Default Agency License Code Prefix
              </label>
              <p className="text-white/80 text-[11px]">
                Format prefix used when auto-generating agency licenses (e.g. ZH-SNT-, AGY-, etc.)
              </p>
              <input
                type="text"
                value={formData.defaultCodePrefix}
                onChange={(e) => setFormData({ ...formData, defaultCodePrefix: e.target.value })}
                className="bg-[#0E141C] border border-[#232D3B] rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-400 w-48"
              />
            </div>

            {/* Maintenance Message */}
            <div className="p-4 rounded-xl bg-[#141A23] border border-[#232D3B] space-y-2">
              <label className="font-bold text-white block">
                System Maintenance Announcement Message
              </label>
              <textarea
                rows={2}
                value={formData.maintenanceMessage}
                onChange={(e) => setFormData({ ...formData, maintenanceMessage: e.target.value })}
                className="w-full bg-[#0E141C] border border-[#232D3B] rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>
        </div>

        {/* Action Save Bar */}
        <div className="flex items-center justify-between p-4 bg-[#0E141C] border border-[#1E2633] rounded-2xl">
          <div className="text-[11px] text-white/80">
            {formData.updatedAt && (
              <span>Last updated: <strong className="text-white font-mono">{formatTimestamp(formData.updatedAt)}</strong> by <span className="text-amber-400">{formData.updatedBy || 'Developer'}</span></span>
            )}
          </div>

          <button
            type="submit"
            disabled={configSaving || isProcessingImage}
            className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
          >
            <Save size={15} />
            <span>{configSaving ? 'Saving to Firebase...' : 'Save Configuration & Brand Logo'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
