/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Trip } from '../types';
import { ALL_SEAT_IDS, seatStats, formatTaka, formatDate, capitalize } from '../utils';

interface ReportsViewProps {
  trips: Record<string, Trip>;
  activeTrip: Trip;
}

export default function ReportsView({ trips, activeTrip }: ReportsViewProps) {
  const [activeReport, setActiveReport] = useState<'daily' | 'tripwise' | 'income' | 'duevpaid'>('daily');

  const st = seatStats(activeTrip);

  const renderDailyReport = () => {
    const bookedSeats = ALL_SEAT_IDS.filter(id => {
      const s = activeTrip.seats[id];
      return s && s.status !== 'available';
    });

    return (
      <>
        <div className="report-summary-grid">
          <div className="stat-card">
            <div className="stat-card-label">Date</div>
            <div className="stat-card-value" style={{ fontSize: '17px' }}>
              {formatDate(activeTrip.date)}
            </div>
          </div>
          <div className="stat-card accent-green">
            <div className="stat-card-label">Booked Today</div>
            <div className="stat-card-value">{st.booked}</div>
          </div>
          <div className="stat-card accent-blue">
            <div className="stat-card-label">Collection</div>
            <div className="stat-card-value" style={{ fontSize: '18px' }}>
              {formatTaka(st.collected)}
            </div>
          </div>
          <div className="stat-card accent-red">
            <div className="stat-card-label">Due</div>
            <div className="stat-card-value" style={{ fontSize: '18px' }}>
              {formatTaka(st.due)}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3>{activeTrip.route} — Seat Breakdown</h3>
          </div>
          {bookedSeats.length > 0 ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Seat</th>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {bookedSeats.map(id => {
                    const s = activeTrip.seats[id];
                    return (
                      <tr key={id}>
                        <td className="td-seat">{id}</td>
                        <td>{s.name || '—'}</td>
                        <td>
                          <span className={`status-tag ${s.status}`}>{capitalize(s.status)}</span>
                        </td>
                        <td className="td-amt">{formatTaka(s.fee)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <p>No bookings yet</p>
              <span>Book seats from the Seat Map to see them here.</span>
            </div>
          )}
        </div>
      </>
    );
  };

  const renderTripwiseReport = () => {
    const tripList = Object.values(trips).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return (
      <div className="panel">
        <div className="panel-head">
          <h3>All Trips</h3>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Route</th>
                <th>Date</th>
                <th>Booked</th>
                <th>Collection</th>
                <th>Due</th>
              </tr>
            </thead>
            <tbody>
              {tripList.map(t => {
                const s = seatStats(t);
                return (
                  <tr key={t.id}>
                    <td>{t.route}</td>
                    <td>{formatDate(t.date)}</td>
                    <td className="td-amt">
                      {s.booked}/{s.total}
                    </td>
                    <td className="td-amt">{formatTaka(s.collected)}</td>
                    <td className="td-amt">{formatTaka(s.due)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderIncomeSummary = () => {
    let totalCollection = 0,
      totalDue = 0,
      totalBooked = 0;
    Object.values(trips).forEach(t => {
      const s = seatStats(t);
      totalCollection += s.collected;
      totalDue += s.due;
      totalBooked += s.booked;
    });

    return (
      <div className="report-summary-grid">
        <div className="stat-card accent-green">
          <div className="stat-card-label">Total Collection (All Trips)</div>
          <div className="stat-card-value" style={{ fontSize: '20px' }}>
            {formatTaka(totalCollection)}
          </div>
        </div>
        <div className="stat-card accent-red">
          <div className="stat-card-label">Total Due (All Trips)</div>
          <div className="stat-card-value" style={{ fontSize: '20px' }}>
            {formatTaka(totalDue)}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Total Booked Seats</div>
          <div className="stat-card-value">{totalBooked}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Total Trips</div>
          <div className="stat-card-value">{Object.keys(trips).length}</div>
        </div>
      </div>
    );
  };

  const renderDuevPaid = () => {
    const totalPct = st.paidCount + st.advCount + st.dueCount;
    const paidPct = totalPct ? Math.round((st.paidCount / totalPct) * 100) : 0;
    const advPct = totalPct ? Math.round((st.advCount / totalPct) * 100) : 0;
    const duePct = totalPct ? Math.round((st.dueCount / totalPct) * 100) : 0;

    return (
      <div className="panel">
        <div className="panel-head">
          <h3>{activeTrip.route} — Paid vs Due</h3>
        </div>
        <div className="pay-rows">
          <div className="pay-row">
            <span className="pay-dot paid" />
            <span className="pay-label">Paid</span>
            <span className="pay-count">{st.paidCount}</span>
            <span className="pay-amt">{paidPct}%</span>
          </div>
          <div className="pay-row">
            <span className="pay-dot advance" />
            <span className="pay-label">Advance</span>
            <span className="pay-count">{st.advCount}</span>
            <span className="pay-amt">{advPct}%</span>
          </div>
          <div className="pay-row">
            <span className="pay-dot due" />
            <span className="pay-label">Due</span>
            <span className="pay-count">{st.dueCount}</span>
            <span className="pay-amt">{duePct}%</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <section className="view" id="view-reports">
      <div className="view-head">
        <div>
          <h1>Reports</h1>
          <p className="view-sub">Daily, trip-wise and income summaries</p>
        </div>
      </div>

      <div className="report-tabs">
        <button
          onClick={() => setActiveReport('daily')}
          className={`report-tab ${activeReport === 'daily' ? 'active' : ''}`}
        >
          Daily Report
        </button>
        <button
          onClick={() => setActiveReport('tripwise')}
          className={`report-tab ${activeReport === 'tripwise' ? 'active' : ''}`}
        >
          Trip-wise Report
        </button>
        <button
          onClick={() => setActiveReport('income')}
          className={`report-tab ${activeReport === 'income' ? 'active' : ''}`}
        >
          Income Summary
        </button>
        <button
          onClick={() => setActiveReport('duevpaid')}
          className={`report-tab ${activeReport === 'duevpaid' ? 'active' : ''}`}
        >
          Paid vs Due
        </button>
      </div>

      <div className="report-body" id="reportBody">
        {activeReport === 'daily' && renderDailyReport()}
        {activeReport === 'tripwise' && renderTripwiseReport()}
        {activeReport === 'income' && renderIncomeSummary()}
        {activeReport === 'duevpaid' && renderDuevPaid()}
      </div>
    </section>
  );
}
