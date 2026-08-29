import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Terminal, Sparkles, ShieldCheck, Cpu } from 'lucide-react';
import { AuthUser } from '../../types';
import { ZH_OFFICIAL_LOGO } from '../../assets/logo';

interface DeveloperWelcomeSplashProps {
  user: AuthUser;
  onComplete: () => void;
  logoSrc?: string;
}

export default function DeveloperWelcomeSplash({ user, onComplete, logoSrc }: DeveloperWelcomeSplashProps) {
  const [phaseIndex, setPhaseIndex] = useState(0);

  const statusPhases = [
    'AUTHENTICATING ROOT CREDENTIALS...',
    'VERIFYING SYSTEM GOVERNANCE PRIVILEGES...',
    'MOUNTING DEVELOPER CONTROL PANEL...',
  ];

  useEffect(() => {
    const t1 = setTimeout(() => setPhaseIndex(1), 1000);
    const t2 = setTimeout(() => setPhaseIndex(2), 2000);
    const tEnd = setTimeout(() => {
      onComplete();
    }, 3000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(tEnd);
    };
  }, [onComplete]);

  return (
    <motion.div
      key="developer-welcome-splash"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#070A0E] text-[#F3F6F9] overflow-hidden select-none px-6"
    >
      {/* Ambient background illumination */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.09)_0%,rgba(7,10,14,0.95)_70%)] pointer-events-none" />
      
      {/* Decorative top & bottom hairline borders with animation */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent"
      />
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent"
      />

      {/* Center Console Container */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-2xl w-full">
        
        {/* Animated Badge & ZH Logo */}
        <motion.div
          initial={{ scale: 0.7, opacity: 0, y: -10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative mb-6"
        >
          <div className="relative w-20 h-20 rounded-2xl bg-white border border-white/40 flex items-center justify-center shadow-[0_0_50px_rgba(255,255,255,0.25)] p-2.5 overflow-hidden">
            <img
              src={logoSrc || ZH_OFFICIAL_LOGO}
              alt="System Brand Logo"
              className="w-full h-full object-contain filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = ZH_OFFICIAL_LOGO;
              }}
              referrerPolicy="no-referrer"
            />
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
              className="absolute -inset-1 rounded-2xl border border-amber-500/20 border-dashed pointer-events-none"
            />
          </div>
        </motion.div>

        {/* Security & Access Tag */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-mono font-semibold tracking-wider uppercase mb-5"
        >
          <ShieldCheck size={14} className="text-amber-400" />
          <span>DEVELOPER AUTHORIZATION GRANTED</span>
        </motion.div>

        {/* Main Typography Display: "WELCOME TO DEVELOPER CONTROL PANEL" */}
        <div className="space-y-2">
          <motion.div
            initial={{ opacity: 0, y: 15, letterSpacing: '0.1em' }}
            animate={{ opacity: 1, y: 0, letterSpacing: '0.25em' }}
            transition={{ duration: 0.8, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="text-xs sm:text-sm md:text-base font-mono uppercase text-white font-bold"
          >
            WELCOME TO
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, scale: 0.92, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.85, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="text-2xl sm:text-4xl md:text-5xl font-black text-white uppercase tracking-wider font-display drop-shadow-[0_2px_20px_rgba(255,255,255,0.25)] leading-tight"
          >
            DEVELOPER CONTROL PANEL
          </motion.h1>
        </div>

        {/* Dynamic Status Progress Text */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="mt-6 flex items-center justify-center gap-2 text-xs font-mono text-white/80"
        >
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <motion.span
            key={phaseIndex}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3 }}
            className="tracking-wider"
          >
            {statusPhases[phaseIndex]}
          </motion.span>
        </motion.div>

        {/* 3-Second Precision Animated Progress Bar */}
        <div className="mt-7 w-64 sm:w-80 h-1 bg-[#151C26] rounded-full overflow-hidden border border-[#232D3B] relative shadow-inner">
          <motion.div
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 3.0, ease: 'easeInOut' }}
            className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300 rounded-full shadow-[0_0_15px_rgba(245,158,11,0.6)]"
          />
        </div>

        {/* User Identity Note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.9 }}
          transition={{ duration: 0.5, delay: 0.9 }}
          className="mt-4 text-[11px] font-mono text-white/70"
        >
          SESSION ID: <span className="text-white font-medium">{user.email}</span>
        </motion.p>
      </div>
    </motion.div>
  );
}
