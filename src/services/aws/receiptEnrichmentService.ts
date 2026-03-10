/**
 * Receipt Enrichment Service
 * Ported from C# (ReceiptEnrichmentService.cs)
 *
 * Improves accuracy for hardware store receipts:
 * - Ace Hardware, Lowes, Home Depot, Harbor Freight Tools, Sherwin Williams, Carter Lumber
 *
 * Features:
 * - OCR error correction
 * - Store name normalization
 * - Product categorization
 * - SKU pattern recognition
 * - Brand normalization
 * - Data validation and deduplication
 */

export interface TextractInventoryItem {
  name: string;
  description: string;
  quantity: number;
  price: number;
}

export interface TextractAnalysisResponse {
  success: boolean;
  store: string;
  purchaseDate: string;
  total: number;
  items: TextractInventoryItem[];
  errorMessage?: string;
}

// Common OCR character confusions
const OCR_CONFUSABLES: Record<string, string[]> = {
  '0': ['O', 'o', 'Q'],
  '1': ['I', 'l', '|'],
  '5': ['S', 's'],
  '8': ['B'],
  '2': ['Z'],
};

// Product category keywords by store type
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Fasteners': ['SCREW', 'NAIL', 'BOLT', 'NUT', 'WASHER', 'ANCHOR', 'RIVET'],
  'Lumber': ['2X4', '2X6', '2X8', '4X4', 'PLYWOOD', 'OSB', 'BOARD', 'STUD', 'BEAM'],
  'Paint': ['PAINT', 'PRIMER', 'STAIN', 'SEALER', 'BRUSH', 'ROLLER', 'TRAY', 'THINNER'],
  'Electrical': ['WIRE', 'CABLE', 'OUTLET', 'SWITCH', 'BREAKER', 'CONDUIT', 'JUNCTION'],
  'Plumbing': ['PIPE', 'PVC', 'CPVC', 'FITTING', 'VALVE', 'FAUCET', 'DRAIN', 'COPPER'],
  'Tools': ['DRILL', 'SAW', 'HAMMER', 'WRENCH', 'SOCKET', 'RATCHET', 'LEVEL', 'TAPE'],
  'Hardware': ['HINGE', 'LOCK', 'HANDLE', 'KNOB', 'LATCH', 'HASP', 'BRACKET'],
  'Concrete': ['CONCRETE', 'CEMENT', 'MIX', 'MORTAR', 'GROUT', 'QUICKRETE', 'SAKRETE'],
};

// Store-specific product patterns (SKU formats and common brands)
const STORE_PRODUCT_PATTERNS: Record<string, { skuPattern: string; commonBrands: string }> = {
  'Home Depot': {
    skuPattern: '\\b\\d{12}\\b|HDX-\\d+',
    commonBrands: 'HDX|HUSKY|GLACIER BAY|VIGORO|EVERBILT|DEFIANT',
  },
  'Lowes': {
    skuPattern: '\\b\\d{6,12}\\b',
    commonBrands: 'KOBALT|ALLEN\\+ROTH|PROJECT SOURCE|UTILITECH|RELIABILT',
  },
  'Ace Hardware': {
    skuPattern: '\\b\\d{7}\\b',
    commonBrands: 'ACE|CRAFTSMAN|VALSPAR|WERNER|SCOTTS',
  },
  'Harbor Freight Tools': {
    skuPattern: '\\b\\d{5,8}\\b',
    commonBrands: 'PITTSBURGH|QUINN|BAUER|HERCULES|WARRIOR|ICON|EARTHQUAKE',
  },
  'Sherwin Williams': {
    skuPattern: '[A-Z]{1,2}\\d{3,4}',
    commonBrands: 'SHERWIN|DURATION|EMERALD|CASHMERE|SUPERPAINT|PROMAR',
  },
  'Carter Lumber': {
    skuPattern: '\\b\\d{4,10}\\b',
    commonBrands: 'CARTER|SIMPSON|TREX|AZEK',
  },
};

/**
 * Enrich receipt items with normalized data, category detection, and OCR corrections
 */
export function enrichReceipt(response: TextractAnalysisResponse): TextractAnalysisResponse {
  if (!response || !response.success || !response.items) {
    return response;
  }

  // Normalize store name first
  response.store = normalizeStoreName(response.store);

  // Process each item
  for (const item of response.items) {
    // Clean and normalize item name
    item.name = cleanItemName(item.name);

    // Apply store-specific corrections
    item.name = applyStoreSpecificCorrections(item.name, response.store);

    // Detect and add category
    const category = detectCategory(item.name);
    if (category) {
      item.description = `${category}: ${item.name}`;
    } else {
      item.description = item.name;
    }

    // Validate and correct quantity
    item.quantity = validateQuantity(item.quantity);

    // Validate and correct price
    item.price = validatePrice(item.price);
  }

  // Remove duplicate items
  response.items = deduplicateItems(response.items);

  // Sort items by price (most expensive first)
  response.items = response.items.sort((a, b) => b.price - a.price);

  return response;
}

/**
 * Clean item names: remove extra spaces, fix common OCR errors
 */
