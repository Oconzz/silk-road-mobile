import {Platform, Share} from 'react-native';
import {generatePDF} from 'react-native-html-to-pdf';
import RNShare from 'react-native-share';
import Config from 'react-native-config';
import type {Estimate} from '../types/estimate';

// Build public share URL for an estimate
const getEstimateShareUrl = (estimate: Estimate): string | null => {
  const shareUrl = (estimate as any).publicShareUrl;
  const shareId = (estimate as any).publicShareId;
  if (shareUrl) {
    const apiUrl = Config.API_URL || 'https://staging-api.silkroadapp.com';
    return `${apiUrl}${shareUrl}`;
  }
  if (shareId) {
    const apiUrl = Config.API_URL || 'https://staging-api.silkroadapp.com';
    return `${apiUrl}/Estimates/view/${shareId}`;
  }
  return null;
};

// PDF Generation Service for Estimates
// Uses HTML template approach with SilkRoad branding

export interface PDFGenerationResult {
  success: boolean;
  filePath?: string;
  htmlContent?: string;
  error?: string;
}

// SilkRoad Brand Colors
const BRAND = {
  primary: '#004732',
  primaryLight: '#006644',
  accent: '#C9A227',
  background: '#FAFAFA',
  text: '#1A1A1A',
  textSecondary: '#666666',
  border: '#E5E5E5',
  success: '#28A745',
};

