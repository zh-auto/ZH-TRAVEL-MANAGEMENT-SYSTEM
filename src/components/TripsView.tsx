/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Trip } from '../types';
import { seatStats, formatTaka, formatDate } from '../utils';

interface TripsViewProps {
  trips: Record<string, Trip>;
  activeTripId: string;
  onSelectTrip: (tripId: string) => void;
  onEditTrip: (tripId: string | null) => void;
  onDeleteTrip: (tripId: string) => void;
}

export default function TripsView({ trips, activeTripId, onSelectTrip, onEditTrip, onDeleteTrip }: TripsViewProps) {
  const tripList = Object.values(trips).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <section className="view" id="view-trips">
      <div className="view-head">
        <div>
          <h1>Trips</h1>
          <p className="view-sub">Manage multiple trips — each keeps its own seat data</p>
        </div>
        <button onClick={() => onEditTrip(null)} className="btn btn-primary" id="addTripBtn">
          <Plus size={16} strokeWidth={2.2} />
          New Trip
        </button>
      </div>

      <div className="trip-grid" id="tripGrid">
        {tripList.map(trip => {
          const st = seatStats(trip);
          const isActive = trip.id === activeTripId;

          return (
            <div
              key={trip.id}
              onClick={() => onSelectTrip(trip.id)}
              className={`trip-card cursor-pointer transition-all ${isActive ? 'is-active ring-2 ring-[var(--accent)] shadow-md' : 'hover:border-[var(--accent)]/50'}`}
            >
              <div className="trip-card-corner-actions" onClick={e => e.stopPropagation()}>
                {isActive && <span className="trip-card-badge">Active</span>}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteTrip(trip.id);
                  }}
                  className="trip-card-delete-btn"
                  title="Delete Trip"
                  aria-label="Delete Trip"
                >
                  <Trash2 size={13} strokeWidth={2.2} />
                </button>
              </div>
              <div className="trip-card-route">{trip.route}</div>
              <div className="trip-card-date">
                {formatDate(trip.date)}
                {trip.time ? ` · ${trip.time}` : ''}
              </div>
              <div className="trip-card-stats">
                <div className="trip-card-stat">
                  <b>
                    {st.booked}/{st.total}
                  </b>
                  <span>Booked</span>
                </div>
                <div className="trip-card-stat">
                  <b>{formatTaka(st.collected)}</b>
                  <span>Collected</span>
                </div>
              </div>
              <div className="trip-card-actions" onClick={e => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectTrip(trip.id);
                  }}
                  className={`btn small ${isActive ? 'btn-primary' : 'btn-ghost'}`}
                  data-act="select"
                >
                  {isActive ? '✓ Selected' : 'Select'}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditTrip(trip.id);
                  }}
                  className="btn btn-text small"
                  data-act="edit"
                >
                  Edit
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
