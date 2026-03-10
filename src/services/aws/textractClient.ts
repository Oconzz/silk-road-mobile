/**
 * AWS Textract Client Service
 * Ported from C# (TextractService.cs)
 *
 * Handles direct AWS Textract AnalyzeExpense API calls from the frontend.
 * Extracts structured invoice data from receipt images.
 */

import {
  TextractClient,
  AnalyzeExpenseCommand,
  AnalyzeExpenseRequest,
  AnalyzeExpenseResponse,
  ExpenseDocument,
  ExpenseField,
  LineItemFields,
} from '@aws-sdk/client-textract';
import Config from 'react-native-config';
import {
  TextractAnalysisResponse,
  TextractInventoryItem,
  enrichReceipt,
} from './receiptEnrichmentService';

// Initialize Textract client with credentials from environment
const createTextractClient = (): TextractClient => {
  const accessKeyId = Config.AWS_ACCESS_KEY_ID;
  const secretAccessKey = Config.AWS_SECRET_ACCESS_KEY;
  const region = Config.AWS_REGION || 'us-east-1';

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      'AWS credentials not configured. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env'
    );
  }

  return new TextractClient({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
};

/**
 * Analyze invoice/receipt using AWS Textract AnalyzeExpense API
 */
export async function analyzeReceiptAsync(
  imageBytes: Uint8Array
): Promise<TextractAnalysisResponse> {
  try {
    const client = createTextractClient();

    const request: AnalyzeExpenseRequest = {
      Document: {
        Bytes: imageBytes,
      },
    };

    const command = new AnalyzeExpenseCommand(request);
    const response = await client.send(command);

    const extractedData = await extractInvoiceData(response);

    // Apply enrichment and normalization for hardware stores
    return enrichReceipt(extractedData);
  } catch (error: any) {
    console.error('[Textract] Analysis failed:', error);
    return {
      success: false,
      errorMessage: `Textract analysis failed: ${error.message || 'Unknown error'}`,
      items: [],
      store: '',
      purchaseDate: new Date().toISOString().split('T')[0],
      total: 0,
    };
  }
}

/**
 * Extract structured invoice data from Textract AnalyzeExpense response
 */
async function extractInvoiceData(
  response: AnalyzeExpenseResponse
): Promise<TextractAnalysisResponse> {
  const result: TextractAnalysisResponse = {
    success: true,
    items: [],
    store: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    total: 0,
  };

  if (!response.ExpenseDocuments || response.ExpenseDocuments.length === 0) {
    result.success = false;
    result.errorMessage = 'No expense documents found in Textract response';
    return result;
  }

  const expenseDoc: ExpenseDocument = response.ExpenseDocuments[0];

  // Extract summary fields (vendor, date, total)
  if (expenseDoc.SummaryFields) {
    for (const field of expenseDoc.SummaryFields) {
      const fieldType = field.Type?.Text?.toLowerCase() || '';
      const fieldValue = field.ValueDetection?.Text || '';

      if (fieldType.includes('vendor') || fieldType.includes('name')) {
        result.store = normalizeStoreName(fieldValue);
      } else if (fieldType.includes('date') && !fieldType.includes('due')) {
        result.purchaseDate = normalizeDate(fieldValue);
      } else if (fieldType.includes('total') && fieldType.includes('amount')) {
        result.total = parseDecimal(fieldValue);
      }
    }
  }

  // Extract line items
  if (expenseDoc.LineItemGroups) {
    for (const lineItemGroup of expenseDoc.LineItemGroups) {
      if (lineItemGroup.LineItems) {
        for (const lineItem of lineItemGroup.LineItems) {
          const item = extractLineItem(lineItem);
          if (item && item.name.trim().length > 0) {
            result.items.push(item);
          }
        }
      }
    }
  }

  // If no line items found, return error
  if (result.items.length === 0) {
    result.success = false;
    result.errorMessage = 'No line items could be extracted from the invoice';
    return result;
  }

  return result;
}

/**
 * Extract individual line item from Textract LineItem
 */
function extractLineItem(lineItem: LineItemFields): TextractInventoryItem | null {
  const item: TextractInventoryItem = {
    name: '',
    description: '',
    quantity: 1,
    price: 0,
  };

  if (!lineItem.LineItemExpenseFields) {
    return null;
  }

  for (const field of lineItem.LineItemExpenseFields) {
    const fieldType = field.Type?.Text?.toLowerCase() || '';
    const fieldValue = field.ValueDetection?.Text || '';

    if (
      fieldType.includes('item') ||
      fieldType.includes('description') ||
      fieldType.includes('product')
    ) {
      item.name = fieldValue.trim();
    } else if (fieldType.includes('quantity')) {
      item.quantity = parseQuantity(fieldValue);
    } else if (fieldType.includes('price') || fieldType.includes('amount')) {
      item.price = parseDecimal(fieldValue);
    }
  }

  // Set description same as name if not provided
  if (!item.description || item.description.trim().length === 0) {
    item.description = item.name;
  }

  return item;
}

/**
 * Normalize store names for known hardware stores
 */
function normalizeStoreName(rawName: string): string {
  if (!rawName || rawName.trim().length === 0) {
    return 'Unknown Store';
  }

  const normalized = rawName.toUpperCase().trim();

  // Check for known hardware stores
  if (normalized.includes('LOWE')) {
    return 'Lowes';
  }
  if (normalized.includes('HOME DEPOT') || normalized.includes('HOMEDEPOT')) {
    return 'Home Depot';
  }
  if (normalized.includes('ACE HARDWARE') || normalized.includes('ACE')) {
    return 'Ace Hardware';
  }
  if (normalized.includes('HARBOR FREIGHT')) {
    return 'Harbor Freight Tools';
  }
  if (normalized.includes('SHERWIN') || normalized.includes('WILLIAMS')) {
    return 'Sherwin Williams';
  }
  if (normalized.includes('CARTER') && normalized.includes('LUMBER')) {
    return 'Carter Lumber';
  }

  return rawName; // Return original if not recognized
}

/**
 * Normalize date string to ISO format (yyyy-MM-dd)
 */
function normalizeDate(rawDate: string): string {
  if (!rawDate || rawDate.trim().length === 0) {
    return new Date().toISOString().split('T')[0];
  }

  // Try common date formats
  const formats = [
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // MM/dd/yyyy or M/d/yyyy
    /^(\d{1,2})-(\d{1,2})-(\d{4})$/, // MM-dd-yyyy or M-d-yyyy
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/, // yyyy-MM-dd
    /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/, // MM/dd/yy or M/d/yy
  ];

  for (const format of formats) {
    const match = rawDate.match(format);
    if (match) {
      let year: number;
      let month: number;
      let day: number;

      if (format === formats[2]) {
        // yyyy-MM-dd
        year = parseInt(match[1], 10);
        month = parseInt(match[2], 10);
        day = parseInt(match[3], 10);
      } else if (format === formats[3]) {
        // MM/dd/yy - convert 2-digit year to 4-digit
        month = parseInt(match[1], 10);
        day = parseInt(match[2], 10);
        year = 2000 + parseInt(match[3], 10);
      } else {
        // MM/dd/yyyy or MM-dd-yyyy
        month = parseInt(match[1], 10);
        day = parseInt(match[2], 10);
        year = parseInt(match[3], 10);
      }

      // Validate date
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const parsedDate = new Date(year, month - 1, day);
        return parsedDate.toISOString().split('T')[0];
      }
    }
  }

  // Fallback to current date
  return new Date().toISOString().split('T')[0];
}

/**
 * Parse decimal value from text (handles currency symbols, commas)
 */
function parseDecimal(value: string): number {
  if (!value || value.trim().length === 0) {
    return 0;
  }

  // Remove currency symbols, whitespace, and commas
  const cleaned = value.replace(/[$,\s]/g, '');

  const result = parseFloat(cleaned);
  if (isNaN(result)) {
    return 0;
  }

  return result;
}

/**
 * Parse quantity from text
 */
function parseQuantity(value: string): number {
  if (!value || value.trim().length === 0) {
    return 1;
  }

  // Remove any non-numeric characters except decimal point
  const cleaned = value.replace(/[^\d.]/g, '');

  const result = parseInt(cleaned, 10);
  if (isNaN(result) || result <= 0) {
    return 1;
  }

  return result;
}