// Format currency
const formatCurrency = (amount: number): string => {
  return `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

// Format date
const formatDate = (dateString?: string): string => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

// Generate HTML content for the estimate with SilkRoad branding
export const generateEstimateHTML = (estimate: Estimate): string => {
  const items = estimate.inventory || estimate.lineItems || [];
  const lineItemsHTML = items
    .map(
      (item, index) => `
      <tr class="${index % 2 === 0 ? 'row-even' : 'row-odd'}">
        <td class="cell cell-num">${index + 1}</td>
        <td class="cell cell-desc">${item.title || item.description}</td>
        <td class="cell cell-center">${item.quantity}</td>
        <td class="cell cell-right">${formatCurrency(item.price)}</td>
        <td class="cell cell-right cell-total">${formatCurrency(item.price * item.quantity)}</td>
      </tr>
    `
    )
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Estimate ${estimate.estimateNumber || estimate.id}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        @page {
          size: A4;
          margin: 0;
        }
        
        body {
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          color: ${BRAND.text};
          background: #fff;
          line-height: 1.5;
          font-size: 14px;
        }
        
        .document {
          max-width: 800px;
          margin: 0 auto;
          background: #fff;
        }
        
        /* Header with Logo */
        .header {
          background: linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.primaryLight} 100%);
          color: white;
          padding: 40px;
          position: relative;
        }
        
        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        
        .brand {
          display: flex;
          align-items: center;
          gap: 15px;
        }
        
        .logo {
          width: 60px;
          height: 60px;
          background: white;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          font-weight: bold;
          color: ${BRAND.primary};
        }
        
        .brand-text {
          display: flex;
          flex-direction: column;
        }
        
        .brand-name {
          font-size: 28px;
          font-weight: 700;
          letter-spacing: 1px;
        }
        
        .brand-tagline {
          font-size: 12px;
          opacity: 0.8;
          letter-spacing: 2px;
          text-transform: uppercase;
        }
        
        .estimate-badge {
          background: ${BRAND.accent};
          color: ${BRAND.primary};
          padding: 8px 20px;
          border-radius: 30px;
          font-weight: 600;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        
        /* Estimate Info Bar */
        .info-bar {
          background: ${BRAND.background};
          padding: 25px 40px;
          display: flex;
          justify-content: space-between;
          border-bottom: 1px solid ${BRAND.border};
        }
        
        .info-item {
          text-align: center;
        }
        
        .info-label {
          font-size: 11px;
          color: ${BRAND.textSecondary};
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 5px;
        }
        
        .info-value {
          font-size: 16px;
          font-weight: 600;
          color: ${BRAND.primary};
        }
        
        .info-value.highlight {
          color: ${BRAND.primary};
        }
        
        /* Main Content */
        .content {
          padding: 40px;
        }
        
        /* Client Section */
        .client-section {
          display: flex;
          gap: 40px;
          margin-bottom: 35px;
        }
        
        .client-box {
          flex: 1;
          background: ${BRAND.background};
          border-radius: 12px;
          padding: 20px;
          border-left: 4px solid ${BRAND.primary};
        }
        
        .section-label {
          font-size: 11px;
          color: ${BRAND.textSecondary};
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 10px;
        }
        
        .client-name {
          font-size: 18px;
          font-weight: 600;
          color: ${BRAND.text};
          margin-bottom: 5px;
        }
        
        .client-details {
          font-size: 14px;
          color: ${BRAND.textSecondary};
          line-height: 1.6;
        }
        
        /* Description */
        .description-box {
          background: linear-gradient(135deg, ${BRAND.primary}08 0%, ${BRAND.primary}03 100%);
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 35px;
          border: 1px solid ${BRAND.primary}20;
        }
        
        .description-text {
          font-size: 14px;
          color: ${BRAND.text};
          line-height: 1.7;
        }
        
        /* Table */
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        
        .items-table thead {
          background: ${BRAND.primary};
          color: white;
        }
        
        .items-table th {
          padding: 15px 12px;
          text-align: left;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .items-table th.center { text-align: center; }
        .items-table th.right { text-align: right; }
        
        .cell {
          padding: 15px 12px;
          border-bottom: 1px solid ${BRAND.border};
        }
        
        .cell-num {
          width: 50px;
          color: ${BRAND.textSecondary};
          font-weight: 500;
        }
        
        .cell-desc {
          font-weight: 500;
        }
        
        .cell-center { text-align: center; }
        .cell-right { text-align: right; }
        
        .cell-total {
          font-weight: 600;
          color: ${BRAND.primary};
        }
        
        .row-even { background: #fff; }
        .row-odd { background: ${BRAND.background}; }
        
        /* Totals Section */
        .totals-wrapper {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 40px;
        }
        
        .totals-box {
          width: 300px;
          background: ${BRAND.background};
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        
        .total-row {
          display: flex;
          justify-content: space-between;
          padding: 15px 20px;
          border-bottom: 1px solid ${BRAND.border};
        }
        
        .total-row:last-child {
          border-bottom: none;
        }
        
        .total-label {
          color: ${BRAND.textSecondary};
          font-size: 14px;
        }
        
        .total-value {
          font-weight: 600;
          color: ${BRAND.text};
        }
        
        .grand-total {
          background: ${BRAND.primary};
          color: white;
        }
        
        .grand-total .total-label {
          color: white;
          font-weight: 600;
          font-size: 16px;
        }
        
        .grand-total .total-value {
          color: white;
          font-size: 22px;
          font-weight: 700;
        }
        
        /* Footer */
        .footer {
          background: ${BRAND.background};
          padding: 30px 40px;
          text-align: center;
          border-top: 1px solid ${BRAND.border};
        }
        
        .footer-message {
          font-size: 16px;
          color: ${BRAND.primary};
          font-weight: 500;
          margin-bottom: 10px;
        }
        
        .footer-brand {
          font-size: 12px;
          color: ${BRAND.textSecondary};
          letter-spacing: 1px;
        }
        
        .footer-brand strong {
          color: ${BRAND.primary};
        }
        
        /* Validity Notice */
        .validity-notice {
          background: linear-gradient(135deg, ${BRAND.accent}15 0%, ${BRAND.accent}05 100%);
          border: 1px solid ${BRAND.accent}40;
          border-radius: 8px;
          padding: 12px 20px;
          margin-bottom: 25px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .validity-icon {
          font-size: 18px;
        }
        
        .validity-text {
          font-size: 13px;
          color: ${BRAND.text};
        }
        
        .validity-date {
          font-weight: 600;
          color: ${BRAND.primary};
        }
      </style>
    </head>
    <body>
      <div class="document">
        <!-- Header -->
        <div class="header">
          <div class="header-content">
            <div class="brand">
              <div class="logo">SR</div>
              <div class="brand-text">
                <div class="brand-name">SilkRoad</div>
                <div class="brand-tagline">Professional Estimates</div>
              </div>
            </div>
            <div class="estimate-badge">Estimate</div>
          </div>
        </div>
        
        <!-- Info Bar -->
        <div class="info-bar">
          <div class="info-item">
            <div class="info-label">Estimate Number</div>
            <div class="info-value">${estimate.estimateNumber || `EST-${estimate.id.slice(-6).toUpperCase()}`}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Proposed Start Date</div>
            <div class="info-value">${formatDate((estimate as any).proposedStartDate || estimate.createDatetime)}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Valid Until</div>
            <div class="info-value highlight">${formatDate(estimate.expirationDate)}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Total Amount</div>
            <div class="info-value highlight">${formatCurrency(estimate.total)}</div>
          </div>
        </div>
        
        <!-- Main Content -->
        <div class="content">
          <!-- Client Section -->
          ${estimate.client ? `
          <div class="client-section">
            <div class="client-box">
              <div class="section-label">Address To</div>
              <div class="client-name">${estimate.client.contactName}</div>
              ${estimate.client.email ? `<div class="client-details">${estimate.client.email}</div>` : ''}
              ${estimate.client.phone ? `<div class="client-details">${estimate.client.phone}</div>` : ''}
            </div>
            ${estimate.location ? `
            <div class="client-box">
              <div class="section-label">Service Location</div>
              <div class="client-name">${estimate.location.addressLine1}</div>
              <div class="client-details">
                ${estimate.location.city}, ${estimate.location.state} ${estimate.location.zipcode || ''}
              </div>
            </div>
            ` : ''}
          </div>
          ` : ''}
          
          <!-- Validity Notice -->
          ${estimate.expirationDate ? `
          <div class="validity-notice">
            <span class="validity-icon">📅</span>
            <span class="validity-text">
              This estimate is valid until <span class="validity-date">${formatDate(estimate.expirationDate)}</span>
            </span>
          </div>
          ` : ''}
          
          <!-- Description -->
          ${estimate.description ? `
          <div class="description-box">
            <div class="section-label">Project Description</div>
            <div class="description-text">${estimate.description}</div>
          </div>
          ` : ''}
          
          <!-- Line Items Table -->
          <table class="items-table">
            <thead>
              <tr>
                <th style="width: 50px;">#</th>
                <th>Description</th>
                <th class="center" style="width: 80px;">Qty</th>
                <th class="right" style="width: 120px;">Unit Price</th>
                <th class="right" style="width: 120px;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${lineItemsHTML}
            </tbody>
          </table>
          
          <!-- Totals -->
          <div class="totals-wrapper">
            <div class="totals-box">
              <div class="total-row">
                <span class="total-label">Subtotal</span>
                <span class="total-value">${formatCurrency(estimate.total)}</span>
              </div>
              <div class="total-row">
                <span class="total-label">Tax</span>
                <span class="total-value">$0.00</span>
              </div>
              <div class="total-row grand-total">
                <span class="total-label">Total Due</span>
                <span class="total-value">${formatCurrency(estimate.total)}</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Footer -->
        <div class="footer">
          <div class="footer-message">Thank you for your business!</div>
          <div class="footer-brand">Powered by <strong>SilkRoad</strong></div>
        </div>
      </div>
    </body>
    </html>
  `;

  return html;
};

