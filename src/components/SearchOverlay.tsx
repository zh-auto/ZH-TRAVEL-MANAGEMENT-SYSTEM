/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { Trip } from '../types';
import { ALL_SEAT_IDS, capitalize } from '../utils';

interface SearchResult {
  tripId: string;
  tripRoute: string;
  seatId: string;
  name?: string;
  phone?: string;
  status: string;
}

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  trips: Record<string, Trip>;
  onResultClick: (tripId: string, seatId: string) => void;
}

export default function SearchOverlay({ isOpen, onClose, trips, onResultClick }: SearchOverlayProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 80);
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  const handleSearch = (q: string) => {
    setQuery(q);
    const cleanQuery = q.toLowerCase().trim();
    if (!cleanQuery) {
      setResults([]);
      return;
    }

    const matches: SearchResult[] = [];
    Object.values(trips).forEach(trip => {
      ALL_SEAT_IDS.forEach(seatId => {
        const s = trip.seats[seatId];
        if (!s || s.status === 'available') return;
        const hay = `${seatId} ${s.name || ''} ${s.phone || ''}`.toLowerCase();
        if (hay.includes(cleanQuery)) {
          matches.push({
            tripId: trip.id,
            tripRoute: trip.route,
            seatId,
            name: s.name,
            phone: s.phone,
            status: s.status,
          });
        }
      });
    });

    setResults(matches.slice(0, 15));
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="search-overlay open"
      id="searchOverlay"
    >
      <div className="search-box">
        <Search size={18} className="text-[#5E6B7C]" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by passenger name, phone, or seat number…"
          autoComplete="off"
        />
        <button onClick={onClose} className="icon-btn" id="searchClose">
          <X size={16} />
        </button>
      </div>

      <div className="search-results" id="searchResults" style={{ display: query ? 'block' : 'none' }}>
        {results.length > 0 ? (
          results.map((r, idx) => (
            <div
              key={`${r.tripId}-${r.seatId}-${idx}`}
              onClick={() => onResultClick(r.tripId, r.seatId)}
              className="search-result-item"
            >
              <span className="search-result-seat">{r.seatId}</span>
              <div className="search-result-info">
                <div className="search-result-name">{r.name || 'Unnamed'}</div>
                <div className="search-result-meta">
                  {r.phone || '—'} · {r.tripRoute}
                </div>
              </div>
              <span className={`status-tag ${r.status}`}>{capitalize(r.status)}</span>
            </div>
          ))
        ) : (
          <div className="search-empty">No bookings match “{query}”</div>
        )}
      </div>
    </div>
  );
}
