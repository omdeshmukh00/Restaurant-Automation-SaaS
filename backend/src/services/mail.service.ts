// src/services/mail.service.ts
// Nodemailer wrapper for sending emails

import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env';
import logger from '../config/logger';
import { EmailLogModel, EmailType, EmailStatus } from '../modules/notifications/emailLog.model';
import { RestaurantModel } from '../modules/restaurants/restaurants.model';
import { getPlatformSettings } from '../modules/superAdmin/platformSettings.model';

// Email Subject Constants
export const EMAIL_SUBJECTS = {
  OTP: 'Your verification code',
  PASSWORD_RESET: 'Reset your password',
  STAFF_INVITATION: 'You have been invited to join the staff',
  RESERVATION_CONFIRMATION: 'Reservation Confirmed',
  LOW_STOCK_ALERT: 'Inventory Low Stock Alert',
  DAILY_SALES_REPORT: 'Daily Sales Report',
  RECEIPT: 'Your Payment Receipt',
  PASSWORD_CHANGED_ALERT: 'Security Alert: Your Password Was Changed',
  RESTAURANT_APPROVAL: 'Welcome - Your Restaurant Has Been Approved',
  RESTAURANT_REJECTION: 'Your Partner Application Status',
  RESTAURANT_SUBMISSION: 'Your Partner Application Received',
  RESTAURANT_PLAN_UPDATED: 'Your Subscription Plan Has Been Updated',
  RESTAURANT_SUSPENDED: 'Notice of Account Suspension',
  RESTAURANT_ACTIVATED: 'Your Restaurant Has Been Activated',
  USAGE_WARNING: 'Plan Limit Warning',
  USAGE_EXCEEDED: 'Plan Limit Exceeded',
  SUBSCRIPTION_EXPIRED: 'Subscription Expired',
  PAYMENT_FAILED: 'Notice of Payment Failure',
  ACCOUNT_LOCKED: 'Security Alert: Account Temporarily Locked',
};

let transporter: nodemailer.Transporter | null = null;

/**
 * Get or create the email transporter.
 * Only initializes if SMTP config is present.
 */
export function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;


  if (env.NODE_ENV !== 'test' && (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS)) {
    logger.warn('SMTP not configured - email sending disabled');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST || 'localhost',
    port: env.SMTP_PORT || 587,
    auth: {
      user: env.SMTP_USER || 'test',
      pass: env.SMTP_PASS || 'test',
    },
  });

  return transporter;
}

/**
 * Verify SMTP connection on startup.
 */
export async function verifySmtpConnection(): Promise<boolean> {
  const transport = getTransporter();
  if (!transport) return false;

  try {
    await transport.verify();
    logger.info('📧 SMTP Connection Verified - Ready to send emails');
    return true;
  } catch (error) {

    logger.error('❌ SMTP Connection Failed:', { error });
    return false;
  }
}

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  emailType?: EmailType;
  restaurantId?: string;
}