// Generate PDF file from estimate
export const generateEstimatePDF = async (
  estimate: Estimate
): Promise<PDFGenerationResult> => {
  try {
    const htmlContent = generateEstimateHTML(estimate);
    const fileName = `Estimate_${estimate.estimateNumber || estimate.id.slice(-6)}`;
    
    const options = {
      html: htmlContent,
      fileName: fileName,
      directory: 'Documents',
      base64: false,
    };

    const file = await generatePDF(options);
    
    return {
      success: true,
      filePath: file.filePath,
      htmlContent,
    };
  } catch (error) {
    console.error('[PDFService] Error generating PDF:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

// Share estimate as PDF file
export const shareEstimateAsPDF = async (estimate: Estimate): Promise<void> => {
  try {
    const result = await generateEstimatePDF(estimate);
    
    if (!result.success || !result.filePath) {
      throw new Error(result.error || 'Failed to generate PDF');
    }

    const shareOptions = {
      title: `Estimate ${estimate.estimateNumber || estimate.id}`,
      url: Platform.OS === 'ios' ? result.filePath : `file://${result.filePath}`,
      type: 'application/pdf',
      filename: `Estimate_${estimate.estimateNumber || estimate.id.slice(-6)}.pdf`,
    };

    await RNShare.open(shareOptions);
  } catch (error: any) {
    if (error?.message === 'User did not share') {
      return;
    }
    console.error('[PDFService] Error sharing PDF:', error);
    throw error;
  }
};

// Share estimate as text (fallback)
export const shareEstimateAsText = async (estimate: Estimate): Promise<void> => {
  try {
    await shareEstimateAsPDF(estimate);
  } catch (error) {
    console.error('[PDFService] PDF share failed, falling back to text:', error);
    
    const fallbackItems = estimate.inventory || estimate.lineItems || [];
    const lineItemsText = fallbackItems
      .map(
        (item, index) =>
          `${index + 1}. ${item.title || item.description} - Qty: ${item.quantity} - ${formatCurrency(item.price * item.quantity)}`
      )
      .join('\n');

    const message = `
ESTIMATE ${estimate.estimateNumber || estimate.id}
${estimate.name}

${estimate.client ? `Client: ${estimate.client.contactName}` : ''}
${estimate.location ? `Location: ${estimate.location.city}, ${estimate.location.state}` : ''}

Created: ${formatDate(estimate.createDatetime)}
${estimate.expirationDate ? `Expires: ${formatDate(estimate.expirationDate)}` : ''}

${estimate.description ? `Description:\n${estimate.description}\n` : ''}

LINE ITEMS:
${lineItemsText}

TOTAL: ${formatCurrency(estimate.total)}
    `.trim();

    await Share.share({
      message,
      title: `Estimate ${estimate.estimateNumber || estimate.id}`,
    });
  }
};

// Share via SMS - sends the public share link
export const shareViaSMS = async (
  estimate: Estimate,
  phoneNumber?: string
): Promise<void> => {
  // Build the public share URL
  const shareUrl = getEstimateShareUrl(estimate);
  const message = shareUrl
    ? `View your estimate from SilkRoad: ${shareUrl}`
    : `Estimate ${estimate.estimateNumber || estimate.id} for ${estimate.name}. Total: ${formatCurrency(estimate.total)}.`;

  // On iOS/Android, we can use the Share API or linking
  const smsUrl = Platform.select({
    ios: `sms:${phoneNumber || ''}&body=${encodeURIComponent(message)}`,
    android: `sms:${phoneNumber || ''}?body=${encodeURIComponent(message)}`,
  });

  if (smsUrl) {
    const {Linking} = require('react-native');
    const canOpen = await Linking.canOpenURL(smsUrl);
    if (canOpen) {
      await Linking.openURL(smsUrl);
    } else {
      throw new Error('SMS not available on this device');
    }
  }
};

// Share via Email - sends the public share link
export const shareViaEmail = async (
  estimate: Estimate,
  email?: string
): Promise<void> => {
  const shareUrl = getEstimateShareUrl(estimate);
  const subject = `Estimate ${estimate.estimateNumber || estimate.id} - ${estimate.name}`;
  const body = shareUrl
    ? `Dear ${estimate.client?.contactName || 'Customer'},\n\nPlease review the estimate for ${estimate.name}.\n\nView Estimate: ${shareUrl}\n\nTotal: ${formatCurrency(estimate.total)}\n${estimate.expirationDate ? `Valid Until: ${formatDate(estimate.expirationDate)}\n` : ''}\nThank you for your business!`
    : `Dear ${estimate.client?.contactName || 'Customer'},\n\nPlease find below the estimate for ${estimate.name}.\n\nEstimate Number: ${estimate.estimateNumber || estimate.id}\nTotal: ${formatCurrency(estimate.total)}\n${estimate.expirationDate ? `Valid Until: ${formatDate(estimate.expirationDate)}\n` : ''}${estimate.description ? `\nDescription:\n${estimate.description}\n` : ''}\nThank you for your business!`;

  const emailUrl = `mailto:${email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  const {Linking} = require('react-native');
  const canOpen = await Linking.canOpenURL(emailUrl);
  if (canOpen) {
    await Linking.openURL(emailUrl);
  } else {
    throw new Error('Email not available on this device');
  }
};

export default {
  generateEstimateHTML,
  generateEstimatePDF,
  shareEstimateAsText,
  shareViaSMS,
  shareViaEmail,
};
