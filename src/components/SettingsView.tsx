/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Send, Shuffle, Settings as SettingsIcon, Printer, Heart, Users } from 'lucide-react';
import { Settings, AuthUser } from '../types';

interface SettingsViewProps {
  settings: Settings;
  onSaveSettings: (updatedSettings: Settings) => void;
  onShowToast: (msg: string, isError?: boolean) => void;
  currentUser?: AuthUser | null;
}

export default function SettingsView({ settings, onSaveSettings, onShowToast, currentUser }: SettingsViewProps) {
  const [busName, setBusName] = useState(settings.busName || '');
  const [heading, setHeading] = useState(settings.heading || '');
  const [route, setRoute] = useState(settings.route || '');
  const [date, setDate] = useState(settings.date || '');
  const [time, setTime] = useState(settings.time || '');
  const [theme, setTheme] = useState(settings.theme || 'dark');
  const [logo, setLogo] = useState<string | null>(settings.logo || null);
  const [devLine, setDevLine] = useState(settings.devLine || '');
  const [ticketHeader, setTicketHeader] = useState(settings.ticketHeader || '');
  const [ticketFooter, setTicketFooter] = useState(settings.ticketFooter || '');
  
  const [printWidthOption, setPrintWidthOption] = useState<'58' | '80' | 'custom'>(
    settings.printWidthMm === 58 ? '58' : settings.printWidthMm === 80 ? '80' : 'custom'
  );
  const [customWidthMm, setCustomWidthMm] = useState<number>(
    settings.printWidthMm !== 58 && settings.printWidthMm !== 80 ? settings.printWidthMm : 72
  );

  const [savedVisible, setSavedVisible] = useState(false);

  // Sync internal state when external settings props change from Firestore or parent state
  useEffect(() => {
    if (settings.busName) setBusName(settings.busName);
    if (settings.heading !== undefined) setHeading(settings.heading);
    if (settings.route !== undefined) setRoute(settings.route);
    if (settings.date !== undefined) setDate(settings.date);
    if (settings.time !== undefined) setTime(settings.time);
    if (settings.theme !== undefined) setTheme(settings.theme);
    if (settings.logo !== undefined) setLogo(settings.logo);
    if (settings.devLine !== undefined) setDevLine(settings.devLine);
    if (settings.ticketHeader !== undefined) setTicketHeader(settings.ticketHeader);
    if (settings.ticketFooter !== undefined) setTicketFooter(settings.ticketFooter);
    if (settings.printWidthMm) {
      setPrintWidthOption(settings.printWidthMm === 58 ? '58' : settings.printWidthMm === 80 ? '80' : 'custom');
      if (settings.printWidthMm !== 58 && settings.printWidthMm !== 80) {
        setCustomWidthMm(settings.printWidthMm);
      }
    }
  }, [
    settings.busName,
    settings.heading,
    settings.route,
    settings.date,
    settings.time,
    settings.theme,
    settings.logo,
    settings.devLine,
    settings.ticketHeader,
    settings.ticketFooter,
    settings.printWidthMm,
  ]);

  // Apply theme change locally to documentElement
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      onShowToast('Image too large — please use under 2MB', true);
      return;
    }

    const reader = new FileReader();
    reader.onload = ev => {
      setLogo(ev.target?.result as string);
      onShowToast('Logo uploaded');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogo(null);
    onShowToast('Logo removed');
  };

  const handleSave = () => {
    const printWidthMm =
      printWidthOption === 'custom'
        ? Math.max(40, Math.min(120, customWidthMm))
        : Number(printWidthOption);

    const updated: Settings = {
      busName: busName.trim() || 'ZH Travel Management',
      heading: heading.trim(),
      route: route.trim(),
      date,
      time,
      theme,
      logo,
      devLine: devLine.trim() || 'ZIHAN | +8801830343515',
      ticketHeader: ticketHeader.trim(),
      ticketFooter: ticketFooter.trim() || 'Thank you for travelling with us',
      printWidthMm,
    };

    onSaveSettings(updated);
    setSavedVisible(true);
    setTimeout(() => setSavedVisible(false), 2000);
    onShowToast('Settings saved');
  };

  const currentPreviewWidthMm = printWidthOption === 'custom' ? customWidthMm : Number(printWidthOption);
  const pxWidth = Math.max(160, Math.min(420, Math.round(currentPreviewWidthMm * 3.78)));

  return (
    <section className="view" id="view-settings">
      <div className="view-head">
        <div>
          <h1>Settings</h1>
          <p className="view-sub">Bus identity, route defaults and appearance</p>
        </div>
      </div>

      <div className="settings-grid">
        <div className="panel settings-panel">
          <div className="panel-head with-icon">
            <div className="flex items-center gap-2.5">
              <div className="panel-head-icon">
                <SettingsIcon size={16} />
              </div>
              <div className="panel-head-titles">
                <h3>Bus Identity</h3>
                <span className="panel-head-sub">Shown on the topbar &amp; tickets</span>
              </div>
            </div>
          </div>
          <div className="form-group">
            <label>Bus / Company Name</label>
            <input
              type="text"
              className="text-input"
              value={busName}
              onChange={(e) => setBusName(e.target.value)}
              placeholder="e.g. Green Express"
            />
          </div>
          <div className="form-group">
            <label>Custom Heading</label>
            <input
              type="text"
              className="text-input"
              value={heading}
              onChange={(e) => setHeading(e.target.value)}
              placeholder="e.g. Dhaka Counter — Saidabad"
            />
          </div>
          <div className="form-group">
            <label>Bus Logo / Image</label>
            <div className="logo-upload-row">
              <div className="logo-preview" id="logoPreview">
                {logo ? <img src={logo} alt="Logo" /> : 'No logo'}
              </div>
              <div className="flex items-center gap-2">
                <label className="btn btn-ghost file-btn small cursor-pointer">
                  Upload Image
                  <input type="file" onChange={handleLogoUpload} accept="image/*" hidden />
                </label>
                {logo && (
                  <button onClick={handleRemoveLogo} className="btn btn-text small" id="removeLogoBtn">
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {currentUser && (
          <div className="panel settings-panel border border-[#10B981]/20">
            <div className="panel-head with-icon">
              <div className="flex items-center gap-2.5">
                <div className="panel-head-icon bg-[#10B981]/10 text-[#10B981]">
                  <Users size={16} />
                </div>
                <div className="panel-head-titles">
                  <h3 className="text-[#10B981]">Agency Account Details</h3>
                  <span className="panel-head-sub">Registered profile details</span>
                </div>
              </div>
            </div>
            
            <div className="form-group">
              <label className="text-[#9AA8B8]">Registered Email Address</label>
              <div className="relative">
                <input
                  type="text"
                  className="text-input bg-[#0B0F14]/50 text-[#5E6B7C] border-[#252F3D] cursor-not-allowed select-all"
                  value={currentUser.email || ''}
                  disabled
                  readOnly
                />
                <span className="absolute right-3 top-3 text-[10px] uppercase font-bold text-[#5E6B7C] tracking-wider select-none">
                  Read Only
                </span>
              </div>
              <p className="text-[11px] text-[#5E6B7C] mt-1">Your official registered email cannot be edited.</p>
            </div>

            <div className="form-group">
              <label className="text-[#9AA8B8]">Account Status</label>
              <div className="flex items-center gap-2 mt-1">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold font-mono tracking-wider ${
                  (currentUser.status === 'Active' || currentUser.isApproved || currentUser.accountStatus === true)
                    ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30'
                    : (currentUser.status === 'Suspended' || currentUser.status === 'DEACTIVE' || currentUser.accountStatus === false)
                    ? 'bg-red-500/20 text-red-500 border border-red-500/30'
                    : 'bg-amber-500/20 text-amber-500 border border-amber-500/30'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    (currentUser.status === 'Active' || currentUser.isApproved || currentUser.accountStatus === true) ? 'bg-emerald-500' : 'bg-amber-500'
                  }`} />
                  {(currentUser.status === 'Active' || currentUser.isApproved || currentUser.accountStatus === true) ? 'true : Active' : (currentUser.accountStatus === false ? 'false : Suspended' : 'Pending')}
                </span>
                <span className="text-[11px] text-[#5E6B7C]">Managed by Developer</span>
              </div>
            </div>

            <div className="form-group">
              <label className="text-[#9AA8B8]">Assigned Agency Code</label>
              <div className="relative">
                <input
                  type="text"
                  className="text-input bg-[#0B0F14]/50 text-[#10B981] border-[#10B981]/20 font-mono font-bold cursor-not-allowed select-all"
                  value={currentUser.agencyCode || currentUser.loginId || ''}
                  disabled
                  readOnly
                />
                <span className="absolute right-3 top-3 text-[10px] uppercase font-bold text-[#10B981]/60 tracking-wider select-none">
                  Locked
                </span>
              </div>
              <p className="text-[11px] text-[#5E6B7C] mt-1">Assigned by the developer and cannot be modified.</p>
            </div>
          </div>
        )}

        <div className="panel settings-panel">
          <div className="panel-head with-icon">
            <div className="flex items-center gap-2.5">
              <div className="panel-head-icon">
                <Shuffle size={16} />
              </div>
              <div className="panel-head-titles">
                <h3>Default Route &amp; Trip</h3>
                <span className="panel-head-sub">Used when creating a new trip</span>
              </div>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group w-full">
              <label>Default Route</label>
              <input
                type="text"
                className="text-input"
                value={route}
                onChange={(e) => setRoute(e.target.value)}
                placeholder="e.g. Dhaka → Noakhali"
              />
            </div>
          </div>
          <div className="form-row two-col">
            <div className="form-group">
              <label>Trip Date</label>
              <input
                type="date"
                className="text-input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Trip Time</label>
              <input
                type="time"
                className="text-input"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="panel settings-panel">
          <div className="panel-head with-icon">
            <div className="flex items-center gap-2.5">
              <div className="panel-head-icon">
                <Heart size={16} />
              </div>
              <div className="panel-head-titles">
                <h3>Appearance</h3>
                <span className="panel-head-sub">App theme for this device</span>
              </div>
            </div>
          </div>
          <div className="theme-switch-row">
            <div>
              <span className="theme-switch-label">Dark Mode</span>
              <span className="theme-switch-sub">Default for counter operations</span>
            </div>
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="toggle-switch"
              role="switch"
              aria-checked={theme === 'dark'}
            >
              <span
                className="toggle-knob"
                style={{ left: theme === 'dark' ? '3px' : '22px' }}
              />
            </button>
          </div>
        </div>

        <div className="panel settings-panel">
          <div className="panel-head with-icon">
            <div className="flex items-center gap-2.5">
              <div className="panel-head-icon">
                <Send size={16} />
              </div>
              <div className="panel-head-titles">
                <h3>Ticket Content</h3>
                <span className="panel-head-sub">Editable text printed on every ticket</span>
              </div>
            </div>
          </div>
          <div className="form-group">
            <label>Ticket Header Text</label>
            <input
              type="text"
              className="text-input"
              value={ticketHeader}
              onChange={(e) => setTicketHeader(e.target.value)}
              placeholder="e.g. ELECTRONIC TICKET — KEEP SAFE"
            />
            <span className="hint">Optional line shown under the bus name at the top of the ticket.</span>
          </div>
          <div className="form-group">
            <label>Ticket Footer Message</label>
            <textarea
              className="text-input"
              value={ticketFooter}
              onChange={(e) => setTicketFooter(e.target.value)}
              rows={2}
              placeholder="e.g. THANK YOU FOR TRAVELING WITH US"
            />
            <span className="hint">Shown at the bottom of every printed ticket. Use a new line for each line of text.</span>
          </div>
          <div className="form-group">
            <label>Developer / Support Line</label>
            <input
              type="text"
              className="text-input"
              value={devLine}
              onChange={(e) => setDevLine(e.target.value)}
              placeholder="ZIHAN | +8801830343515"
            />
            <span className="hint">Small line shown beside the bus name on the ticket header.</span>
          </div>
        </div>

        <div className="panel settings-panel" style={{ gridColumn: '1 / -1' }}>
          <div className="panel-head with-icon">
            <div className="flex items-center gap-2.5">
              <div className="panel-head-icon">
                <Printer size={16} />
              </div>
              <div className="panel-head-titles">
                <h3>Printer Format</h3>
                <span className="panel-head-sub">Match your thermal POS printer's paper size</span>
              </div>
            </div>
          </div>
          <div className="form-group">
            <label>Paper Width</label>
            <div className="printer-size-grid" id="printerSizeGrid">
              <div
                onClick={() => setPrintWidthOption('58')}
                className={`printer-size-opt ${printWidthOption === '58' ? 'active' : ''}`}
                data-width="58"
              >
                <b>58mm</b>
                <span>Small thermal</span>
              </div>
              <div
                onClick={() => setPrintWidthOption('80')}
                className={`printer-size-opt ${printWidthOption === '80' ? 'active' : ''}`}
                data-width="80"
              >
                <b>80mm</b>
                <span>Standard thermal</span>
              </div>
              <div
                onClick={() => setPrintWidthOption('custom')}
                className={`printer-size-opt ${printWidthOption === 'custom' ? 'active' : ''}`}
                data-width="custom"
              >
                <b>Custom</b>
                <span>Set manually</span>
              </div>
            </div>
          </div>

          {printWidthOption === 'custom' && (
            <div className="form-row two-col" id="customWidthRow">
              <div className="form-group">
                <label>Custom Width (mm)</label>
                <input
                  type="number"
                  min="40"
                  max="120"
                  className="text-input"
                  value={customWidthMm}
                  onChange={(e) => setCustomWidthMm(Number(e.target.value) || 72)}
                  placeholder="e.g. 72"
                />
              </div>
              <div className="form-group">
                <label>&nbsp;</label>
                <span className="hint" style={{ marginTop: '10px' }}>
                  Most counter thermal printers use 58mm or 80mm rolls. Only change this if your printer uses a
                  different size.
                </span>
              </div>
            </div>
          )}

          <div className="ticket-preview-wrap" id="ticketSizePreviewWrap">
            <div
              className="ticket"
              id="ticketSizePreview"
              style={{
                width: `${pxWidth}px`,
                transform: 'scale(.85)',
                transformOrigin: 'top',
              }}
            >
              <div className="ticket-head">
                <div>
                  <div className="ticket-bus-name">Preview</div>
                  <div className="ticket-dev-line">Live ticket width preview</div>
                </div>
              </div>
              <div className="ticket-divider" />
              <div className="ticket-row">
                <span>Seat</span>
                <b>A1</b>
              </div>
              <div className="ticket-row">
                <span>Passenger</span>
                <b>Sample Name</b>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="settings-save-bar">
        <button onClick={handleSave} className="btn btn-primary" id="saveSettingsBtn">
          Save Settings
        </button>
        <span className={`save-confirm ${savedVisible ? 'show' : ''}`} id="saveConfirm">
          Saved
        </span>
      </div>

      <div className="mt-8 pt-4 pb-2 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-between text-xs text-[var(--text-muted)] gap-2">
        <div className="flex items-center gap-2">
          <span>ZH Travel Management System</span>
          <span>•</span>
          <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-[var(--panel-2)] border border-[var(--border)] text-[var(--text-dim)]">v1.9.26</span>
        </div>
        <div className="text-[11px] font-mono opacity-80">
          Release 2026.1
        </div>
      </div>
    </section>
  );
}
