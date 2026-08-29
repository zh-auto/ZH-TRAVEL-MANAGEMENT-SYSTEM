/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  LayoutGrid,
  Users,
  CalendarDays,
  BarChart3,
  Database,
  ShieldCheck,
  Settings as SettingsIcon,
  LogOut,
} from 'lucide-react';
import { Trip, AuthUser } from '../types';
import { formatDate } from '../utils';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  activeTrip: Trip | undefined;
  onLogout: () => void;
  sidebarOpen: boolean;
  onCloseSidebar: () => void;
  currentUser?: AuthUser | null;
}

export default function Sidebar({
  currentView,
  onViewChange,
  activeTrip,
  onLogout,
  sidebarOpen,
  onCloseSidebar,
  currentUser,
}: SidebarProps) {
  const mainNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
    { id: 'passengers', label: 'Passengers', icon: Users },
  ];

  const manageNavItems = [
    { id: 'trips', label: 'Trips', icon: CalendarDays },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'backup', label: 'Backup & Restore', icon: Database },
  ];

  const systemNavItems = [
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <>
      <nav className={`sidebar ${sidebarOpen ? 'open' : ''}`} id="sidebar">
        <div className="sidebar-section">
          <span className="sidebar-label">Main</span>
          {mainNavItems.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`nav-item ${currentView === item.id ? 'active' : ''}`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="sidebar-section">
          <span className="sidebar-label">Manage</span>
          {manageNavItems.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`nav-item ${currentView === item.id ? 'active' : ''}`}
              >
                <Icon size={18} />
                <span className="flex-1 text-left">{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="sidebar-section">
          <span className="sidebar-label">System</span>
          {systemNavItems.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`nav-item ${currentView === item.id ? 'active' : ''}`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="sidebar-section">
          <span className="sidebar-label">Session</span>
          <button
            onClick={onLogout}
            className="nav-item hover:bg-red-500/10 hover:text-red-400 text-red-500/80 transition-all font-semibold"
            style={{ color: 'var(--red)' }}
          >
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>

        <div className="sidebar-footer">
          {activeTrip && (
            <div
              onClick={() => onViewChange('trips')}
              className="sidebar-trip-mini"
              id="sidebarTripMini"
            >
              <span className="mini-label">Active Trip</span>
              <span className="mini-route" id="miniRoute">
                {activeTrip.route}
              </span>
              <span className="mini-date" id="miniDate">
                {formatDate(activeTrip.date)}
                {activeTrip.time ? ` · ${activeTrip.time}` : ''}
              </span>
            </div>
          )}
        </div>
      </nav>

      <div
        onClick={onCloseSidebar}
        className={`sidebar-backdrop ${sidebarOpen ? 'open' : ''}`}
        id="sidebarBackdrop"
      />
    </>
  );
}
