/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Clock, ShieldAlert, LogOut, MessageSquare } from 'lucide-react';
import { AuthUser } from '../types';

interface WaitingApprovalProps {
  currentUser: AuthUser | null;
  onLogout: () => void;
}

export default function WaitingApproval({ currentUser, onLogout }: WaitingApprovalProps) {
  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-[var(--bg)]">
      <div className="w-full max-w-md p-8 bg-[var(--bg-elev)] border border-[var(--border)] rounded-2xl shadow-2xl relative text-center overflow-hidden">
        
        {/* Glow effect */}
        <div className="absolute top-[-50%] right-[-50%] w-96 h-96 rounded-full bg-radial from-[rgba(245,165,36,0.08)] to-transparent pointer-events-none" />

        <div className="flex flex-col items-center mb-6 relative z-10">
          <div className="flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-gradient-to-br from-[#F5A524]/20 to-transparent border border-[#F5A524]/30 text-[#F5A524] animate-pulse">
            <Clock size={32} />
          </div>
          <span className="px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider rounded-full bg-[#F5A524]/10 text-[#F5A524] border border-[#F5A524]/20 mb-3">
            Awaiting Approval
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--text)] font-display">
            Account Under Review
          </h1>
          <p className="mt-3 text-sm text-[var(--text-dim)] leading-relaxed">
            Hi, <strong className="text-[var(--text)]">{currentUser?.displayName || currentUser?.email}</strong>. Your account has been registered successfully, but must be approved by an administrator before you can access the counter management console.
          </p>
        </div>

        <div className="p-4 mb-6 text-left rounded-xl bg-[var(--panel-2)] border border-[var(--border)] space-y-2 relative z-10">
          <div className="flex items-start gap-2.5">
            <ShieldAlert size={16} className="text-[#F5A524] mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-bold text-[var(--text)]">Why am I seeing this?</p>
              <p className="text-[11px] text-[var(--text-dim)] mt-0.5 leading-normal">
                To prevent unauthorized ticket modification and billing manipulation, all counter operator accounts must be manually authorized by the systems administrator.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3 relative z-10">
          {/* Support action link */}
          <a
            href="mailto:zihanalam.at@gmail.com?subject=Counter%20Pro%20Operator%20Approval"
            className="w-full btn btn-primary flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all"
          >
            <MessageSquare size={18} />
            <span>Contact Administrator</span>
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
          <span>Registered Email: {currentUser?.email}</span>
        </div>
      </div>
    </div>
  );
}
