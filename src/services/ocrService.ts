import MlkitOcr, {
  MlkitOcrResult,
  MKLBlock,
  MLKTextLine,
  Bounding,
} from 'react-native-mlkit-ocr';
import type { InventoryItem } from '../types/navigation';

/**
 * OCR Service using Google ML Kit for on-device text recognition
 * Provides receipt scanning and parsing capabilities
 */

export interface OCRBlock {
  text: string;
  cornerPoints?: Array<{ x: number; y: number }>;
  frame?: { x: number; y: number; width: number; height: number };
}

// ===== ZIPPER LAYOUT TYPES =====
// Used for layout-aware pre-processing of OCR results

type OCRLine = {
  text: string;
  bounding: Bounding;
};

type OCRRow = {
  top: number; // y-coordinate of the row
  items: OCRLine[];
};

export interface ReceiptMetadata {
  date: string;
  store: string;
  total: number;
}

export interface ParsedReceiptResult {
  items: InventoryItem[];
  metadata: ReceiptMetadata;
  sanityCheck: {
    itemsTotal: number;
    receiptTotal: number;
    difference: number;
    isValid: boolean;
    message: string;
  };
}

/**
 * Recognizes text from an image URI using ML Kit OCR
 */
export const recognizeTextFromImage = async (
  imageUri: string,
): Promise<MlkitOcrResult> => {
  try {
    const result = await MlkitOcr.detectFromUri(imageUri);
    return result;
  } catch (error) {
    console.error('[OCR Service] Error recognizing text:', error);
    throw new Error('Failed to recognize text from image');
  }
};

/**
 * ZIPPER LAYOUT NORMALIZATION
 * 
 * Processes ML Kit OCR result using layout information (bounding boxes)
 * to reconstruct proper reading order for multi-column receipts.
 * 
 * The problem: ML Kit returns text blocks/lines separately, even when they
 * visually appear on the same row (e.g., item name on left, price on right).
 * 
 * The solution:
 * 1. Extract all lines from all blocks with their bounding boxes
 * 2. Sort by vertical position (top -> bottom)
 * 3. Group lines with similar Y coordinates into "rows"
 * 4. Sort horizontally within each row (left -> right)
 * 5. Join texts to produce clean, human-readable lines
 * 
 * Example:
 * Input lines from ML Kit:
 *   ["23536 OATEY 14-02 PLUMBERS", bounding: {left: 10, top: 200}]
 *   ["PUTT", bounding: {left: 200, top: 205}]
 *   ["2.99", bounding: {left: 300, top: 202}]
 * 
 * Output: "23536 OATEY 14-02 PLUMBERS PUTT 2.99"
 */
export const processOCRResult = (result: MlkitOcrResult): string[] => {
  const allLines: OCRLine[] = [];

  // 1) Flatten: extract all lines from all blocks
  result.forEach((block: MKLBlock) => {
    if (Array.isArray(block.lines) && block.lines.length > 0) {
      // Extract individual lines with their bounding boxes
      block.lines.forEach((line: MLKTextLine) => {
        if (line?.text && line?.bounding) {
          allLines.push({
            text: String(line.text),
            bounding: line.bounding,
          });
        }
      });
    } else if (block?.text && block?.bounding) {
      // Fallback: use block-level text if no lines available
      allLines.push({
        text: String(block.text),
        bounding: block.bounding,
      });
    }
  });

  if (allLines.length === 0) {
    console.log('[OCR Layout] No lines extracted from result');
    return [];
  }

  console.log('[OCR Layout] Extracted', allLines.length, 'lines from OCR result');

  // 2) Sort vertically (top -> bottom)
  allLines.sort((a, b) => a.bounding.top - b.bounding.top);

  // 3) Group by row (zip lines with similar Y coordinates)
  // Y_TOLERANCE accounts for slight skew in receipt images
  const rows: OCRRow[] = [];
  const Y_TOLERANCE = 15; // pixels - adjust if needed for skewed receipts

  allLines.forEach(line => {
    const lastRow = rows[rows.length - 1];

    if (lastRow && Math.abs(line.bounding.top - lastRow.top) < Y_TOLERANCE) {
      // Same row - add to existing
      lastRow.items.push(line);
    } else {
      // New row
      rows.push({
        top: line.bounding.top,
        items: [line],
      });
    }
  });

  console.log('[OCR Layout] Grouped into', rows.length, 'rows');

  // 4) Sort horizontally (left -> right) and join text in each row
  const cleanedLines = rows.map(row => {
    row.items.sort((a, b) => a.bounding.left - b.bounding.left);
    return row.items.map(item => item.text.trim()).join(' ');
  });

  // Log sample of cleaned lines for debugging
  console.log('[OCR Layout] Sample cleaned lines:');
  cleanedLines.slice(0, 10).forEach((line, i) => {
    console.log(`  [${i}] ${line}`);
  });

  return cleanedLines;
};

/**
 * Converts ML Kit OCR result to a single text string
 * Uses layout-aware processing to properly order multi-column receipts
 */
export const ocrResultToText = (result: MlkitOcrResult): string => {
  // Use zipper layout normalization for better column handling
  const cleanedLines = processOCRResult(result);
  const text = cleanedLines.join('\n');

  console.log('[OCR] Cleaned text sample:', text.substring(0, 400));
  console.log('[OCR] Total cleaned lines:', cleanedLines.length);

  return text;
};

