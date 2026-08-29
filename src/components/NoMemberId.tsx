/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserX, ShieldAlert, LogOut, Phone } from 'lucide-react';
import { AuthUser } from '../types';

interface NoMemberIdProps {
  currentUser: AuthUser | null;
  onLogout: () => void;
}

export default function NoMemberId({ currentUser, onLogout }: NoMemberIdProps) {
  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-[var(--bg)]">
      <div className="w-full max-w-md p-8 bg-[var(--bg-elev)] border border-[var(--border)] rounded-2xl shadow-2xl relative text-center overflow-hidden">
        
        {/* Glow effect */}
        <div className="absolute top-[-50%] right-[-50%] w-96 h-96 rounded-full bg-radial from-[rgba(59,130,246,0.12)] to-transparent pointer-events-none" />

        <div className="flex flex-col items-center mb-6 relative z-10">
          <div className="flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-gradient-to-br from-[#3B82F6]/20 to-transparent border border-[#3B82F6]/30 text-[#3B82F6]">
            <UserX size={32} />
          </div>
          <span className="px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider rounded-full bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/20 mb-3">
            Setup Required
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--text)] font-display">
            Member ID Not Assigned
          </h1>
          <p className="mt-3 text-sm text-[var(--text-dim)] leading-relaxed">
            Hi, <strong className="text-[var(--text)]">{currentUser?.displayName || currentUser?.email}</strong>. Your account has been approved, but your <strong className="text-[var(--text)]">Counter Operator Member ID</strong> has not been assigned yet.
          </p>
        </div>

        <div className="p-4 mb-6 text-left rounded-xl bg-[var(--panel-2)] border border-[var(--border)] space-y-2 relative z-10">
          <div className="flex items-start gap-2.5">
            <ShieldAlert size={16} className="text-[#3B82F6] mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-bold text-[var(--text)]">What does this mean?</p>
              <p className="text-[11px] text-[var(--text-dim)] mt-0.5 leading-normal">
                Counter bookings require an active Member/Counter ID to trace transactions and keep audits secure. An administrator needs to link your user profile to a verified operator badge.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3 relative z-10">
          {/* Action Link to call support */}
          <a
            href="tel:+8801830343515"
            className="w-full btn btn-primary flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all bg-[#3B82F6] hover:bg-[#2563EB]"
          >
            <Phone size={18} />
            <span>Call System Admin</span>
          </a>

          {/* Logout option to switch accounts */}
          <button
            type="button"
            onClick={onLogout}
            className="w-full btn btn-ghost flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all text-[var(--text-dim)] border border-[var(--border)] hover:bg-[var(--panel-2)]"
          >
            <LogOut size={18} />
            <span>Sign Out / Switch Account</span>
          </button>
        </div>

        <div className="mt-8 text-[11px] text-[var(--text-faint)]">
          <span>Email ID: {currentUser?.email}</span>
        </div>
      </div>
    </div>
  );
}
