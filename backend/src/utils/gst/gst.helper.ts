// src/utils/gst/gst.helper.ts
// GSTIN validation and tax breakup calculation utilities.

/**
 * Validates a GSTIN (Goods and Services Tax Identification Number).
 * Format: 2-digit state code + 10-digit PAN + 1 digit entity + 1 digit blank + 1 digit check = 15 chars
 * Basic structural validation (full algorithmic check requires govt API).
 */
export function isValidGstin(gstin: string): boolean {
  if (!gstin || typeof gstin !== 'string') return false;
  const cleaned = gstin.trim().toUpperCase();
  
  // Must be exactly 15 alphanumeric characters
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(cleaned)) {
    return false;
  }

  return true;
}

/**
 * Determines the type of GST based on the state code of the restaurant and customer.
 * If both are in the same state → CGST + SGST (intra-state).
 * If different states → IGST (inter-state).
 * For simplicity, we use the restaurant's state from its settings / gstNumber prefix.
 */
export type GstType = 'CGST_SGST' | 'IGST';

export function determineGstType(
  restaurantStateCode: string,
  customerStateCode?: string,
): GstType {
  if (!customerStateCode || restaurantStateCode === customerStateCode) {
    return 'CGST_SGST';
  }
  return 'IGST';
}

/**
 * Extracts the 2-digit state code from a GSTIN.
 */
export function extractStateCode(gstin: string): string {
  return gstin.trim().substring(0, 2);
}

/**
 * GST breakup result.
 */
export interface GstBreakup {
  taxableAmount: number;
  gstPercentage: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalGst: number;
  gstType: GstType;
  grandTotal: number;
}

/**
 * Calculates GST breakup on the taxable amount after discounts.
 * 
 * @param taxableAmount - Amount after discounts (subtotal - discount)
 * @param gstPercentage - Total GST percentage (e.g. 5, 12, 18, 28)
 * @param gstType - CGST_SGST (intra-state) or IGST (inter-state)
 */
export function calculateGst(
  taxableAmount: number,
  gstPercentage: number,
  gstType: GstType = 'CGST_SGST',
): GstBreakup {
  if (taxableAmount <= 0 || gstPercentage <= 0) {
    return {
      taxableAmount: Math.max(0, taxableAmount),
      gstPercentage: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      totalGst: 0,
      gstType,
      grandTotal: Math.max(0, taxableAmount),
    };
  }

  const totalGst = roundToTwo((taxableAmount * gstPercentage) / 100);
  
  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  if (gstType === 'CGST_SGST') {
    // CGST = SGST = half of total GST
    cgst = roundToTwo(totalGst / 2);
    sgst = roundToTwo(totalGst / 2);
    // Handle odd paise rounding: ensure cgst + sgst = totalGst
    const sum = cgst + sgst;
    if (sum !== totalGst) {
      cgst = roundToTwo(cgst + (totalGst - sum));
    }
  } else {
    igst = totalGst;
  }

  const grandTotal = roundToTwo(taxableAmount + totalGst);

  return {
    taxableAmount: roundToTwo(taxableAmount),
    gstPercentage: roundToTwo(gstPercentage),
    cgst,
    sgst,
    igst,
    totalGst,
    gstType,
    grandTotal,
  };
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}
