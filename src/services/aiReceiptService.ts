import { GoogleGenerativeAI } from '@google/generative-ai';
import type { InventoryItem } from '../types/navigation';

// NOTE: For production, store this in environment variables or secure storage
// Get your free API key at: https://makersuite.google.com/app/apikey
const GEMINI_API_KEY = 'AIzaSyA0qMqvEWJ3dg2qXnqM6sgmz-t_bu9ohWk'; // User must provide their own key

let genAI: GoogleGenerativeAI | null = null;

/**
 * Initialize Google Gemini AI
 * Call this with your API key before using parseReceiptWithAI
 */
export const initializeGeminiAI = (apiKey: string): void => {
  genAI = new GoogleGenerativeAI(apiKey);
  console.log('[AI Receipt] Gemini AI initialized');
};

/**
 * Check if Gemini AI is available
 */
export const isAIAvailable = (): boolean => {
  return genAI !== null || GEMINI_API_KEY.length > 0;
};

/**
 * Parse receipt text using Google Gemini AI
 * This is a fallback when the traditional parser fails
 */
export const parseReceiptWithAI = async (ocrText: string): Promise<InventoryItem[]> => {
  // Initialize with default key if not already initialized
  if (!genAI && GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  }

  if (!genAI) {
    console.log('[AI Receipt] Gemini AI not initialized - no API key');
    return [];
  }

  try {
    console.log('[AI Receipt] Analyzing receipt with Gemini AI...');

    // Use gemini-1.5-flash-latest which is available in v1beta
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });

    const prompt = `You are a receipt parser. Analyze this OCR text from a receipt and extract ONLY the purchased items (products).

RULES:
1. Extract ONLY actual products/items that were purchased
2. DO NOT include: totals, subtotals, taxes, fees, tips, discounts, store info, addresses, dates
3. DO NOT include: gift cards, payment methods, card balances, loyalty cards
4. DO NOT include tax category markers like "SALES A" or lines with just "<A>"
5. For quantity, look for patterns like "2@7.57" (quantity @ unit price) or "2x7.57" (quantity x unit price)
6. For each item, extract: name, unit price, and quantity
7. If a price is missing, use 0. If quantity is not specified, use 1
8. Clean up OCR errors in product names (e.g., "0ATEY" should be "OATEY")
9. Remove trailing markers like "<A>" or "<B>" from product names

RESPOND ONLY with a valid JSON array in this exact format:
[{"name": "Product Name", "price": 9.99, "quantity": 1}]

If no items found, respond with: []

OCR TEXT:
${ocrText}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log('[AI Receipt] Gemini response:', text);

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = text.trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/```json\s*/, '').replace(/```\s*$/, '');
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```\s*/, '').replace(/```\s*$/, '');
    }

    const parsed = JSON.parse(jsonStr);

    if (!Array.isArray(parsed)) {
      console.log('[AI Receipt] Response is not an array');
      return [];
    }

    // Convert to InventoryItem format
    const items: InventoryItem[] = parsed.map((item: { name: string; price: number; quantity?: number }, index: number) => ({
      id: `ai-item-${Date.now()}-${index}`,
      name: item.name || 'Unknown Item',
      description: item.name || 'Unknown Item',
      quantity: item.quantity || 1,
      price: typeof item.price === 'number' ? item.price : 0,
      purchaseDate: new Date().toISOString(),
    }));

    console.log('[AI Receipt] Extracted', items.length, 'items via AI');
    return items;

  } catch (error) {
    console.error('[AI Receipt] Error parsing with AI:', error);
    return [];
  }
};

/**
 * Hybrid parsing: Try traditional parser first, then AI fallback
 */
export const parseReceiptHybrid = async (
  ocrText: string,
  traditionalParser: (text: string) => InventoryItem[],
): Promise<InventoryItem[]> => {
  // First, try traditional parsing
  const traditionalItems = traditionalParser(ocrText);

  if (traditionalItems.length > 0) {
    console.log('[AI Receipt] Traditional parser succeeded with', traditionalItems.length, 'items');
    return traditionalItems;
  }

  // If traditional parsing fails and AI is available, try AI
  if (isAIAvailable()) {
    console.log('[AI Receipt] Traditional parser found no items, trying AI...');
    return parseReceiptWithAI(ocrText);
  }

  console.log('[AI Receipt] No items found and AI not available');
  return [];
};