/**
 * Universal Receipt Parser
 * Supports multiple receipt formats worldwide:
 * - Hardware stores (Lowe's, Home Depot, Leroy Merlin, Menards, Ace)
 * - Delivery apps (DoorDash, UberEats, Grubhub)
 * - Grocery stores (Walmart, Target, Costco)
 * - European formats (comma as decimal)
 */
export const parseReceiptText = (text: string): InventoryItem[] => {
  const items: InventoryItem[] = [];
  const rawLines = text.split('\n').map(line => line.trim()).filter(Boolean);

  // ===== MULTI-LINE PRODUCT MERGING (internal) =====
  // Some receipts have product names split across multiple lines
  const mergeMultiLineProductsInternal = (inputLines: string[]): string[] => {
    const result: string[] = [];
    let i = 0;

    while (i < inputLines.length) {
      const line = inputLines[i].trim();

      if (!line) {
        i++;
        continue;
      }

      const hasPrice = /\$?\s*\d{1,5}[.,]\d{2}\s*$/.test(line);
      const isPriceOnly = /^\$?\s*\d{1,5}[.,]\d{2}\s*$/.test(line);
      const isSkuLine = /^\d{4,13}\s+[A-Z]/.test(line);

      // If this is a SKU line or line without price, check if next line is a continuation
      if ((isSkuLine || (!hasPrice && !isPriceOnly)) && i + 1 < inputLines.length) {
        const nextLine = inputLines[i + 1].trim();
        // Continuation lines: start with letter or number (e.g., "2X8"), at least 3 chars, and NOT a price
        const nextIsContinuation = /^[A-Z0-9][A-Z0-9\s#&'.-]{2,}$/i.test(nextLine) && !/^\$?\s*\d{1,5}[.,]\d{2}$/.test(nextLine);

        if (nextIsContinuation) {
          result.push(`${line} ${nextLine}`);
          i += 2;
          console.log('[OCR Multi-line] Merged:', line, '+', nextLine);
          continue;
        }
      }

      result.push(line);
      i++;
    }

    return result;
  };

  // Pre-process: merge multi-line product names
  const lines = mergeMultiLineProductsInternal(rawLines);

  console.log('[OCR Parser] Processing', lines.length, 'lines (from', rawLines.length, 'raw lines)');
  console.log('[OCR Parser] Raw text sample:', text.substring(0, 300));

  let itemCounter = 0;

  // ===== HELPER FUNCTIONS =====

  // Normalize price string (handle European comma format and OCR artifacts)
  // Handles cases like: "$4.", "$2. .00", "2.99", "19,80"
  const normalizePrice = (str: string): string => {
    let s = str
      .replace(/\s+/g, '')           // Remove all spaces (fixes "$2. .00" -> "$2..00")
      .replace(/\.+/g, '.')          // Multiple dots to single (fixes "$2..00" -> "$2.00")
      .replace(/,/g, '.');           // Convert comma to dot (European format)

    // If ends with just "." add "00" (fixes "$4." -> "$4.00")
    if (/\.\s*$/.test(s)) {
      s = s.replace(/\.\s*$/, '.00');
    }

    return s;
  };

  // Extract price value from a string - very flexible to handle OCR errors
  const extractPrice = (str: string): number | null => {
    const normalized = normalizePrice(str);

    // Try full price with cents
    const match = normalized.match(/\$?(\d{1,5})\.(\d{1,2})/);
    if (match) {
      const cents = match[2].padEnd(2, '0'); // "9" -> "90"
      const price = parseFloat(`${match[1]}.${cents}`);
      if (price >= 0.01 && price < 10000) {
        return price;
      }
    }

    // Try integer price (e.g., "$25" or "25")
    const intMatch = normalized.match(/\$?(\d{1,4})$/);
    if (intMatch) {
      const price = parseFloat(intMatch[1]);
      if (price >= 1 && price < 1000) {
        return price;
      }
    }

    return null;
  };

  // Check if a line is metadata/noise that should be skipped
  const isMetadataLine = (line: string): boolean => {
    const metadataPatterns = [
      // Totals
      /^SUBTOTAL/i, /^TOTAL/i, /SUMA\s*(PLN|EUR|USD)?/i,
      /^TAX\b/i, /^SALES\s*TAX/i, /Podatek/i,
      // Tax category indicators (Home Depot: "SALES A", "<A>")
      /^SALES\s+[A-Z]$/i, /^<[A-Z]>$/i,
      // Delivery fees
      /DELIVERY\s*FEE/i, /SERVICE\s*FEE/i, /^TIP$/i,
      // Payment methods and gift cards
      /^CASH\b/i, /^CARD\b/i, /^VISA\b/i, /^MASTER/i, /KARTA\s*BANK/i, /Płatność/i,
      /GIFT\s*CARD/i, /CARD\s*BALANCE/i, /^DEBIT\b/i, /^CREDIT\b/i,
      // Store info
      /^RECEIPT$/i, /PARAGON/i, /^NIP\s/i, /^Tel\./i,
      // Promo/footer
      /THANK\s*YOU/i, /ZAPRASZAMY/i, /ENJOY\s*YOUR/i,
      /\.COM\b/i, /RETURN\s*POLI/i,
      // Codes and IDs
      /^Nr\s*(rej|transakcji)/i, /Serwisant/i,
      /^[A-Z0-9]{15,}$/,  // Long alphanumeric codes
    ];
    return metadataPatterns.some(p => p.test(line));
  };

  // Check if line is a price-only line (European format: "19,80 19,80 A" or "7,80")
  const isPriceOnlyLine = (line: string): { prices: number[] } | null => {
    // European format: "19,80 19,80 A" or "7,80 7,80 A" or just "7,80"
    const europeanPattern = /^(\d{1,5}[.,]\d{2})\s*(\d{1,5}[.,]\d{2})?\s*[A-Z]?\s*$/;
    const match = line.match(europeanPattern);
    if (match) {
      const prices: number[] = [];
      if (match[1]) {
        const p = extractPrice(match[1]);
        if (p) prices.push(p);
      }
      if (match[2]) {
        const p = extractPrice(match[2]);
        if (p) prices.push(p);
      }
      if (prices.length > 0) return { prices };
    }

    // US format: "$25.00" or "25.00"
    const usPattern = /^\$?\s*(\d{1,5}[.,]\d{0,2})\s*$/;
    const usMatch = line.match(usPattern);
    if (usMatch) {
      const p = extractPrice(usMatch[1]);
      if (p) return { prices: [p] };
    }

    return null;
  };

  // Detect receipt type
  const detectReceiptType = (): 'european' | 'delivery' | 'hardware' | 'generic' => {
    const fullText = text.toUpperCase();

    if (/DOORDASH|UBEREATS|GRUBHUB|DELIVERY\s*FEE/i.test(fullText)) {
      return 'delivery';
    }
    if (/LEROY|MERLIN|PARAGON|PLN|ZAPRASZAMY|NIP\s*\d/i.test(fullText)) {
      return 'european';
    }
    if (/LOWE'?S|HOME\s*DEPOT|H[0O]\s*DEPOT|MENARDS|ACE\s*HARDWARE/i.test(fullText)) {
      return 'hardware';
    }
    // Check for European price format (comma as decimal)
    if (/\d+,\d{2}\s+\d+,\d{2}\s*[A-Z]/.test(text)) {
      return 'european';
    }
    return 'generic';
  };

  const receiptType = detectReceiptType();
  console.log('[OCR Parser] Detected receipt type:', receiptType);

  // ===== PARSING STRATEGIES =====

  interface ProductCandidate {
    lineIndex: number;
    sku?: string;
    name: string;
    price?: number;
    quantity: number;
  }

  const candidates: ProductCandidate[] = [];

  // Strategy 1: European Format (Leroy Merlin, etc.)
  // Pattern: SKU + Name on line 1, Price on line 2
  if (receiptType === 'european') {
    console.log('[OCR Parser] Using European parsing strategy');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (isMetadataLine(line)) continue;

      // Check for SKU (6-10 digits) + product name
      const skuMatch = line.match(/^(\d{6,10})\s+(.+)$/);
      if (skuMatch) {
        const sku = skuMatch[1];
        const productName = skuMatch[2].trim();

        // Look for price in next few lines
        let price: number | undefined;
        for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
          const priceLine = isPriceOnlyLine(lines[j]);
          if (priceLine && priceLine.prices.length > 0) {
            // Take the first price (unit price) or last price (total)
            price = priceLine.prices[0];
            break;
          }
        }

        if (productName.length >= 3) {
          candidates.push({
            lineIndex: i,
            sku,
            name: productName,
            price,
            quantity: 1,
          });
          console.log('[OCR Parser] European item:', sku, productName, price);
        }
      }
    }
  }

  // Strategy 2: Delivery App Format (DoorDash, UberEats)
  // Pattern: "2 CHEESEBURGER" with prices in separate column below
  if (receiptType === 'delivery' || candidates.length === 0) {
    console.log('[OCR Parser] Using Delivery App parsing strategy');

    // First, collect ALL price-like values from the entire receipt
    // Handle OCR errors like "$4.", "$2. .00", "$31.00"
    const allPrices: Array<{ index: number; price: number; raw: string }> = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip metadata lines that might contain total/fees
      if (/SUBTOTAL|^TOTAL|DELIVERY\s*FEE|SERVICE\s*FEE|^TIP$/i.test(line)) continue;

      // Try to extract price from line
      const price = extractPrice(line);
      if (price && price > 0 && price < 500) {
        allPrices.push({ index: i, price, raw: line });
        console.log('[OCR Parser] Collected price:', price, 'from line:', line);
      }
    }

    // Find product lines (start with quantity)
    const productLines: Array<{ index: number; quantity: number; name: string }> = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (isMetadataLine(line)) continue;

      // Pattern: "2 CHEESEBURGER" or "1 FRIES" or "1 SMALL SODA"
      const qtyMatch = line.match(/^(\d{1,2})\s+([A-Z][A-Z\s]+)$/i);
      if (qtyMatch) {
        const quantity = parseInt(qtyMatch[1], 10);
        const productName = qtyMatch[2].trim();

        // Skip fee/tax lines
        if (/FEE|TAX|TIP|TOTAL|SUBTOTAL|RECEIPT|DATE/i.test(productName)) continue;

        if (productName.length >= 3 && quantity >= 1 && quantity <= 20) {
          productLines.push({ index: i, quantity, name: productName });
          console.log('[OCR Parser] Found product:', quantity, 'x', productName, 'at line', i);
        }
      }
    }

    // Match products with prices by position
    // In delivery receipts, prices often appear in the same order as products
    console.log('[OCR Parser] Matching', productLines.length, 'products with', allPrices.length, 'prices');

    for (let i = 0; i < productLines.length; i++) {
      const product = productLines[i];
      // Use prices in order (first product gets first price, etc.)
      const priceData = i < allPrices.length ? allPrices[i] : undefined;

      candidates.push({
        lineIndex: product.index,
        name: product.name,
        price: priceData?.price,
        quantity: product.quantity,
      });
      console.log('[OCR Parser] Delivery item:', product.quantity, 'x', product.name, '=', priceData?.price);
    }
  }

  // Strategy 3: Hardware Store Format (Lowe's, Home Depot, Menards, Ace)
  // Real-world formats from OCR:
  // Home Depot format:
  //   63254 24" WHITE VAN. W/CULT. MARBLE    ← SKU + Name
  //   GLAC BAY BATH VAN. WITH SINK           ← Description continuation
  //   3@64. 90                                ← QTY @ PRICE
  // Lowe's format:
  //   23536 0ATEY 14-02 PLUMBERS PUTT        ← SKU + Name (price on separate line)
  //   2.99                                    ← Price only
  if (receiptType === 'hardware' || candidates.length === 0) {
    console.log('[OCR Parser] Using Hardware Store parsing strategy');

    // First pass: collect all QTY@PRICE lines and standalone prices
    // Also track where SUBTOTAL/TOTAL lines appear to filter out total prices
    const qtyPriceLines: Array<{ line: number; qty: number; price: number }> = [];
    const standalonePrices: Array<{ line: number; price: number; beforeSubtotal: boolean }> = [];
    let subtotalLine = -1;

    // Find SUBTOTAL/TOTAL line to exclude prices after it
    for (let i = 0; i < lines.length; i++) {
      if (/SUBTOTAL|^TOTAL|INVOICE.*TOTAL/i.test(lines[i])) {
        subtotalLine = i;
        console.log('[OCR Parser] Found SUBTOTAL/TOTAL at line', i);
        break;
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // Normalize OCR spacing in prices: "3@64. 90" -> "3@64.90", "99. 00" -> "99.00"
      const normalizedLine = line.replace(/(\d)[.,]\s+(\d)/g, '$1.$2');

      // Match QTY@PRICE or QTYxPRICE format: "3@64.90", "2@36.55", "2x7.57"
      // Note: allow trailing text like total price on same line
      const qtyPriceMatch = normalizedLine.match(/^(\d{1,2})\s*[@xX]\s*(\d{1,5}[.,]\d{2})(?:\s+.*)?$/);
      if (qtyPriceMatch) {
        const qty = parseInt(qtyPriceMatch[1], 10);
        const price = extractPrice(qtyPriceMatch[2]);
        if (price && qty >= 1 && qty <= 99) {
          qtyPriceLines.push({ line: i, qty, price });
          console.log('[OCR Parser] Found QTY@PRICE:', qty, '@', price, 'at line', i);
        }
        continue;
      }

      // Match standalone price lines: "2.99", "99.00", "194. 70"
      // Collect all prices - we'll prioritize based on position later
      const isPriceOnly = /^\d{1,4}[.,]\s*\d{2}$/.test(normalizedLine);
      if (isPriceOnly) {
        const price = extractPrice(normalizedLine);
        if (price && price > 0 && price < 500) {
          standalonePrices.push({ line: i, price, beforeSubtotal: subtotalLine === -1 || i < subtotalLine });
          console.log('[OCR Parser] Found standalone price:', price, 'at line', i, subtotalLine === -1 || i < subtotalLine ? '(before subtotal)' : '(after subtotal)');
        }
      }
    }

    // Separate prices before/after subtotal
    const pricesBeforeSubtotal = standalonePrices.filter(p => p.beforeSubtotal);

    // For prices after subtotal, filter out SUBTOTAL/TAX/TOTAL values
    // These typically appear in the first 5 lines after SUBTOTAL
    // Count how many metadata lines are between subtotal and products
    let metadataAfterSubtotal = 0;
    if (subtotalLine >= 0) {
      for (let i = subtotalLine; i < Math.min(subtotalLine + 10, lines.length); i++) {
        if (/SUBTOTAL|^TAX|TOTAL|INVOICE|MERCH|GIFT|DEBIT|CREDIT|BEGIN|ENDING|BALANCE/i.test(lines[i])) {
          metadataAfterSubtotal++;
        }
      }
    }
    console.log('[OCR Parser] Found', metadataAfterSubtotal, 'metadata lines after subtotal');

    // Skip the first N prices after subtotal (they are SUBTOTAL, TAX, TOTAL values)
    const pricesAfterSubtotal = standalonePrices
      .filter(p => !p.beforeSubtotal)
      .slice(metadataAfterSubtotal); // Skip totals

    console.log('[OCR Parser] Using', pricesAfterSubtotal.length, 'prices after subtotal (skipped', metadataAfterSubtotal, 'total values)');

    // Second pass: find SKU lines and match with prices
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (isMetadataLine(line)) continue;

      // Skip metadata lines (tax markers, payment methods, store info)
      // Note: ^<[A-Z]>$ matches ONLY lines that are just "<A>", not product lines containing "<A>"
      if (/^SALES\s+[A-Z]$|^TRANS|^STORE:|TERMINAL|PURCHASED|SUBTOTAL|^TAX|INVOICE|MERCH|GIFT\s*CARD|BEGIN|ENDING|TRANSACTION|^DEBIT|^CREDIT|AUTH\s*CODE|RETURN\s*POLICY|POLICY\s*ID|COVID|CARD\s*BALANCE|^<[A-Z]>$/i.test(line)) continue;

      // Skip date lines like "09/07/20"
      if (/^\d{2}\/\d{2}\/\d{2,4}$/.test(line.trim())) continue;

      // Normalize the line - fix OCR spacing in prices and handle thousand separators
      let normalizedLine = line.replace(/(\d)[.,]\s+(\d)/g, '$1.$2');
      // Remove thousand separators (comma followed by 3 digits): "$5,029.90" -> "$5029.90"
      normalizedLine = normalizedLine.replace(/(\d),(\d{3})/g, '$1$2');

      // Pattern 0: Lowe's format - QTY [SKU?] NAME $PRICE
      // Examples:
      //   "1 TIMBERLINE HDZ CHARCOAL $5029,90" -> qty:1, name:TIMBERLINE HDZ CHARCOAL, price:5029.90
      //   "1 WALLPAPER $50.20" -> qty:1, name:WALLPAPER, price:50.20
      //   "2 32131357 EG NEUTRAL $21,98" -> qty:2, sku:32131357, name:EG NEUTRAL, price:21.98
      //   "1 569321 ORCHID 236 $10.99" -> qty:1, sku:569321, name:ORCHID 236, price:10.99
      //   "1 GRILL 8963215 SPONGE $300" -> qty:1, name:GRILL 8963215 SPONGE, price:300
      const lowesPattern = normalizedLine.match(/^(\d{1,2})\s+(.+?)\s+\$(\d+(?:[.,]\d{2})?)\s*$/);
      if (lowesPattern) {
        const quantity = parseInt(lowesPattern[1], 10);
        let nameAndSku = lowesPattern[2].trim();
        const priceStr = lowesPattern[3].replace(',', '.');
        const price = parseFloat(priceStr);

        // Skip if quantity is unreasonable
        if (quantity < 1 || quantity > 99) continue;

        // Extract SKU if present at the start of the name
        let sku: string | undefined;
        const skuInName = nameAndSku.match(/^(\d{5,13})\s+(.+)$/);
        let productName: string;
        if (skuInName) {
          sku = skuInName[1];
          productName = skuInName[2].trim();
        } else {
          productName = nameAndSku;
        }

        // Validate
        if (productName.length >= 3 && price > 0 && price < 50000) {
          candidates.push({
            lineIndex: i,
            sku,
            name: productName,
            price,
            quantity,
          });
          console.log('[OCR Parser] Lowe\'s item:', quantity, 'x', productName, sku ? `(SKU: ${sku})` : '', '@ $' + price);
          continue; // Don't try other patterns for this line
        }
      }

      // Pattern 0.5: SKU + Name + $PRICE (no qty, assume qty=1)
      // Example: "569321 ORCHID 236 $10.99" -> sku:569321, name:ORCHID 236, price:10.99, qty:1
      // Example: "GRILL 8963215 SPONGE $300" -> name:GRILL 8963215 SPONGE, price:300, qty:1
      // Handle trailing description text
      const skuPricePattern = normalizedLine.match(/^(\d{5,13})\s+(.+?)\s+\$([\d,]+[.,]\d{2})(?:\s+(.*))?$/);
      if (skuPricePattern) {
        const sku = skuPricePattern[1];
        const namePart1 = skuPricePattern[2].trim();
        const price = extractPrice(skuPricePattern[3]);
        const namePart2 = skuPricePattern[4] ? skuPricePattern[4].trim() : '';
        let productName = `${namePart1} ${namePart2}`.trim();

        if (productName.length >= 2 && price !== null && price > 0 && price < 50000) {
          candidates.push({
            lineIndex: i,
            sku,
            name: productName,
            price: price,
            quantity: 1,
          });
          console.log('[OCR Parser] SKU+Name+Price item:', sku, productName, '@ $' + price);
          continue;
        }
      }

      // Pattern 0.6: Name + SKU + $PRICE (no qty, SKU in middle)
      // Example: "GRILL 8963215 SPONGE $300" -> name:GRILL SPONGE, sku:8963215, price:300, qty:1
      const nameSKUPricePattern = normalizedLine.match(/^([A-Z][A-Z\s]*?)\s+(\d{5,13})\s+([A-Z][A-Z\s]*?)\s+\$(\d+(?:[.,]\d{2})?)\s*$/i);
      if (nameSKUPricePattern) {
        const namePart1 = nameSKUPricePattern[1].trim();
        const sku = nameSKUPricePattern[2];
        const namePart2 = nameSKUPricePattern[3].trim();
        const productName = `${namePart1} ${namePart2}`.trim();
        const priceStr = nameSKUPricePattern[4].replace(',', '.');
        const priceValue = parseFloat(priceStr);

        if (productName.length >= 3 && priceValue > 0 && priceValue < 50000) {
          candidates.push({
            lineIndex: i,
            sku,
            name: productName,
            price: priceValue,
            quantity: 1,
          });
          console.log('[OCR Parser] Name+SKU+Name+Price item:', productName, '(SKU:', sku, ') @ $' + priceValue);
          continue;
        }
      }

      // Pattern 1: SKU (5-13 digits) + Name + Price inline (potentially with trailing description)
      // Example: "23536 OATEY 14-OZ PLUMBERS PUTT    2.99"
      // Example merged: "6971... SCREEN DR <A> 148.00 SCREEN FOR 200 PS510"
      const hwPattern1 = normalizedLine.match(/^(\d{5,13})\s+(.+?)\s+\$?\s*(\d{1,4}[.,]\d{2})(?:\s+(.*))?$/);
      if (hwPattern1) {
        const sku = hwPattern1[1];
        const namePart1 = hwPattern1[2].trim();
        const price = extractPrice(hwPattern1[3]);
        const namePart2 = hwPattern1[4] ? hwPattern1[4].trim() : '';

        // Clean OCR artifacts: 0 -> O at word start
        let productName = `${namePart1} ${namePart2}`.trim();
        productName = productName.replace(/\b0([A-Z])/gi, 'O$1');

        if (productName.length >= 3 && price !== null && price < 1000) {
          candidates.push({
            lineIndex: i,
            sku,
            name: productName,
            price: price,
            quantity: 1,
          });
          console.log('[OCR Parser] Hardware item (inline price):', sku, productName, price);
          continue;
        }
      }

      // Pattern 2: SKU + Name (price in QTY@PRICE format below)
      // Example: "63254 24" WHITE VAN. W/CULT. MARBLE"
      // Followed by description lines, then "3@64. 90"
      const skuNameMatch = normalizedLine.match(/^(\d{5,13})\s+(.+)$/);
      if (skuNameMatch) {
        const sku = skuNameMatch[1];
        let productName = skuNameMatch[2].trim();

        // Clean up OCR artifacts
        productName = productName.replace(/^0([A-Z])/i, 'O$1');

        // Skip if this looks like a transaction ID or date
        if (/^\d{2}\/\d{2}|^\d{4,}\s*\d{4,}/.test(productName)) continue;

        console.log('[OCR Parser] Found SKU+Name:', sku, productName);

        // Look for QTY@PRICE in the next few lines (up to 5 lines ahead)
        let price: number | undefined;
        let quantity = 1;
        let foundQtyPrice = false;

        for (const qp of qtyPriceLines) {
          if (qp.line > i && qp.line <= i + 5) {
            // Check if there's no other SKU line between this product and the price
            let hasSkuBetween = false;
            for (let j = i + 1; j < qp.line; j++) {
              if (/^\d{5,13}\s+[A-Z]/.test(lines[j])) {
                hasSkuBetween = true;
                break;
              }
            }

            if (!hasSkuBetween) {
              quantity = qp.qty;
              price = qp.price;
              foundQtyPrice = true;
              console.log('[OCR Parser] Matched with QTY@PRICE:', quantity, '@', price);
              // Remove used price
              qtyPriceLines.splice(qtyPriceLines.indexOf(qp), 1);
              break;
            }
          }
        }

        // If no QTY@PRICE found, look for standalone price (prefer before subtotal)
        if (!foundQtyPrice) {
          // First try prices before subtotal (within 3 lines)
          for (const sp of pricesBeforeSubtotal) {
            if (sp.line > i && sp.line <= i + 3) {
              price = sp.price;
              console.log('[OCR Parser] Matched with standalone price (before subtotal):', price);
              pricesBeforeSubtotal.splice(pricesBeforeSubtotal.indexOf(sp), 1);
              break;
            }
          }
        }

        if (productName.length >= 3) {
          candidates.push({
            lineIndex: i,
            sku,
            name: productName,
            price,
            quantity,
          });
          console.log('[OCR Parser] Hardware item:', sku, productName, 'qty:', quantity, 'price:', price);
        }
      }
    }

    // Fallback: For items without price, try to match with column-style prices
    // OCR often captures column layouts as separate lines - prices after SUBTOTAL are usually product line totals
    const itemsWithoutPrice = candidates.filter(c => c.price === undefined);
    if (itemsWithoutPrice.length > 0 && pricesAfterSubtotal.length > 0) {
      console.log('[OCR Parser] Found', pricesAfterSubtotal.length, 'prices after subtotal for', itemsWithoutPrice.length, 'items without price');

      // Match prices to items in order (first item gets first price, etc.)
      for (let idx = 0; idx < itemsWithoutPrice.length && idx < pricesAfterSubtotal.length; idx++) {
        const item = itemsWithoutPrice[idx];
        const linePrice = pricesAfterSubtotal[idx].price;
        // Calculate unit price from line total and quantity
        item.price = item.quantity > 1 ? linePrice / item.quantity : linePrice;
        console.log('[OCR Parser] Assigned column price', linePrice, 'to', item.name, '(unit:', item.price, ')');
      }
    }
  }

  // Strategy 4: Generic Format (fallback)
  // Pattern: Product name + Price anywhere on line
  if (candidates.length === 0) {
    console.log('[OCR Parser] Using Generic parsing strategy');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (isMetadataLine(line)) continue;
      if (line.length < 5) continue;

      // Look for price pattern anywhere in line
      const priceMatch = line.match(/\$?\s*(\d{1,5})[.,](\d{2})/);
      if (priceMatch && priceMatch.index !== undefined && priceMatch.index > 3) {
        const price = parseFloat(`${priceMatch[1]}.${priceMatch[2]}`);
        const productName = line.substring(0, priceMatch.index).trim();

        // Validate it looks like a product name
        const hasLetters = (productName.match(/[A-Za-z]/g) || []).length >= 3;
        if (hasLetters && price > 0 && price < 1000) {
          candidates.push({
            lineIndex: i,
            name: productName,
            price,
            quantity: 1,
          });
          console.log('[OCR Parser] Generic item:', productName, price);
        }
      }
    }
  }

  // ===== RESOLVE MISSING PRICES =====
  // Collect all standalone price lines
  const standalonePrices: Array<{ index: number; price: number }> = [];
  for (let i = 0; i < lines.length; i++) {
    const priceData = isPriceOnlyLine(lines[i]);
    if (priceData) {
      standalonePrices.push({ index: i, price: priceData.prices[0] });
    }
  }

  // Match prices to candidates without prices
  for (const candidate of candidates) {
    if (candidate.price === undefined) {
      // Find the nearest price line after the product
      const nearestPrice = standalonePrices.find(p =>
        p.index > candidate.lineIndex && p.index <= candidate.lineIndex + 3
      );
      if (nearestPrice) {
        candidate.price = nearestPrice.price;
        standalonePrices.splice(standalonePrices.indexOf(nearestPrice), 1);
        console.log('[OCR Parser] Matched price', nearestPrice.price, 'to', candidate.name);
      }
    }
  }

  // ===== CREATE INVENTORY ITEMS =====
  for (const candidate of candidates) {
    // Accept items even without price (user can edit later)
    const price = candidate.price ?? 0;

    // Clean up product name - remove trailing tax markers like "<A>"
    let cleanName = candidate.name
      .replace(/\s*<[A-Z]>\s*$/i, '')  // Remove trailing <A>, <B>, etc.
      .replace(/\s+$/, '')  // Remove trailing whitespace
      .trim();

    if (cleanName.length >= 3) {
      itemCounter++;
      items.push({
        id: `item-${Date.now()}-${itemCounter}`,
        name: cleanName,
        description: candidate.sku ? `SKU: ${candidate.sku}` : cleanName,
        quantity: candidate.quantity,
        price: price,
        purchaseDate: new Date().toISOString(),
      });
    }
  }

  console.log('[OCR Parser] Found', items.length, 'items');

  // Remove duplicates
  const uniqueItems = items.filter((item, index, self) => {
    return index === self.findIndex(
      t => t.name.toLowerCase() === item.name.toLowerCase(),
    );
  });

  return uniqueItems;
};