/**
 * Send an email. Silently logs and returns false if SMTP is not configured.
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const transport = getTransporter();

  // Check email preferences if restaurantId is provided
  if (options.restaurantId && options.emailType) {
    const restaurant = await RestaurantModel.findById(options.restaurantId).lean();
    if (restaurant && restaurant.settings.emailPreferences) {
      const prefs = restaurant.settings.emailPreferences;
      if (options.emailType === EmailType.DAILY_SALES_REPORT && prefs.dailySalesReports === false) {
        logger.info(`Skipping Daily Sales Report for restaurant ${options.restaurantId} due to preferences`);
        return false;
      }
      if (options.emailType === EmailType.LOW_STOCK_ALERT && prefs.inventoryAlerts === false) {
        logger.info(`Skipping Inventory Alert for restaurant ${options.restaurantId} due to preferences`);
        return false;
      }
      if (options.emailType === EmailType.STAFF_INVITATION && prefs.staffNotifications === false) {
        logger.info(`Skipping Staff Invitation for restaurant ${options.restaurantId} due to preferences`);
        return false;
      }
    }
  }

  if (!transport) {
    logger.info(`📧 Email not sent (SMTP not configured): ${options.subject} → ${options.to}`);
    // In development, log the email content for debugging
    if (env.NODE_ENV === 'development') {
      logger.debug('Email content:', { to: options.to, subject: options.subject });
    }
    return false;
  }

  try {
    // Retrieve dynamic platform settings
    const settings = await getPlatformSettings().catch(() => null);
    const platformName = settings?.platformName || 'HQ Terminal';
    const supportEmail = settings?.supportEmail || env.SMTP_FROM || 'support@hqterminal.io';
    const currentYear = new Date().getFullYear().toString();
    const fromHeader = `"${platformName}" <${supportEmail}>`;

    const finalSubject = options.subject
      .replace(/RestoHub/g, platformName)
      .replace(/\{\{platformName\}\}/g, platformName)
      .replace(/\{\{year\}\}/g, currentYear);

    let finalHtml = options.html;
    if (options.restaurantId) {
      const restaurant = await RestaurantModel.findById(options.restaurantId).select('settings.branding').lean();

      const branding = restaurant?.settings?.branding || {};
      const primaryColor = branding.primaryColor || '#000000';
      const logo = branding.logo ? `<img src="${branding.logo}" alt="Logo" style="max-height: 60px; margin-bottom: 20px;" />` : '';
      const footerText = branding.footerText || '';
      const contactStr = [branding.supportEmail, branding.supportPhone, branding.website].filter(Boolean).join(' | ');

      finalHtml = `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-top: 4px solid ${primaryColor}; border-radius: 4px;">
          <div style="padding: 20px; text-align: center; border-bottom: 1px solid #eee;">
            ${logo}
          </div>
          <div style="padding: 20px;">
            ${options.html}
          </div>
          <div style="padding: 20px; text-align: center; font-size: 12px; color: #888; background-color: #f9f9f9;">
            <p>${footerText}</p>
            <p>${contactStr}</p>
          </div>
        </div>
      `;
    }

    // Apply template variable replacements
    finalHtml = finalHtml
      .replace(/\{\{year\}\}/g, currentYear)
      .replace(/\{\{platformName\}\}/g, platformName)
      .replace(/\{\{supportEmail\}\}/g, supportEmail)
      .replace(/RestoHub/g, platformName)
      .replace(/support@restohub\.com|hello@restohub\.in/g, supportEmail)
      .replace(/automated email/gi, 'auto generated email');

    let finalText = options.text;
    if (finalText) {
      finalText = finalText
        .replace(/\{\{year\}\}/g, currentYear)
        .replace(/\{\{platformName\}\}/g, platformName)
        .replace(/\{\{supportEmail\}\}/g, supportEmail)
        .replace(/RestoHub/g, platformName)
        .replace(/support@restohub\.com|hello@restohub\.in/g, supportEmail)
        .replace(/automated email/gi, 'auto generated email');
    }

    const info = await transport.sendMail({
      from: fromHeader,
      to: options.to,
      subject: finalSubject,
      html: finalHtml,
      text: finalText,
    });

    if (options.emailType) {
      await EmailLogModel.create({
        emailType: options.emailType,
        recipient: options.to,
        status: EmailStatus.SENT,
        provider: 'SMTP',
        messageId: info.messageId,
        restaurantId: options.restaurantId,
      }).catch(e => logger.error('Failed to save email log', e));
    }

    logger.info(`📧 Email sent successfully: ${options.subject} → ${options.to}`, { messageId: info.messageId });
    return true;
  } catch (error: any) {
    if (options.emailType) {
      await EmailLogModel.create({
        emailType: options.emailType,
        recipient: options.to,
        status: EmailStatus.FAILED,
        provider: 'SMTP',
        failureReason: error.message,
        restaurantId: options.restaurantId,
      }).catch(e => logger.error('Failed to save email log', e));
    }


    logger.error('Failed to send email:', {
      error: error.message,
      stack: error.stack,
      to: options.to,
      subject: options.subject
    });
    return false;
  }
}

// Template Caching
const templatesCache: Record<string, string> = {};

function getTemplate(templateName: string): string {
  if (templatesCache[templateName]) {
    return templatesCache[templateName];
  }

  const templatePath = path.join(__dirname, '..', 'templates', 'emails', `${templateName}.html`);
  try {
    const content = fs.readFileSync(templatePath, 'utf-8');
    templatesCache[templateName] = content;
    return content;
  } catch (error) {
    logger.error(`Template not found or failed to load: ${templatePath}`, { error });
    throw new Error(`Email template ${templateName} not found`);
  }
}

/**
 * Send OTP email.
 */
export async function sendOTPEmail(to: string, otp: string, expiryMinutes: number = 2): Promise<boolean> {
  try {
    let html = getTemplate('otp');
    html = html.replace('{{otp}}', otp);
    html = html.replace(/\{\{otpExpiryMinutes\}\}/g, String(expiryMinutes));

    return await sendEmail({
      to,
      subject: EMAIL_SUBJECTS.OTP,
      html,
    });
  } catch (error) {
    logger.error('Failed to prepare or send OTP email', { error, to });
    return false;
  }
}

/**
 * Send password reset email.
 */
export async function sendPasswordResetEmail(to: string, resetToken: string): Promise<boolean> {
  try {
    const resetUrl = `${env.CLIENT_URL}/reset-password?token=${resetToken}`;

    let html = getTemplate('password-reset');
    html = html.replace('{{resetUrl}}', resetUrl);

    return await sendEmail({
      to,
      subject: EMAIL_SUBJECTS.PASSWORD_RESET,
      html,
    });
  } catch (error) {
    logger.error('Failed to prepare or send password reset email', { error, to });
    return false;
  }
}

