/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Settings, Trip } from '../types';
import { formatDate, formatTaka, capitalize } from '../utils';
import { ZH_OFFICIAL_LOGO } from '../assets/logo';

interface TicketPrintProps {
  settings: Settings;
  trip: Trip;
  printedSeatIds: string[]; // Supports single or bulk ticket printing
}

export default function TicketPrint({ settings, trip, printedSeatIds }: TicketPrintProps) {
  if (!printedSeatIds || printedSeatIds.length === 0) return null;

  return (
    <div id="ticketPrintArea" className="ticket-print-area">
      {printedSeatIds.map(seatId => {
        const s = trip.seats[seatId];
        if (!s) return null;

        const busName = trip.busName || settings.busName || 'Counter Pro';
        const devLine = settings.devLine || 'ZIHAN | +8801830343515';
        const headerText = settings.ticketHeader?.trim();
        const footerText = settings.ticketFooter?.trim() || 'Thank you for travelling with us';

        return (
          <div key={seatId} className="ticket-page">
            <div className="ticket">
              <div className="ticket-head">
                <img
                  src={settings.logo || ZH_OFFICIAL_LOGO}
                  alt="Logo"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = ZH_OFFICIAL_LOGO;
                  }}
                />
                <div>
                  <div className="ticket-bus-name">{busName}</div>
                  <div className="ticket-dev-line">{devLine}</div>
                </div>
              </div>
              {headerText && <div className="ticket-header-text">{headerText}</div>}
              <div className="ticket-route">{trip.route}</div>
              <div className="ticket-date">
                {formatDate(trip.date)}
                {trip.time ? ` · ${trip.time}` : ''}
              </div>
              <div className="ticket-divider" />
              <div className="ticket-row">
                <span>Seat</span>
                <b>{seatId}</b>
              </div>
              <div className="ticket-row">
                <span>Passenger</span>
                <b>{s.name || '—'}</b>
              </div>
              <div className="ticket-row">
                <span>Phone</span>
                <b>{s.phone || '—'}</b>
              </div>
              <div className="ticket-row">
                <span>Boarding</span>
                <b>{s.boarding || '—'}</b>
              </div>
              <div className="ticket-row">
                <span>Drop</span>
                <b>{s.drop || '—'}</b>
              </div>
              <div className="ticket-divider" />
              <div className="ticket-row big">
                <span>Amount</span>
                <b>{formatTaka(s.fee)}</b>
              </div>
              <div className="ticket-row">
                <span>Payment</span>
                <b>{capitalize(s.payment || 'due')}</b>
              </div>
              <div className="ticket-divider dashed" />
              <div className="ticket-foot">{footerText}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
