/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Moon, Sun, Search, Menu, ChevronRight } from 'lucide-react';
import { Settings, Trip } from '../types';
import { formatDateShort } from '../utils';
import { ZH_OFFICIAL_LOGO } from '../assets/logo';

interface TopbarProps {
  settings: Settings;
  activeTrip: Trip | undefined;
  onMenuToggle: () => void;
  onSearchOpen: () => void;
  onThemeToggle: () => void;
  onTripsViewGoto: () => void;
}

export default function Topbar({
  settings,
  activeTrip,
  onMenuToggle,
  onSearchOpen,
  onThemeToggle,
  onTripsViewGoto,
}: TopbarProps) {
  const logoSrc = settings.logo && settings.logo.trim() !== '' ? settings.logo : ZH_OFFICIAL_LOGO;

  return (
    <header className="topbar">
      <button
        onClick={onMenuToggle}
        className="icon-btn sidebar-toggle"
        id="sidebarToggle"
        aria-label="Toggle menu"
      >
        <Menu size={20} />
      </button>

      <div className="brand">
        <div className="brand-logo" id="brandLogo">
          <img
            id="brandLogoImg"
            src={logoSrc}
            alt="ZH Logo"
            className="w-full h-full object-contain p-0.5"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = ZH_OFFICIAL_LOGO;
            }}
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="brand-text">
          <span className="brand-name" id="busNameDisplay">
            {settings.busName || 'Counter Pro'}
          </span>
          <span className="brand-tag">ZH TRAVEL MANAGEMENT SYSTEM</span>
        </div>
      </div>

      <div className="flex-grow" />

      {activeTrip && (
        <button
          onClick={onTripsViewGoto}
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-elev)] hover:bg-[var(--panel-2)] border border-[var(--border)] hover:border-[var(--accent)] text-[var(--text)] transition-all cursor-pointer mr-1.5 select-none"
          id="tripPillBtn"
          title="Change Active Trip"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse flex-shrink-0" />
            <span className="text-xs font-semibold tracking-tight text-[var(--text-dim)] truncate max-w-[150px]" id="tripPillRoute">
              {activeTrip.route}
            </span>
          </div>
          <span className="text-[10px] bg-[#10B981]/10 text-[#10B981] font-mono font-bold px-1.5 py-0.5 rounded-md flex-shrink-0" id="tripPillDate">
            {formatDateShort(activeTrip.date)}
          </span>
        </button>
      )}

      <div className="topbar-actions">
        <button
          onClick={onSearchOpen}
          className="icon-btn"
          id="searchToggle"
          aria-label="Search"
          title="Search"
        >
          <Search size={18} />
        </button>
        <button
          onClick={onThemeToggle}
          className="icon-btn"
          id="themeToggle"
          aria-label="Toggle theme"
          title="Toggle theme"
        >
          {settings.theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
      </div>
    </header>
  );
}