/**
 * Send staff invitation email.
 */
export async function sendStaffInvitationEmail(
  email: string,
  staffName: string,
  temporaryPassword: string,
  loginUrl: string,
  restaurantName: string = 'Our Restaurant'
): Promise<boolean> {
  try {
    let html = getTemplate('staff-invitation');

    html = html.replace(/\{\{restaurantName\}\}/g, restaurantName);
    html = html.replace(/\{\{staffName\}\}/g, staffName);
    html = html.replace(/\{\{temporaryPassword\}\}/g, temporaryPassword);
    html = html.replace(/\{\{loginUrl\}\}/g, loginUrl);

    return await sendEmail({
      to: email,
      subject: EMAIL_SUBJECTS.STAFF_INVITATION,
      html,
    });
  } catch (error) {
    logger.error('Failed to prepare or send staff invitation email', { error, email });
    return false;
  }
}

/**
 * Send reservation confirmation email.
 */
export async function sendReservationConfirmationEmail(
  email: string,
  customerName: string,
  restaurantName: string,
  date: string,
  time: string,
  guests: number,
  tableInfo: string,
  contactInfo: string,
  notes: string = ''
): Promise<boolean> {
  try {
    let html = getTemplate('reservation-confirmation');

    html = html.replace(/\{\{customerName\}\}/g, customerName);
    html = html.replace(/\{\{restaurantName\}\}/g, restaurantName);
    html = html.replace(/\{\{date\}\}/g, date);
    html = html.replace(/\{\{time\}\}/g, time);
    html = html.replace(/\{\{guests\}\}/g, String(guests));
    html = html.replace(/\{\{tableInfo\}\}/g, tableInfo);
    html = html.replace(/\{\{contactInfo\}\}/g, contactInfo);

    const notesHtml = notes ? `
      <div class="detail-row">
        <span class="detail-label">Notes</span>
        <span class="detail-value">${notes}</span>
      </div>
    ` : '';
    html = html.replace(/\{\{notesHtml\}\}/g, notesHtml);

    return await sendEmail({
      to: email,
      subject: EMAIL_SUBJECTS.RESERVATION_CONFIRMATION,
      html,
    });
  } catch (error) {
    logger.error('Failed to prepare or send reservation confirmation email', { error, email });
    return false;
  }
}

/**
 * Send low stock alert email.
 */
export async function sendLowStockAlertEmail(
  email: string,
  restaurantName: string,
  itemName: string,
  currentStock: number,
  threshold: number,
  unit: string
): Promise<boolean> {
  try {
    let html = getTemplate('low-stock-alert');

    html = html.replace(/\{\{restaurantName\}\}/g, restaurantName);
    html = html.replace(/\{\{itemName\}\}/g, itemName);
    html = html.replace(/\{\{currentStock\}\}/g, String(currentStock));
    html = html.replace(/\{\{threshold\}\}/g, String(threshold));
    html = html.replace(/\{\{unit\}\}/g, unit);

    return await sendEmail({
      to: email,
      subject: EMAIL_SUBJECTS.LOW_STOCK_ALERT,
      html,
    });
  } catch (error) {
    logger.error('Failed to prepare or send low stock alert email', { error, email });
    return false;
  }
}
export async function sendDailySalesReportEmail(
  email: string,
  restaurantName: string,
  reportDate: string,
  totalOrders: number,
  revenue: number,
  paidBills: number,
  cancelledOrders: number,
  averageOrderValue: number,
  topSellingItems: Array<{ name: string; quantity: number }>
): Promise<boolean> {
  try {
    let html = getTemplate('daily-sales-report');

    const currencySymbol = '₹'; // Assuming INR for now, could be passed as argument if multi-currency

    // Format top selling items as HTML list
    const topItemsHtml = topSellingItems.length > 0
      ? topSellingItems.map(item => `<li>${item.name}: ${item.quantity} units</li>`).join('')
      : '<li>No items sold today</li>';

    html = html.replace(/\{\{restaurantName\}\}/g, restaurantName);
    html = html.replace(/\{\{reportDate\}\}/g, reportDate);
    html = html.replace(/\{\{totalOrders\}\}/g, String(totalOrders));
    html = html.replace(/\{\{revenue\}\}/g, `${currencySymbol}${revenue.toFixed(2)}`);
    html = html.replace(/\{\{paidBills\}\}/g, String(paidBills));
    html = html.replace(/\{\{cancelledOrders\}\}/g, String(cancelledOrders));
    html = html.replace(/\{\{averageOrderValue\}\}/g, `${currencySymbol}${averageOrderValue.toFixed(2)}`);
    html = html.replace(/\{\{topSellingItems\}\}/g, topItemsHtml);

    return await sendEmail({
      to: email,
      subject: `${EMAIL_SUBJECTS.DAILY_SALES_REPORT} - ${reportDate}`,
      html,
    });
  } catch (error) {
    logger.error('Failed to prepare or send daily sales report email', { error, email });
    return false;
  }
}

