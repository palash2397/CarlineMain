import { Injectable } from '@nestjs/common';
import nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: any;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      //   secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendEmail(to: string, subject: string, text: string, html?: string) {
    await this.transporter.sendMail({
      from: process.env.SMTP_USER,
      to,
      subject,
      text,
      html,
    });
  }

  /**
   * Send Trip Invoice / Receipt email upon ride completion
   */
  async sendRideInvoiceEmail(
    to: string,
    ride: {
      rideId: string;
      pickupAddress: string;
      dropoffAddress: string;
      totalFare: number | string;
      payableFare: number | string;
      paymentMethod: string;
      distanceKm?: number;
      durationMinutes?: number;
      completedAt?: Date | string;
      passengerName?: string;
      driverName?: string;
      vehicleTypeName?: string;
    },
  ) {
    const formattedDate = new Date(ride.completedAt || Date.now()).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6fb; margin: 0; padding: 20px; color: #222; }
          .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.08); }
          .header { background: linear-gradient(135deg, #1e293b, #0f172a); color: #ffffff; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 0.5px; }
          .header p { margin: 8px 0 0; font-size: 14px; opacity: 0.85; }
          .fare-banner { background: #f8fafc; border-bottom: 2px dashed #e2e8f0; padding: 25px; text-align: center; }
          .fare-amount { font-size: 36px; font-weight: 800; color: #0f172a; margin: 5px 0; }
          .fare-status { display: inline-block; padding: 4px 12px; background: #dcfce7; color: #166534; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
          .content { padding: 30px; }
          .trip-info { background: #f8fafc; border-radius: 8px; padding: 18px; margin-bottom: 24px; }
          .location-row { display: flex; align-items: flex-start; margin-bottom: 12px; }
          .location-dot { width: 10px; height: 10px; border-radius: 50%; margin-top: 5px; margin-right: 12px; flex-shrink: 0; }
          .dot-green { background: #22c55e; }
          .dot-red { background: #ef4444; }
          .location-label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; }
          .location-text { font-size: 14px; color: #1e293b; font-weight: 500; }
          .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
          .stat-box { background: #f1f5f9; padding: 12px 16px; border-radius: 8px; }
          .stat-title { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; }
          .stat-value { font-size: 15px; color: #0f172a; font-weight: 600; margin-top: 2px; }
          .table-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
          .table-row.total { border-top: 2px solid #0f172a; border-bottom: none; font-size: 16px; font-weight: 700; color: #0f172a; padding-top: 14px; }
          .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Carline</h1>
            <p>Trip Receipt &amp; Invoice</p>
          </div>

          <div class="fare-banner">
            <span class="fare-status">Paid via ${ride.paymentMethod}</span>
            <div class="fare-amount">$${Number(ride.payableFare).toFixed(2)}</div>
            <div style="font-size: 13px; color: #64748b;">${formattedDate}</div>
          </div>

          <div class="content">
            <p style="margin-top: 0; font-size: 15px;">Hi <b>${ride.passengerName || 'Passenger'}</b>, thank you for riding with Carline. Here is your trip invoice.</p>

            <div class="trip-info">
              <div class="location-row">
                <div class="location-dot dot-green"></div>
                <div>
                  <div class="location-label">Pickup Location</div>
                  <div class="location-text">${ride.pickupAddress}</div>
                </div>
              </div>
              <div class="location-row" style="margin-bottom: 0;">
                <div class="location-dot dot-red"></div>
                <div>
                  <div class="location-label">Dropoff Location</div>
                  <div class="location-text">${ride.dropoffAddress}</div>
                </div>
              </div>
            </div>

            <div class="stats-grid">
              <div class="stat-box">
                <div class="stat-title">Driver</div>
                <div class="stat-value">${ride.driverName || 'Assigned Driver'}</div>
              </div>
              <div class="stat-box">
                <div class="stat-title">Vehicle Type</div>
                <div class="stat-value">${ride.vehicleTypeName || 'Carline Cab'}</div>
              </div>
              <div class="stat-box">
                <div class="stat-title">Distance</div>
                <div class="stat-value">${ride.distanceKm ? `${ride.distanceKm} km` : '-'}</div>
              </div>
              <div class="stat-box">
                <div class="stat-title">Duration</div>
                <div class="stat-value">${ride.durationMinutes ? `${ride.durationMinutes} min` : '-'}</div>
              </div>
            </div>

            <div style="margin-top: 20px;">
              <div class="table-row">
                <span style="color: #64748b;">Trip Fare</span>
                <span>$${Number(ride.totalFare).toFixed(2)}</span>
              </div>
              <div class="table-row total">
                <span>Total Paid</span>
                <span>$${Number(ride.payableFare).toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div class="footer">
            <p style="margin: 0;">Ride ID: <code>${ride.rideId}</code></p>
            <p style="margin: 6px 0 0;">Need help? Contact support in the Carline app.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `Carline Trip Receipt\n\nRide ID: ${ride.rideId}\nTotal Fare: $${ride.payableFare}\nPaid via: ${ride.paymentMethod}\nPickup: ${ride.pickupAddress}\nDropoff: ${ride.dropoffAddress}\nDate: ${formattedDate}`;

    await this.sendEmail(to, `Your Carline Trip Receipt - $${Number(ride.payableFare).toFixed(2)}`, text, html);
  }
}
