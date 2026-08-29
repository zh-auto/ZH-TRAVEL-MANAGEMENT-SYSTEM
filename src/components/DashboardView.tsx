/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Plus } from 'lucide-react';
import { Settings, Trip } from '../types';
import { SEAT_LAYOUT, ALL_SEAT_IDS, seatStats, formatTaka, formatDate, capitalize } from '../utils';

interface DashboardViewProps {
  settings: Settings;
  trip: Trip;
  onBookSeatClick: (seatId: string) => void;
  onViewChange: (view: string) => void;
}

export default function DashboardView({ settings, trip, onBookSeatClick, onViewChange }: DashboardViewProps) {
  const st = seatStats(trip);
  const fillPct = Math.round((st.booked / st.total) * 100);

  // Recent bookings sorted by updatedAt desc
  const recentBookings = ALL_SEAT_IDS
    .map(id => {
      const s = trip.seats[id];
      if (s && (s.status === 'booked' || s.status === 'reserved')) {
        return {
          id,
          name: s.name || '',
          phone: s.phone || '',
          fee: s.fee || 0,
          status: s.status,
          updatedAt: s.updatedAt || 0,
        };
      }
      return null;
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 6);

  // Safe split values for dashboard collection metrics
  let paidAmt = 0, advAmt = 0, dueAmt = 0;
  ALL_SEAT_IDS.forEach(id => {
    const s = trip.seats[id];
    if (s && (s.status === 'booked' || s.status === 'reserved')) {
      const amt = Number(s.fee) || 0;
      if (s.payment === 'paid') paidAmt += amt;
      else if (s.payment === 'advance') advAmt += amt;
      else if (s.payment === 'due') dueAmt += amt;
    }
  });

  return (
    <section className="view active" id="view-dashboard">
      <div className="view-head">
        <div>
          <h1>Dashboard</h1>
          <p className="view-sub" id="dashSub">
            {trip.route} · {formatDate(trip.date)}
            {trip.time ? ` · ${trip.time}` : ''}
          </p>
        </div>
        <button
          onClick={() => {
            const firstAvailable = ALL_SEAT_IDS.find(id => !trip.seats[id] || trip.seats[id].status === 'available');
            if (firstAvailable) {
              onBookSeatClick(firstAvailable);
            }
          }}
          className="btn btn-primary"
          id="dashBookBtn"
        >
          <Plus size={16} strokeWidth={2.2} />
          Book a Seat
        </button>
      </div>

      <div className="stat-grid" id="statGrid">
        <div className="stat-card">
          <div className="stat-card-label">Total Seats</div>
          <div className="stat-card-value">{st.total}</div>
          <div className="stat-card-sub">Full capacity</div>
        </div>
        <div className="stat-card accent-green">
          <div className="stat-card-label">Booked</div>
          <div className="stat-card-value">{st.booked}</div>
          <div className="stat-card-sub">{fillPct}% of bus</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Available</div>
          <div className="stat-card-value">{st.available}</div>
          <div className="stat-card-sub">Open seats</div>
        </div>
        <div className="stat-card accent-amber">
          <div className="stat-card-label">Reserved</div>
          <div className="stat-card-value">{st.reserved}</div>
          <div className="stat-card-sub">Held seats</div>
        </div>
        <div className="stat-card accent-red">
          <div className="stat-card-label">Cancelled</div>
          <div className="stat-card-value">{st.cancelled}</div>
          <div className="stat-card-sub">Released seats</div>
        </div>
        <div className="stat-card accent-green">
          <div className="stat-card-label">Paid</div>
          <div className="stat-card-value">{st.paidCount}</div>
          <div className="stat-card-sub">Tickets paid</div>
        </div>
        <div className="stat-card accent-amber">
          <div className="stat-card-label">Advance</div>
          <div className="stat-card-value">{st.advCount}</div>
          <div className="stat-card-sub">Partial payment</div>
        </div>
        <div className="stat-card accent-red">
          <div className="stat-card-label">Due</div>
          <div className="stat-card-value">{st.dueCount}</div>
          <div className="stat-card-sub">Unpaid tickets</div>
        </div>
      </div>

      <div className="panel seatmap-panel">
        <div className="panel-head seatmap-panel-head">
          <h3>Seat Map</h3>
          <span className="seat-stat-pill">
            <span id="seatHeadCount">{st.booked}/{st.total} booked</span>
          </span>
        </div>
        <div className="seatmap-layout">
          <div className="bus-frame-wrap">
            <div className="bus-frame">
              <div className="bus-frame-titlebar">Seat Plan</div>
              <div className="bus-grid" id="busGrid">
                {SEAT_LAYOUT.map((row, rowIdx) => {
                  const isBackRow = row.length === 5;
                  return (
                    <div
                      key={rowIdx}
                      className={`seat-row ${isBackRow ? 'seat-row-back' : ''}`}
                    >
                      {isBackRow ? (
                        <div className="seat-pair seat-pair-wide">
                          {row.map(seatId => {
                            const s = trip.seats[seatId] || { status: 'available' };
                            return (
                              <button
                                key={seatId}
                                type="button"
                                onClick={() => onBookSeatClick(seatId)}
                                className={`seat ${s.status}`}
                                data-seat={seatId}
                              >
                                {seatId}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <>
                          <div className="seat-pair">
                            {row.slice(0, 2).map(seatId => {
                              const s = trip.seats[seatId] || { status: 'available' };
                              return (
                                <button
                                  key={seatId}
                                  type="button"
                                  onClick={() => onBookSeatClick(seatId)}
                                  className={`seat ${s.status}`}
                                  data-seat={seatId}
                                >
                                  {seatId}
                                </button>
                              );
                            })}
                          </div>
                          <div className="seat-aisle-gap" />
                          <div className="seat-pair">
                            {row.slice(2, 4).map(seatId => {
                              const s = trip.seats[seatId] || { status: 'available' };
                              return (
                                <button
                                  key={seatId}
                                  type="button"
                                  onClick={() => onBookSeatClick(seatId)}
                                  className={`seat ${s.status}`}
                                  data-seat={seatId}
                                >
                                  {seatId}
                                </button>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="seat-legend-panel">
            <h3>Legend</h3>
            <div className="seat-legend-list">
              <div className="seat-legend-row">
                <span className="seat-chip available">A1</span>Available
              </div>
              <div className="seat-legend-row">
                <span className="seat-chip booked">A1</span>Booked
              </div>
              <div className="seat-legend-row">
                <span className="seat-chip reserved">A1</span>Reserved
              </div>
              <div className="seat-legend-row">
                <span className="seat-chip cancelled">A1</span>Cancelled
              </div>
            </div>
            <div className="seat-legend-hint">
              <strong>Tip</strong>
              <p>Click any seat to book, edit, print a ticket, or release it.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="dash-cols">
        <div className="panel">
          <div className="panel-head">
            <h3>Fill-up Progress</h3>
            <span className="panel-head-meta" id="fillPercentLabel">{fillPct}%</span>
          </div>
          <div className="fill-bar-track">
            <div
              className="fill-bar-fill"
              id="fillBarFill"
              style={{ width: `${fillPct}%` }}
            />
          </div>
          <div className="fill-legend">
            <div className="fill-legend-item">
              <span className="dot dot-booked" />
              Booked <b id="legendBooked">{st.booked}</b>
            </div>
            <div className="fill-legend-item">
              <span className="dot dot-reserved" />
              Reserved <b id="legendReserved">{st.reserved}</b>
            </div>
            <div className="fill-legend-item">
              <span className="dot dot-cancelled" />
              Cancelled <b id="legendCancelled">{st.cancelled}</b>
            </div>
            <div className="fill-legend-item">
              <span className="dot dot-available" />
              Available <b id="legendAvailable">{st.available}</b>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3>Payment Breakdown</h3>
          </div>
          <div className="pay-rows">
            <div className="pay-row">
              <span className="pay-dot paid" />
              <span className="pay-label">Paid</span>
              <span className="pay-count" id="payPaidCount">{st.paidCount}</span>
              <span className="pay-amt" id="payPaidAmt">{formatTaka(paidAmt)}</span>
            </div>
            <div className="pay-row">
              <span className="pay-dot advance" />
              <span className="pay-label">Advance</span>
              <span className="pay-count" id="payAdvCount">{st.advCount}</span>
              <span className="pay-amt" id="payAdvAmt">{formatTaka(advAmt)}</span>
            </div>
            <div className="pay-row">
              <span className="pay-dot due" />
              <span className="pay-label">Due</span>
              <span className="pay-count" id="payDueCount">{st.dueCount}</span>
              <span className="pay-amt" id="payDueAmt">{formatTaka(dueAmt)}</span>
            </div>
          </div>
          <div className="pay-total-row">
            <span>Total Collection</span>
            <b id="payTotalCollection">{formatTaka(paidAmt + advAmt)}</b>
          </div>
          <div className="pay-total-row due-row">
            <span>Total Due</span>
            <b id="payTotalDue">{formatTaka(dueAmt)}</b>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>Recent Bookings</h3>
          <button className="link-btn" onClick={() => onViewChange('passengers')}>
            View all
          </button>
        </div>
        <div className="table-wrap">
          <table className="data-table" id="recentTable">
            <thead>
              <tr>
                <th>Seat</th>
                <th>Passenger</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {recentBookings.map(b => (
                <tr key={b.id} onClick={() => onBookSeatClick(b.id)}>
                  <td className="td-seat">{b.id}</td>
                  <td>{b.name || '—'}</td>
                  <td>{b.phone || '—'}</td>
                  <td>
                    <span className={`status-tag ${b.status}`}>{capitalize(b.status)}</span>
                  </td>
                  <td className="td-amt">{formatTaka(b.fee)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {recentBookings.length === 0 && (
            <div className="empty-state" id="recentEmpty">
              <p>No bookings yet</p>
              <span>Tap a seat on the Seat Map to create the first booking for this trip.</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