export function closeTransporter() {
  if (transporter) {
    if (typeof transporter.close === 'function') {
      transporter.close();
    }
    transporter = null;
  }
}

export function resetTransporterForTests() { 
  closeTransporter(); 
}

/**
 * Send Receipt Email
 */
export async function sendReceiptEmail(
  email: string,
  details: {
    restaurantName: string;
    invoiceNumber: string;
    customerName: string;
    customerPhone: string;
    orderItems: Array<{ name: string; quantity: number; price: number; totalPrice: number }>;
    subtotal: number;
    taxAmount: number;
    totalAmount: number;
    paymentMethod: string;
    paymentDate: string;
  }
): Promise<boolean> {
  try {
    let html = getTemplate('receipt');

    const currencySymbol = '₹';

    const orderItemsHtml = details.orderItems.length > 0
      ? details.orderItems.map(item => `
          <tr>
            <td>${item.name}</td>
            <td class="text-right">${item.quantity}</td>
            <td class="text-right">${currencySymbol}${item.totalPrice.toFixed(2)}</td>
          </tr>
        `).join('')
      : '<tr><td colspan="3">No items</td></tr>';

    html = html.replace(/\{\{restaurantName\}\}/g, details.restaurantName);
    html = html.replace(/\{\{invoiceNumber\}\}/g, details.invoiceNumber);
    html = html.replace(/\{\{paymentDate\}\}/g, details.paymentDate);
    html = html.replace(/\{\{customerName\}\}/g, details.customerName || 'Guest');
    html = html.replace(/\{\{customerPhone\}\}/g, details.customerPhone || '');
    html = html.replace(/\{\{paymentMethod\}\}/g, details.paymentMethod);
    html = html.replace(/\{\{orderItemsHtml\}\}/g, orderItemsHtml);
    html = html.replace(/\{\{subtotal\}\}/g, `${currencySymbol}${details.subtotal.toFixed(2)}`);
    html = html.replace(/\{\{taxAmount\}\}/g, `${currencySymbol}${details.taxAmount.toFixed(2)}`);
    html = html.replace(/\{\{totalAmount\}\}/g, `${currencySymbol}${details.totalAmount.toFixed(2)}`);

    return await sendEmail({
      to: email,
      subject: `${EMAIL_SUBJECTS.RECEIPT} - ${details.invoiceNumber}`,
      html,
    });
  } catch (error) {
    logger.error('Failed to prepare or send receipt email', { error, email, invoiceNumber: details.invoiceNumber });
    return false;
  }
}

function formatCleanIp(ip?: string): string {
  if (!ip) return '127.0.0.1 (Localhost)';
  let clean = ip;
  if (clean.startsWith('::ffff:')) {
    clean = clean.replace('::ffff:', '');
  }
  if (clean === '::1' || clean === '127.0.0.1') {
    return '127.0.0.1 (Localhost)';
  }
  return clean;
}

function parseUserAgentString(ua?: string): string {
  if (!ua) return 'Browser on Desktop';

  let browser = 'Browser';
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edg')) browser = 'Edge';
  else if (ua.includes('Opera') || ua.includes('OPR')) browser = 'Opera';

  let os = 'Device';
  if (ua.includes('Windows NT 10.0')) os = 'Windows 10/11';
  else if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS X')) os = 'macOS';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('Linux')) os = 'Linux';

  return `${browser} on ${os}`;
}

/**
 * Send Password Changed Security Alert Email
 */
export async function sendPasswordChangedAlertEmail(
  email: string,
  name: string,
  ipAddress?: string,
  userAgent?: string
): Promise<boolean> {
  try {
    let html = getTemplate('password-changed-alert');

    const cleanIp = formatCleanIp(ipAddress);
    const cleanDevice = parseUserAgentString(userAgent);

    const datetime = new Date().toLocaleString('en-US', { timeZoneName: 'short' });
    const ipHtml = `<p><strong>IP Address:</strong> ${cleanIp}</p>`;
    const deviceHtml = `<p><strong>Device/Browser:</strong> ${cleanDevice}</p>`;

    html = html.replace(/\{\{name\}\}/g, name || 'User');
    html = html.replace(/\{\{email\}\}/g, email);
    html = html.replace(/\{\{datetime\}\}/g, datetime);
    html = html.replace(/\{\{ipHtml\}\}/g, ipHtml);
    html = html.replace(/\{\{deviceHtml\}\}/g, deviceHtml);

    return await sendEmail({
      to: email,
      subject: EMAIL_SUBJECTS.PASSWORD_CHANGED_ALERT,
      html,
      emailType: EmailType.PASSWORD_CHANGED_ALERT,
    });
  } catch (error) {
    logger.error('Failed to prepare or send password changed alert email', { error, email });
    return false;
  }
}