/**
 * Extracts metadata from receipt text (store name, date, total)
 */
export const extractReceiptMetadata = (ocrText: string): ReceiptMetadata => {
  const lines = ocrText.split('\n').map(l => l.trim()).filter(Boolean);

  // ===== STORE NAME =====
  // Common store names to look for
  const knownStores = [
    { pattern: /LOWE'?S/i, name: "Lowe's" },
    { pattern: /HOME\s*DEPOT/i, name: 'Home Depot' },
    { pattern: /WALMART/i, name: 'Walmart' },
    { pattern: /TARGET/i, name: 'Target' },
    { pattern: /COSTCO/i, name: 'Costco' },
    { pattern: /DOORDASH/i, name: 'DoorDash' },
    { pattern: /UBER\s*EATS/i, name: 'Uber Eats' },
    { pattern: /GRUBHUB/i, name: 'Grubhub' },
    { pattern: /MCDONALD'?S/i, name: "McDonald's" },
    { pattern: /STARBUCKS/i, name: 'Starbucks' },
    { pattern: /CVS/i, name: 'CVS' },
    { pattern: /WALGREENS/i, name: 'Walgreens' },
    { pattern: /ACE\s*HARDWARE/i, name: 'Ace Hardware' },
    { pattern: /MENARDS/i, name: 'Menards' },
  ];

  let store = 'Unknown Store';
  for (const { pattern, name } of knownStores) {
    if (pattern.test(ocrText)) {
      store = name;
      break;
    }
  }

  // If no known store found, try first line that looks like a store name
  if (store === 'Unknown Store') {
    for (const line of lines.slice(0, 5)) {
      // Store names are usually all caps, 3-30 chars, mostly letters
      if (/^[A-Z][A-Z\s&'.-]{2,29}$/.test(line) && !/\d{4,}/.test(line)) {
        store = line;
        break;
      }
    }
  }

  // ===== DATE =====
  // Look for date patterns in various formats
  const datePatterns = [
    // MM/DD/YY or MM-DD-YY (US format) - common in Lowe's receipts
    /(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/,
    // YYYY-MM-DD (ISO format)
    /(\d{4})[/-](\d{1,2})[/-](\d{1,2})/,
    // Month DD, YYYY
    /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*)\s+(\d{1,2}),?\s+(\d{2,4})/i,
  ];

  let date = new Date().toLocaleDateString('en-US');
  for (const pattern of datePatterns) {
    const match = ocrText.match(pattern);
    if (match) {
      // Format as MM/DD/YYYY
      if (pattern.source.includes('Jan|Feb')) {
        // Month name format
        const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        const monthNum = monthNames.findIndex(m => match[1].toLowerCase().startsWith(m)) + 1;
        const day = match[2];
        let year = match[3];
        if (year.length === 2) year = '20' + year;
        date = `${monthNum.toString().padStart(2, '0')}/${day.padStart(2, '0')}/${year}`;
      } else if (match[1].length === 4) {
        // YYYY-MM-DD format
        date = `${match[2]}/${match[3]}/${match[1]}`;
      } else {
        // MM/DD/YY format
        let year = match[3];
        if (year.length === 2) year = '20' + year;
        date = `${match[1].padStart(2, '0')}/${match[2].padStart(2, '0')}/${year}`;
      }
      break;
    }
  }

  // ===== TOTAL =====
  // Patterns support thousand separators: $5,710.79 or $5.710,79
  const totalPatterns = [
    // SUBTOTAL with flexible spacing (Home Depot often has large gaps)
    /SUBTOTAL\s+(\d{1,3}(?:,\d{3})*[.,]\d{2})/i,
    /INVOICE.*TOTAL\s*:?\s*\$?\s*([\d,]+[.,]\d{2})/i,
    /(?:^|\s)TOTAL\s*:?\s*\$?\s*([\d,]+[.,]\d{2})/im,
    /GRAND\s*TOTAL\s*:?\s*\$?\s*([\d,]+[.,]\d{2})/i,
    /AMOUNT\s*(?:DUE|PAID)\s*:?\s*\$?\s*([\d,]+[.,]\d{2})/i,
  ];

  let total = 0;
  for (const pattern of totalPatterns) {
    const match = ocrText.match(pattern);
    if (match) {
      // Remove thousand separators and normalize decimal
      let priceStr = match[1];
      // If has both comma and period, determine which is decimal separator
      if (priceStr.includes(',') && priceStr.includes('.')) {
        // Last separator is likely the decimal
        const lastComma = priceStr.lastIndexOf(',');
        const lastPeriod = priceStr.lastIndexOf('.');
        if (lastComma > lastPeriod) {
          // European: 5.710,79 -> 5710.79
          priceStr = priceStr.replace(/\./g, '').replace(',', '.');
        } else {
          // US: 5,710.79 -> 5710.79
          priceStr = priceStr.replace(/,/g, '');
        }
      } else if (priceStr.includes(',')) {
        // Could be thousand separator (5,710) or decimal (5,71)
        // Check if exactly 2 digits after comma -> decimal, otherwise thousand sep
        if (/,\d{2}$/.test(priceStr)) {
          priceStr = priceStr.replace(',', '.');
        } else {
          priceStr = priceStr.replace(/,/g, '');
        }
      }
      total = parseFloat(priceStr);
      console.log('[OCR Metadata] Parsed total:', match[1], '->', total);
      break;
    }
  }

  return {
    date,
    store,
    total,
  };
};

/**
 * Parses receipt text and performs a sanity check on the total
 * Combines item parsing, metadata extraction, and validation
 */
export const parseReceiptWithSanityCheck = (text: string): ParsedReceiptResult => {
  const items = parseReceiptText(text);
  const metadata = extractReceiptMetadata(text);

  // Calculate the sum of all item prices
  const itemsTotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const receiptTotal = metadata.total;
  const difference = Math.abs(itemsTotal - receiptTotal);

  // Tolerance: allow 10% difference or $2.00 (whichever is larger) to account for:
  // - Tax (which may or may not be included)
  // - OCR errors
  // - Discounts not captured
  const tolerancePercent = receiptTotal * 0.10;
  const toleranceFixed = 2.00;
  const tolerance = Math.max(tolerancePercent, toleranceFixed);

  let isValid = true;
  let message = 'Totals match';

  if (receiptTotal === 0) {
    // No receipt total found - can't validate
    message = 'Receipt total not detected';
    isValid = true; // Don't block if we couldn't read the total
  } else if (itemsTotal === 0) {
    message = 'No items detected';
    isValid = false;
  } else if (difference <= tolerance) {
    message = `Items: $${itemsTotal.toFixed(2)} ≈ Receipt: $${receiptTotal.toFixed(2)}`;
    isValid = true;
  } else if (itemsTotal > receiptTotal) {
    message = `Items ($${itemsTotal.toFixed(2)}) exceed receipt total ($${receiptTotal.toFixed(2)}) by $${difference.toFixed(2)}`;
    isValid = true; // Allow but warn - might include tax in item prices
  } else {
    message = `Items ($${itemsTotal.toFixed(2)}) are less than receipt total ($${receiptTotal.toFixed(2)}) - $${difference.toFixed(2)} difference (may be missing items or include tax)`;
    isValid = true; // Allow but warn - might be missing items or tax
  }

  console.log('[OCR Sanity Check]', message);
  console.log('[OCR Sanity Check] Items total:', itemsTotal, 'Receipt total:', receiptTotal, 'Difference:', difference);

  return {
    items,
    metadata,
    sanityCheck: {
      itemsTotal,
      receiptTotal,
      difference,
      isValid,
      message,
    },
  };
};

/**
 * Merges multi-line product names in OCR results
 * Some receipts have product names split across multiple lines:
 * "24" WHITE VAN. W/CULT. MARBLE"
 * "GLAC BAY BATH VAN. WITH SINK"
 * This function attempts to merge them when no price is on the first line
 */
export const mergeMultiLineProducts = (lines: string[]): string[] => {
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    // Skip empty lines
    if (!line) {
      i++;
      continue;
    }

    // Check if this line looks like a product name (starts with letters/numbers, no price)
    const hasPrice = /\$?\s*\d{1,5}[.,]\d{2}\s*$/.test(line);
    const isPriceOnly = /^\$?\s*\d{1,5}[.,]\d{2}\s*$/.test(line);
    const isSkuLine = /^\d{4,13}\s+[A-Z]/.test(line); // SKU + product name

    // If this is a SKU line or line without price, check if next line is a continuation
    if ((isSkuLine || (!hasPrice && !isPriceOnly)) && i + 1 < lines.length) {
      const nextLine = lines[i + 1].trim();
      const nextIsContinuation = /^[A-Z0-9][A-Z0-9\s#&'.-]{2,}$/i.test(nextLine) && !/^\$?\s*\d{1,5}[.,]\d{2}$/.test(nextLine);

      if (nextIsContinuation) {
        // Merge lines
        result.push(`${line} ${nextLine}`);
        i += 2;
        console.log('[OCR Multi-line] Merged:', line, '+', nextLine);
        continue;
      }
    }

    result.push(line);
    i++;
  }

  return result;
};
