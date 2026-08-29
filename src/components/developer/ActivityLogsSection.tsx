/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Activity,
  Search,
  Filter,
  UserPlus,
  LogIn,
  Key,
  ShieldAlert,
  UserCheck,
  UserX,
  Sliders,
  Clock,
  Download,
  RefreshCw,
  Zap,
  Building2,
  Mail,
  Shield,
  Layers,
} from 'lucide-react';
import { AuditLog } from './types';

interface ActivityLogsSectionProps {
  logs: AuditLog[];
  loadingLogs: boolean;
  onRefresh: () => void;
  formatTimestamp: (ts: any) => string;
}

export default function ActivityLogsSection({
  logs,
  loadingLogs,
  onRefresh,
  formatTimestamp,
}: ActivityLogsSectionProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Categorize log badge styles & icons
  const getLogBadge = (log: AuditLog) => {
    const action = (log.action || '').toUpperCase();
    const type = (log.type || '').toUpperCase();

    if (type === 'REGISTRATION' || action.includes('REGISTRATION')) {
      return {
        label: 'REGISTRATION',
        color: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
        icon: UserPlus,
      };
    }
    if (type === 'LOGIN' || action.includes('LOGIN')) {
      return {
        label: action === 'DEVELOPER_LOGIN' ? 'DEV LOGIN' : 'USER LOGIN',
        color: action === 'DEVELOPER_LOGIN' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        icon: LogIn,
      };
    }
    if (type === 'ACCOUNT_STATUS_CHANGE' || action.includes('ACTIVATE_') || action.includes('DEACTIVATE_') || action.includes('SUSPEND_') || action.includes('STATUS')) {
      if (action.includes('ACTIVATE')) {
        return {
          label: 'ACCOUNT ACTIVATED',
          color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
          icon: UserCheck,
        };
      }
      return {
        label: 'ACCOUNT SUSPENDED',
        color: 'bg-red-500/15 text-red-400 border-red-500/30',
        icon: UserX,
      };
    }
    if (type === 'AGENCY_CODE_CHANGE' || action.includes('AGENCY_CODE') || action.includes('LICENSE')) {
      return {
        label: 'AGENCY CODE',
        color: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
        icon: Key,
      };
    }
    if (type === 'DEVELOPER_CONFIG_CHANGE' || action.includes('CONFIG')) {
      return {
        label: 'DEV CONFIG',
        color: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
        icon: Sliders,
      };
    }
    if (action.includes('PASSWORD_RESET')) {
      return {
        label: 'SECURITY RESET',
        color: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
        icon: ShieldAlert,
      };
    }
    return {
      label: action || 'ACTIVITY',
      color: 'bg-[#1C2634] text-[#A2B1C3] border-[#2C3B4E]',
      icon: Activity,
    };
  };

  // Filter logs dynamically
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const action = (log.action || '').toUpperCase();
      const type = (log.type || '').toUpperCase();

      // Type filter match
      if (typeFilter !== 'ALL') {
        if (typeFilter === 'REGISTRATION' && !(type === 'REGISTRATION' || action.includes('REGISTRATION'))) {
          return false;
        }
        if (typeFilter === 'LOGIN' && !(type === 'LOGIN' || action.includes('LOGIN'))) {
          return false;
        }
        if (typeFilter === 'STATUS' && !(type === 'ACCOUNT_STATUS_CHANGE' || action.includes('ACTIVATE_') || action.includes('DEACTIVATE_') || action.includes('SUSPEND_'))) {
          return false;
        }
        if (typeFilter === 'AGENCY_CODE' && !(type === 'AGENCY_CODE_CHANGE' || action.includes('AGENCY_CODE') || action.includes('LICENSE'))) {
          return false;
        }
        if (typeFilter === 'CONFIG' && !(type === 'DEVELOPER_CONFIG_CHANGE' || action.includes('CONFIG'))) {
          return false;
        }
        if (typeFilter === 'IMPORTANT' && !(type === 'IMPORTANT_ACTION' || action.includes('TRIP') || action.includes('SEAT') || action.includes('DELETE'))) {
          return false;
        }
      }

      // Search match
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesAction = (log.action || '').toLowerCase().includes(query);
        const matchesAgency = (log.targetAgency || '').toLowerCase().includes(query);
        const matchesEmail = (log.targetEmail || '').toLowerCase().includes(query);
        const matchesPerformer = (log.performedBy || '').toLowerCase().includes(query);
        const matchesDetails = (log.details || '').toLowerCase().includes(query);
        return matchesAction || matchesAgency || matchesEmail || matchesPerformer || matchesDetails;
      }

      return true;
    });
  }, [logs, typeFilter, searchTerm]);

  // Export logs to JSON
  const handleExportLogs = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(filteredLogs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `activity_logs_export_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="bg-[#0E141C] border border-[#1E2633] rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Activity size={18} className="text-amber-400" />
            <h3 className="text-sm font-bold text-white">User Activity &amp; System Activity Logs</h3>
            <span className="text-xs text-white/70 font-mono">({filteredLogs.length} events logged)</span>
          </div>
          <p className="text-xs text-white/80">
            Real-time event ledger tracking registrations, logins, account activations, agency code assignments, and operations.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onRefresh}
            className="p-2 rounded-xl bg-[#141A23] hover:bg-[#1A222F] text-white/80 hover:text-white border border-[#232D3B] transition-all cursor-pointer"
            title="Refresh Activity Logs"
          >
            <RefreshCw size={15} />
          </button>

          <button
            type="button"
            onClick={handleExportLogs}
            disabled={filteredLogs.length === 0}
            className="px-3.5 py-2 rounded-xl bg-[#141A23] hover:bg-[#1A222F] text-white border border-[#232D3B] text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            <Download size={14} className="text-amber-400" />
            <span>Export Logs (JSON)</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
        <div className="sm:col-span-7 relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/60" />
          <input
            type="text"
            placeholder="Search by agency name, email, action, details, or actor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#0E141C] border border-[#1E2633] rounded-xl pl-9.5 pr-4 py-2.5 text-xs text-white placeholder:text-white/50 focus:outline-none focus:border-amber-400 font-medium"
          />
        </div>

        <div className="sm:col-span-5 flex items-center gap-2">
          <Filter size={15} className="text-white/60 shrink-0 ml-1" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full bg-[#0E141C] border border-[#1E2633] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400 font-medium cursor-pointer"
          >
            <option value="ALL">All Event Types</option>
            <option value="REGISTRATION">User Registrations</option>
            <option value="LOGIN">User &amp; Dev Logins</option>
            <option value="STATUS">Account Status Changes</option>
            <option value="AGENCY_CODE">Agency Code &amp; License Changes</option>
            <option value="CONFIG">Developer Config Updates</option>
            <option value="IMPORTANT">Important Actions</option>
          </select>
        </div>
      </div>

      {/* Logs Table / Feed */}
      <div className="bg-[#0E141C] border border-[#1E2633] rounded-2xl overflow-hidden shadow-xl">
        {loadingLogs ? (
          <div className="py-20 text-center text-xs text-white/80">
            <div className="w-8 h-8 border-3 border-amber-400/30 border-t-amber-400 rounded-full animate-spin mx-auto mb-3" />
            <span>Loading live activity logs from Firebase Firestore...</span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-20 text-center text-xs text-white/80 space-y-2">
            <Activity size={28} className="mx-auto text-white/60 opacity-60" />
            <p className="text-white font-medium">No activity events found</p>
            <p className="text-[11px] text-white/60">Try clearing your search query or selecting a different event filter.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#17202C]">
            {filteredLogs.map((log) => {
              const badge = getLogBadge(log);
              const BadgeIcon = badge.icon;

              return (
                <div
                  key={log.id}
                  className="p-4 hover:bg-[#121924] transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className={`p-2 rounded-xl shrink-0 border ${badge.color}`}>
                      <BadgeIcon size={16} />
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] border ${badge.color}`}>
                          {badge.label}
                        </span>

                        {log.targetAgency && (
                          <span className="font-bold text-white flex items-center gap-1">
                            <Building2 size={12} className="text-white/70" />
                            <span>{log.targetAgency}</span>
                          </span>
                        )}

                        {log.targetEmail && (
                          <span className="text-white/80 text-[11px] font-mono truncate">
                            ({log.targetEmail})
                          </span>
                        )}
                      </div>

                      <p className="text-white/90 text-[12px] leading-relaxed">
                        {log.details}
                      </p>

                      <div className="flex items-center gap-3 text-[11px] text-white/70 flex-wrap pt-0.5">
                        <span>
                          Actor: <strong className="text-white">{log.performedBy || 'System'}</strong> {log.performedByRole && <span className="font-mono text-[10px] text-amber-400/80">({log.performedByRole})</span>}
                        </span>
                        {log.metadata?.agencyCode && (
                          <span>
                            Code: <strong className="text-amber-400 font-mono">{log.metadata.agencyCode}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center md:flex-col md:items-end justify-between md:justify-center text-[11px] font-mono text-white/70 pt-2 md:pt-0 border-t md:border-t-0 border-[#17202C]">
                    <div className="flex items-center gap-1 text-white/80">
                      <Clock size={12} className="text-amber-400/60" />
                      <span>{formatTimestamp(log.timestamp)}</span>
                    </div>
                    <span className="text-[10px] text-white/50">Firebase Timestamp</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