/**
 * Send Account Locked Security Alert Email
 */
export async function sendAccountLockedEmail(
  email: string,
  name: string,
  ipAddress?: string,
  userAgent?: string
): Promise<boolean> {
  try {
    let html = getTemplate('account-locked');

    const cleanIp = formatCleanIp(ipAddress);
    const cleanDevice = parseUserAgentString(userAgent);

    const datetime = new Date().toLocaleString('en-US', { timeZoneName: 'short' });
    const ipHtml = `<p><strong>IP Address:</strong> ${cleanIp}</p>`;
    const deviceHtml = `<p><strong>Device/Browser:</strong> ${cleanDevice}</p>`;

    html = html.replace(/\{\{name\}\}/g, name || 'User');
    html = html.replace(/\{\{email\}\}/g, email);
    html = html.replace(/\{\{datetime\}\}/g, datetime);
    html = html.replace(/\{\{ipHtml\}\}/g, ipHtml);
    html = html.replace(/\{\{deviceHtml\}\}/g, deviceHtml);

    return await sendEmail({
      to: email,
      subject: EMAIL_SUBJECTS.ACCOUNT_LOCKED,
      html,
      emailType: EmailType.PASSWORD_CHANGED_ALERT,
    });
  } catch (error) {
    logger.error('Failed to prepare or send account locked alert email', { error, email });
    return false;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function sendRestaurantApprovalEmail(
  email: string,
  ownerName: string,
  restaurantName: string,
  temporaryPassword: string,
  loginUrl: string
): Promise<boolean> {
  try {
    let html = getTemplate('restaurant-approval');

    html = html.replace(/\{\{ownerName\}\}/g, escapeHtml(ownerName));
    html = html.replace(/\{\{restaurantName\}\}/g, escapeHtml(restaurantName));
    html = html.replace(/\{\{loginEmail\}\}/g, escapeHtml(email));
    html = html.replace(/\{\{temporaryPassword\}\}/g, escapeHtml(temporaryPassword));
    html = html.replace(/\{\{loginUrl\}\}/g, escapeHtml(loginUrl));

    return await sendEmail({
      to: email,
      subject: EMAIL_SUBJECTS.RESTAURANT_APPROVAL,
      html,
      emailType: EmailType.OTHER,
    });
  } catch (error) {
    logger.error('Failed to send restaurant approval email', { error, email });
    return false;
  }
}

export async function sendRestaurantDirectOnboardingEmail(
  email: string,
  ownerName: string,
  restaurantName: string,
  planName: string,
  temporaryPassword: string,
  loginUrl: string
): Promise<boolean> {
  try {
    let html = getTemplate('onboarding-mail');

    html = html.replace(/\{\{ownerName\}\}/g, escapeHtml(ownerName));
    html = html.replace(/\{\{restaurantName\}\}/g, escapeHtml(restaurantName));
    html = html.replace(/\{\{planName\}\}/g, escapeHtml(planName));
    html = html.replace(/\{\{loginEmail\}\}/g, escapeHtml(email));
    html = html.replace(/\{\{temporaryPassword\}\}/g, escapeHtml(temporaryPassword));
    html = html.replace(/\{\{loginUrl\}\}/g, escapeHtml(loginUrl));

    return await sendEmail({
      to: email,
      subject: `Welcome to RestoHub - Your Onboarding Credentials for ${restaurantName}`,
      html,
      emailType: EmailType.OTHER,
    });
  } catch (error) {
    logger.error('Failed to send restaurant direct onboarding email', { error, email });
    return false;
  }
}

/**
 * Send Restaurant Rejection Email
 */
export async function sendRestaurantRejectionEmail(
  email: string,
  ownerName: string,
  restaurantName: string,
  rejectionReason: string
): Promise<boolean> {
  try {
    let html = getTemplate('restaurant-rejection');

    html = html.replace(/\{\{ownerName\}\}/g, ownerName);
    html = html.replace(/\{\{restaurantName\}\}/g, restaurantName);
    html = html.replace(/\{\{rejectionReason\}\}/g, rejectionReason);

    return await sendEmail({
      to: email,
      subject: EMAIL_SUBJECTS.RESTAURANT_REJECTION,
      html,
      emailType: EmailType.OTHER,
    });
  } catch (error) {
    logger.error('Failed to send restaurant rejection email', { error, email });
    return false;
  }
}

/**
 * Send Restaurant Submission Email
 */
export async function sendRestaurantSubmissionEmail(
  email: string,
  ownerName: string,
  restaurantName: string,
  selectedPlan: string
): Promise<boolean> {
  try {
    let html = getTemplate('restaurant-submission');

    html = html.replace(/\{\{ownerName\}\}/g, ownerName);
    html = html.replace(/\{\{restaurantName\}\}/g, restaurantName);
    html = html.replace(/\{\{selectedPlan\}\}/g, selectedPlan);

    return await sendEmail({
      to: email,
      subject: EMAIL_SUBJECTS.RESTAURANT_SUBMISSION,
      html,
      emailType: EmailType.OTHER,
    });
  } catch (error) {
    logger.error('Failed to send restaurant submission email', { error, email });
    return false;
  }
}

export async function sendSubscriptionActivatedEmail(
  email: string,
  ownerName: string,
  planName: string,
  billingCycle: string,
  periodEnd: Date
): Promise<boolean> {
  try {
    let html = getTemplate('subscription-activated');
    html = html.replace(/\{\{ownerName\}\}/g, ownerName);
    html = html.replace(/\{\{planName\}\}/g, planName);
    html = html.replace(/\{\{billingCycle\}\}/g, billingCycle);
    html = html.replace(/\{\{periodEnd\}\}/g, periodEnd.toLocaleDateString());

    return await sendEmail({
      to: email,
      subject: 'RestoHub - Subscription Activated successfully',
      html,
      emailType: EmailType.OTHER,
    });
  } catch (error) {
    logger.error('Failed to send subscription activated email', { error, email });
    return false;
  }
}

export async function sendRefundEmail(
  email: string,
  ownerName: string,
  amount: number,
  paymentId: string,
  _success: boolean
): Promise<boolean> {
  try {
    let html = getTemplate('refund');
    html = html.replace(/\{\{ownerName\}\}/g, ownerName);
    html = html.replace(/\{\{amount\}\}/g, String(amount));
    html = html.replace(/\{\{paymentId\}\}/g, paymentId);

    return await sendEmail({
      to: email,
      subject: 'RestoHub - Refund Processed successfully',
      html,
      emailType: EmailType.OTHER,
    });
  } catch (error) {
    logger.error('Failed to send refund email', { error, email });
    return false;
  }
}

export async function sendPaymentSuccessEmail(
  email: string,
  ownerName: string,
  amount: number,
  orderId: string,
  paymentId: string
): Promise<boolean> {
  try {
    let html = getTemplate('payment-success');
    html = html.replace(/\{\{ownerName\}\}/g, ownerName);
    html = html.replace(/\{\{amount\}\}/g, String(amount));
    html = html.replace(/\{\{orderId\}\}/g, orderId);
    html = html.replace(/\{\{paymentId\}\}/g, paymentId);

    return await sendEmail({
      to: email,
      subject: 'RestoHub - Payment Received successfully',
      html,
      emailType: EmailType.OTHER,
    });
  } catch (error) {
    logger.error('Failed to send payment success email', { error, email });
    return false;
  }
}

export async function sendRestaurantPlanUpdatedEmail(
  email: string,
  ownerName: string,
  restaurantName: string,
  oldPlan: string,
  newPlan: string,
  isUpgrade: boolean
): Promise<boolean> {
  try {
    const actionText = isUpgrade ? 'upgraded' : 'downgraded';
    const congratsText = isUpgrade 
      ? 'Congratulations! Your account has been upgraded, and you can now enjoy all the premium features and services included in your new plan.'
      : 'This is a notification that your plan has been demoted as requested or processed.';

    const html = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-top: 4px solid #F97316; border-radius: 8px; padding: 24px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <h2 style="color: #F97316; margin-top: 0;">Subscription Plan Updated</h2>
        <p>Dear ${escapeHtml(ownerName)},</p>
        <p>We are writing to inform you that your restaurant <strong>${escapeHtml(restaurantName)}</strong> has been ${actionText} from the <strong>${escapeHtml(oldPlan)}</strong> plan to the <strong>${escapeHtml(newPlan)}</strong> plan.</p>
        <p>${congratsText}</p>
        <div style="background-color: #f9f9f9; border: 1px solid #eee; border-radius: 6px; padding: 16px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Previous Plan:</strong> ${escapeHtml(oldPlan)}</p>
          <p style="margin: 8px 0 0 0;"><strong>New Active Plan:</strong> ${escapeHtml(newPlan)}</p>
        </div>
        <p>If you have any questions or believe this update was made in error, please reach out to our support team.</p>
        <p style="margin-top: 30px; font-size: 12px; color: #888;">Sincerely,<br/>The RestoHub Team</p>
      </div>
    `;

    return await sendEmail({
      to: email,
      subject: EMAIL_SUBJECTS.RESTAURANT_PLAN_UPDATED,
      html,
      emailType: EmailType.OTHER,
    });
  } catch (error) {
    logger.error('Failed to send plan update email', { error, email });
    return false;
  }
}

export async function sendRestaurantSuspendedEmail(
  email: string,
  ownerName: string,
  restaurantName: string,
  reason: string
): Promise<boolean> {
  try {
    const html = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-top: 4px solid #EF4444; border-radius: 8px; padding: 24px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <h2 style="color: #EF4444; margin-top: 0;">Restaurant Account Suspended</h2>
        <p>Dear ${escapeHtml(ownerName)},</p>
        <p>We regret to inform you that your restaurant account <strong>${escapeHtml(restaurantName)}</strong> has been suspended or inactivated by RestoHub.</p>
        <div style="background-color: #FEF2F2; border: 1px solid #FEE2E2; border-radius: 6px; padding: 16px; margin: 20px 0; color: #991B1B;">
          <p style="margin: 0; font-weight: bold;">Reason for Suspension:</p>
          <p style="margin: 8px 0 0 0;">${escapeHtml(reason)}</p>
        </div>
        <p>While suspended, you and your staff will not be able to access the admin panel or utilize the platform services.</p>
        <p>To resolve this issue or appeal the suspension, please contact RestoHub support at <span style="color: #F97316; font-weight: bold;">support@restohub.com</span>.</p>
        <p style="margin-top: 30px; font-size: 12px; color: #888;">Sincerely,<br/>The RestoHub Team</p>
      </div>
    `;

    return await sendEmail({
      to: email,
      subject: EMAIL_SUBJECTS.RESTAURANT_SUSPENDED,
      html,
      emailType: EmailType.OTHER,
    });
  } catch (error) {
    logger.error('Failed to send account suspension email', { error, email });
    return false;
  }
}

export async function sendRestaurantActivatedEmail(
  email: string,
  ownerName: string,
  restaurantName: string
): Promise<boolean> {
  try {
    const html = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-top: 4px solid #10B981; border-radius: 8px; padding: 24px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <h2 style="color: #10B981; margin-top: 0;">Restaurant Account Activated</h2>
        <p>Dear ${escapeHtml(ownerName)},</p>
        <p>We are pleased to inform you that your restaurant account <strong>${escapeHtml(restaurantName)}</strong> has been successfully activated and is now in good standing.</p>
        <p>You and your staff can now log back into the admin panel and resume operations immediately.</p>
        <p>Thank you for choosing RestoHub!</p>
        <p style="margin-top: 30px; font-size: 12px; color: #888;">Sincerely,<br/>The RestoHub Team</p>
      </div>
    `;

    return await sendEmail({
      to: email,
      subject: EMAIL_SUBJECTS.RESTAURANT_ACTIVATED,
      html,
      emailType: EmailType.OTHER,
    });
  } catch (error) {
    logger.error('Failed to send account activation email', { error, email });
    return false;
  }
}

export async function sendUsageWarningEmail(
  email: string,
  ownerName: string,
  restaurantName: string,
  label: string,
  planName: string,
  used: number,
  limit: number,
  billingUrl: string
): Promise<boolean> {
  try {
    let html = getTemplate('usage-warning');

    html = html.replace(/\{\{ownerName\}\}/g, ownerName);
    html = html.replace(/\{\{restaurantName\}\}/g, restaurantName);
    html = html.replace(/\{\{label\}\}/g, label);
    html = html.replace(/\{\{planName\}\}/g, planName);
    html = html.replace(/\{\{used\}\}/g, used.toString());
    html = html.replace(/\{\{limit\}\}/g, limit.toString());
    html = html.replace(/\{\{percent\}\}/g, Math.round((used / limit) * 100).toString());
    html = html.replace(/\{\{billingUrl\}\}/g, billingUrl);

    return await sendEmail({
      to: email,
      subject: EMAIL_SUBJECTS.USAGE_WARNING,
      html,
      emailType: EmailType.OTHER,
    });
  } catch (error) {
    logger.error('Failed to send usage warning email', { error, email });
    return false;
  }
}

export async function sendUsageExceededEmail(
  email: string,
  ownerName: string,
  restaurantName: string,
  label: string,
  planName: string,
  used: number,
  limit: number,
  billingUrl: string
): Promise<boolean> {
  try {
    let html = getTemplate('usage-exceeded');

    html = html.replace(/\{\{ownerName\}\}/g, ownerName);
    html = html.replace(/\{\{restaurantName\}\}/g, restaurantName);
    html = html.replace(/\{\{label\}\}/g, label);
    html = html.replace(/\{\{planName\}\}/g, planName);
    html = html.replace(/\{\{used\}\}/g, used.toString());
    html = html.replace(/\{\{limit\}\}/g, limit.toString());
    html = html.replace(/\{\{billingUrl\}\}/g, billingUrl);

    return await sendEmail({
      to: email,
      subject: EMAIL_SUBJECTS.USAGE_EXCEEDED,
      html,
      emailType: EmailType.OTHER,
    });
  } catch (error) {
    logger.error('Failed to send usage exceeded email', { error, email });
    return false;
  }
}

export async function sendSubscriptionExpiredEmail(
  email: string,
  ownerName: string,
  restaurantName: string,
  planName: string,
  billingUrl: string
): Promise<boolean> {
  try {
    let html = getTemplate('subscription-expired');

    html = html.replace(/\{\{ownerName\}\}/g, ownerName);
    html = html.replace(/\{\{restaurantName\}\}/g, restaurantName);
    html = html.replace(/\{\{planName\}\}/g, planName);
    html = html.replace(/\{\{billingUrl\}\}/g, billingUrl);

    return await sendEmail({
      to: email,
      subject: EMAIL_SUBJECTS.SUBSCRIPTION_EXPIRED,
      html,
      emailType: EmailType.OTHER,
    });
  } catch (error) {
    logger.error('Failed to send subscription expired email', { error, email });
    return false;
  }
}

export async function sendRestaurantDeletedEmail(
  email: string,
  ownerName: string,
  restaurantName: string,
  reason: string
): Promise<boolean> {
  try {
    let html = getTemplate('restaurant-deleted');

    html = html.replace(/\{\{ownerName\}\}/g, ownerName);
    html = html.replace(/\{\{restaurantName\}\}/g, restaurantName);
    html = html.replace(/\{\{reason\}\}/g, reason);

    return await sendEmail({
      to: email,
      subject: 'RestoHub - Notice of Account Deletion',
      html,
      emailType: EmailType.OTHER,
    });
  } catch (error) {
    logger.error('Failed to send account deletion email', { error, email });
    return false;
  }
}

export async function sendMaintenanceNoticeEmailToAllUsers(): Promise<number> {
  try {
    const settings = await getPlatformSettings();
    const platformName = settings.platformName || 'HQ Terminal';
    const supportEmail = settings.supportEmail || 'support@hqterminal.io';

    const restaurants = await RestaurantModel.find({ status: { $ne: 'DELETED' } });
    let sentCount = 0;

    for (const r of restaurants) {
      if (!r.email) continue;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <h2 style="color: #ea580c; margin-top: 0;">⚠️ ${platformName} Maintenance Notice</h2>
          <p style="font-size: 14px; color: #334155;">Dear <strong>${(r as any).owner || r.name || 'Valued Partner'}</strong>,</p>
          <p style="font-size: 14px; color: #334155; line-height: 1.6;">
            Please be advised that <strong>${platformName}</strong> has temporarily entered System Maintenance Mode for platform upgrades and optimizations.
          </p>
          <p style="font-size: 14px; color: #334155; line-height: 1.6;">
            During this period, selected restaurant panels may be temporarily disabled. Our operations team is working to complete all work as quickly as possible.
          </p>
          <p style="font-size: 14px; color: #334155;">
            For urgent inquiries, please contact <a href="mailto:${supportEmail}" style="color: #ea580c; font-weight: bold;">${supportEmail}</a>.
          </p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="font-size: 12px; color: #64748b; margin: 0;">
            © ${new Date().getFullYear()} ${platformName}. All rights reserved.
          </p>
        </div>
      `;

      const success = await sendEmail({
        to: r.email,
        subject: `⚠️ ${platformName} Scheduled System Maintenance Notice`,
        html,
        emailType: EmailType.OTHER,
      });

      if (success) sentCount++;
    }

    logger.info(`Dispatched maintenance notice emails to ${sentCount} restaurant accounts.`);
    return sentCount;
  } catch (error) {
    logger.error('Failed to send maintenance notice emails', { error });
    return 0;
  }
}

export async function sendPaymentFailedEmail(
  email: string,
  customerName: string,
  amount: number,
  currency: string,
  transactionId: string,
  failureReason: string,
  retryUrl?: string,
  paymentType: string = 'Payment Processing'
): Promise<boolean> {
  try {
    let html = getTemplate('payment-failed');

    html = html.replace(/\{\{customerName\}\}/g, customerName);
    html = html.replace(/\{\{amount\}\}/g, amount.toString());
    html = html.replace(/\{\{currency\}\}/g, currency || 'INR');
    html = html.replace(/\{\{transactionId\}\}/g, transactionId || 'N/A');
    html = html.replace(/\{\{failureReason\}\}/g, failureReason || 'Transaction could not be completed');
    html = html.replace(/\{\{retryUrl\}\}/g, retryUrl || '#');
    html = html.replace(/\{\{paymentType\}\}/g, paymentType);

    return await sendEmail({
      to: email,
      subject: EMAIL_SUBJECTS.PAYMENT_FAILED,
      html,
      emailType: EmailType.OTHER,
    });
  } catch (error) {
    logger.error('Failed to send payment failure email', { error, email });
    return false;
  }
}