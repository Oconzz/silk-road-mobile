import Config from 'react-native-config';

export interface ProductInfo {
  name: string;
  description?: string;
  brand?: string;
  category?: string;
  imageUrl?: string;
  price?: number;
  barcode: string;
}

export interface BarcodeLookupResult {
  success: boolean;
  product?: ProductInfo;
  error?: string;
}

/**
 * Barcode Lookup Service
 * 
 * Supports integration with US barcode APIs:
 * - Go-UPC (https://go-upc.com) - 500M+ products, $9/month for 5K requests
 * - UPC Database (https://upcdatabase.org) - Free tier available
 * - Barcode Lookup (https://barcodelookup.com) - Large US database
 * 
 * To enable product lookup:
 * 1. Sign up for an API key at one of the providers above
 * 2. Add the API key to your .env file:
 *    BARCODE_API_KEY=your_api_key
 *    BARCODE_API_PROVIDER=go-upc (or upc-database)
 */
class BarcodeLookupService {
  private apiKey: string | undefined;
  private provider: string;

  constructor() {
    this.apiKey = Config.BARCODE_API_KEY;
    this.provider = Config.BARCODE_API_PROVIDER || 'go-upc';
  }

  async lookupBarcode(barcode: string): Promise<BarcodeLookupResult> {
    if (!this.apiKey) {
      console.log('[BarcodeLookup] No API key configured, returning barcode only');
      return {
        success: true,
        product: {
          name: barcode,
          barcode,
        },
      };
    }

    try {
      switch (this.provider) {
        case 'go-upc':
          return await this.lookupGoUPC(barcode);
        case 'upc-database':
          return await this.lookupUPCDatabase(barcode);
        default:
          return await this.lookupGoUPC(barcode);
      }
    } catch (error: any) {
      console.error('[BarcodeLookup] Error:', error.message);
      return {
        success: false,
        error: error.message || 'Failed to lookup product',
        product: {
          name: barcode,
          barcode,
        },
      };
    }
  }

  private async lookupGoUPC(barcode: string): Promise<BarcodeLookupResult> {
    console.log('[BarcodeLookup] Looking up barcode via Go-UPC:', barcode);
    
    const response = await fetch(
      `https://go-upc.com/api/v1/code/${barcode}?key=${this.apiKey}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    console.log('[BarcodeLookup] Go-UPC response status:', response.status);

    if (!response.ok) {
      if (response.status === 404) {
        console.log('[BarcodeLookup] Product not found in Go-UPC database');
        return {
          success: true,
          product: {
            name: '',
            barcode,
            description: '',
          },
        };
      }
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('[BarcodeLookup] Go-UPC product found:', data.product?.name);
    
    return {
      success: true,
      product: {
        name: data.product?.name || '',
        description: data.product?.description || '',
        brand: data.product?.brand,
        category: data.product?.category,
        imageUrl: data.product?.imageUrl,
        barcode,
      },
    };
  }

  private async lookupUPCDatabase(barcode: string): Promise<BarcodeLookupResult> {
    const response = await fetch(`https://api.upcdatabase.org/product/${barcode}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return {
          success: true,
          product: {
            name: barcode,
            barcode,
            description: 'Product not found in database',
          },
        };
      }
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    
    return {
      success: true,
      product: {
        name: data.title || barcode,
        description: data.description,
        brand: data.brand,
        category: data.category,
        imageUrl: data.images?.[0],
        barcode,
      },
    };
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }
}

export const barcodeLookupService = new BarcodeLookupService();