function cleanItemName(name: string): string {
  if (!name || name.trim().length === 0) {
    return 'Unknown Item';
  }

  // Remove multiple spaces
  name = name.replace(/\s+/g, ' ');

  // Remove leading/trailing special characters
  name = name.trim().replace(/^[ \-_.]+|[ \-_.]+$/g, '');

  // Fix common OCR patterns
  name = fixCommonOcrErrors(name);

  // Capitalize properly
  name = toTitleCase(name);

  return name;
}

/**
 * Fix common OCR misreads in text
 */
function fixCommonOcrErrors(text: string): string {
  // Fix "1/2" being read as "1/Z"
  text = text.replace(/1\/Z/gi, '1/2');

  // Fix "2x4" being read as "ZX4" or "2X0"
  text = text.replace(/\bZX(\d)/gi, '2X$1');
  text = text.replace(/\b(\d)X0\b/gi, '$1X4');

  // Fix "IN" being read as "1N" or "lN"
  text = text.replace(/\b[1l]N\b/gi, 'IN');

  // Fix "SCREW" being read as "5CREW"
  text = text.replace(/\b5CREW/gi, 'SCREW');

  // Fix "8D NAIL" being read as "BD NAIL"
  text = text.replace(/\bBD\s+NAIL/gi, '8D NAIL');

  return text;
}

/**
 * Apply store-specific product name corrections
 */
function applyStoreSpecificCorrections(name: string, store: string): string {
  if (!STORE_PRODUCT_PATTERNS[store]) {
    return name;
  }

  // For Home Depot: Normalize HDX brand
  if (store === 'Home Depot' && /HDX/i.test(name)) {
    name = name.replace(/HDX/gi, 'HDX');
  }

  // For Lowes: Normalize Kobalt brand
  if (store === 'Lowes' && /KOBALT/i.test(name)) {
    name = name.replace(/KOBALT/gi, 'Kobalt');
  }

  // For Harbor Freight: Normalize Pittsburgh brand
  if (store === 'Harbor Freight Tools' && /PITTSBURGH/i.test(name)) {
    name = name.replace(/PITTSBURGH/gi, 'Pittsburgh');
  }

  // For Sherwin Williams: Normalize paint product names
  if (store === 'Sherwin Williams') {
    if (/DURATION/i.test(name)) {
      name = name.replace(/DURATION/gi, 'Duration');
    }
    if (/EMERALD/i.test(name)) {
      name = name.replace(/EMERALD/gi, 'Emerald');
    }
  }

  return name;
}

/**
 * Detect product category based on keywords
 */
function detectCategory(itemName: string): string | null {
  if (!itemName || itemName.trim().length === 0) {
    return null;
  }

  const upperName = itemName.toUpperCase();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(keyword => upperName.includes(keyword))) {
      return category;
    }
  }

  return null;
}

/**
 * Validate and correct quantity (must be > 0)
 */
function validateQuantity(quantity: number): number {
  if (quantity <= 0) {
    return 1;
  }

  // If quantity is unreasonably high (likely OCR error), cap it
  if (quantity > 999) {
    return 1;
  }

  return quantity;
}

/**
 * Validate and correct price (must be >= 0)
 */
function validatePrice(price: number): number {
  if (price < 0) {
    return 0;
  }

  // If price is unreasonably high (likely OCR error with decimal), try to fix
  if (price > 100000) {
    // Possibly decimal point was misread
    return price / 100;
  }

  return price;
}

/**
 * Remove duplicate items (same name and price)
 */
function deduplicateItems(items: TextractInventoryItem[]): TextractInventoryItem[] {
  const uniqueMap = new Map<string, TextractInventoryItem>();

  for (const item of items) {
    const key = `${item.name.toLowerCase()}-${item.price}`;

    if (uniqueMap.has(key)) {
      // Merge quantities for duplicates
      const existing = uniqueMap.get(key)!;
      existing.quantity += item.quantity;
    } else {
      uniqueMap.set(key, {...item});
    }
  }

  return Array.from(uniqueMap.values());
}

/**
 * Convert to title case (proper capitalization)
 */
function toTitleCase(text: string): string {
  if (!text || text.trim().length === 0) {
    return text;
  }

  // Don't title-case if already properly cased (has lowercase letters)
  if (/[a-z]/.test(text)) {
    return text;
  }

  // Convert to title case
  return text.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
}

/**
 * Enhanced store name normalization
 */
export function normalizeStoreName(rawName: string): string {
  if (!rawName || rawName.trim().length === 0) {
    return 'Unknown Store';
  }

  const normalized = rawName.toUpperCase().trim();

  // Check for known hardware stores
  if (normalized.includes('LOWE')) {
    return 'Lowes';
  }
  if (normalized.includes('HOME') && normalized.includes('DEPOT')) {
    return 'Home Depot';
  }
  if (normalized.includes('ACE')) {
    return 'Ace Hardware';
  }
  if (normalized.includes('HARBOR') && normalized.includes('FREIGHT')) {
    return 'Harbor Freight Tools';
  }
  if (normalized.includes('SHERWIN') || (normalized.includes('SW') && normalized.includes('PAINT'))) {
    return 'Sherwin Williams';
  }
  if (normalized.includes('CARTER') && normalized.includes('LUMBER')) {
    return 'Carter Lumber';
  }

  return rawName; // Return original if not recognized
}
