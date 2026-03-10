import Config from 'react-native-config';

export interface GeocodingResult {
  formattedAddress: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipcode: string;
  country: string;
  latitude: number;
  longitude: number;
}

export interface PlacePrediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

class GeocodingService {
  private apiKey: string;
  private baseUrl = 'https://maps.googleapis.com/maps/api';

  constructor() {
    console.log('[GeocodingService] Initializing...');
    console.log('[GeocodingService] Config object:', JSON.stringify(Config, null, 2));
    console.log('[GeocodingService] GOOGLE_MAPS_API_KEY from Config:', Config.GOOGLE_MAPS_API_KEY);
    console.log('[GeocodingService] API_URL from Config:', Config.API_URL);
    
    this.apiKey = Config.GOOGLE_MAPS_API_KEY || '';
    
    console.log('[GeocodingService] API Key length:', this.apiKey.length);
    console.log('[GeocodingService] API Key (first 10 chars):', this.apiKey.substring(0, 10));
    
    if (!this.apiKey) {
      console.error('[GeocodingService] ❌ Google Maps API Key not found in config!');
      console.error('[GeocodingService] Available Config keys:', Object.keys(Config));
    } else {
      console.log('[GeocodingService] ✅ API Key loaded successfully');
    }
  }

  async getPlacePredictions(input: string): Promise<PlacePrediction[]> {
    console.log('[GeocodingService] getPlacePredictions called with input:', input);
    
    if (!input || input.length < 3) {
      console.log('[GeocodingService] Input too short, returning empty array');
      return [];
    }

    if (!this.apiKey) {
      console.error('[GeocodingService] ❌ Cannot make request - API Key is empty!');
      return [];
    }

    try {
      const url = `${this.baseUrl}/place/autocomplete/json?input=${encodeURIComponent(
        input
      )}&key=${this.apiKey}&components=country:us`;
      
      console.log('[GeocodingService] Making request to:', url.replace(this.apiKey, 'API_KEY_HIDDEN'));

      const response = await fetch(url);
      console.log('[GeocodingService] Response status:', response.status);
      
      const data = await response.json();
      console.log('[GeocodingService] Response data:', JSON.stringify(data, null, 2));

      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        console.error('[GeocodingService] ❌ Autocomplete error:', data.status, data.error_message || 'No error message');
        console.error('[GeocodingService] Full response:', JSON.stringify(data, null, 2));
        return [];
      }
      
      console.log('[GeocodingService] ✅ Got', data.predictions?.length || 0, 'predictions');

      const predictions = (data.predictions || []).map((prediction: any) => ({
        placeId: prediction.place_id,
        description: prediction.description,
        mainText: prediction.structured_formatting?.main_text || '',
        secondaryText: prediction.structured_formatting?.secondary_text || '',
      }));
      
      console.log('[GeocodingService] Returning predictions:', predictions.length);
      return predictions;
    } catch (error) {
      console.error('[GeocodingService] ❌ getPlacePredictions error:', error);
      console.error('[GeocodingService] Error details:', JSON.stringify(error, null, 2));
      return [];
    }
  }

  async getPlaceDetails(placeId: string): Promise<GeocodingResult | null> {
    console.log('[GeocodingService] getPlaceDetails called with placeId:', placeId);
    
    if (!this.apiKey) {
      console.error('[GeocodingService] ❌ Cannot get place details - API Key is empty!');
      return null;
    }
    
    try {
      const url = `${this.baseUrl}/place/details/json?place_id=${placeId}&key=${this.apiKey}&fields=address_components,formatted_address,geometry`;
      
      console.log('[GeocodingService] Making place details request...');
      console.log('[GeocodingService] Place details request URL:', url.replace(this.apiKey, 'API_KEY_HIDDEN'));

      const response = await fetch(url);
      console.log('[GeocodingService] Place details response status:', response.status);
      
      const data = await response.json();
      console.log('[GeocodingService] Place details data status:', data.status);

      if (data.status !== 'OK') {
        console.error('[GeocodingService] ❌ Place details error:', data.status, data.error_message);
        return null;
      }
      
      console.log('[GeocodingService] ✅ Place details retrieved successfully');

      const result = data.result;
      return this.parseAddressComponents(result);
    } catch (error) {
      console.error('[GeocodingService] ❌ getPlaceDetails error:', error);
      console.error('[GeocodingService] Error details:', JSON.stringify(error, null, 2));
      return null;
    }
  }
  
  // Debug method to test API key
  async testApiKey(): Promise<boolean> {
    console.log('[GeocodingService] Testing API Key...');
    console.log('[GeocodingService] Current API Key:', this.apiKey ? `${this.apiKey.substring(0, 10)}...` : 'EMPTY');
    
    if (!this.apiKey) {
      console.error('[GeocodingService] ❌ API Key is empty!');
      return false;
    }
    
    try {
      // Simple geocode test
      const testUrl = `${this.baseUrl}/geocode/json?address=New+York&key=${this.apiKey}`;
      console.log('[GeocodingService] Test request URL:', testUrl.replace(this.apiKey, 'API_KEY_HIDDEN'));
      
      const response = await fetch(testUrl);
      const data = await response.json();
      
      console.log('[GeocodingService] Test response status:', data.status);
      console.log('[GeocodingService] Test response:', JSON.stringify(data, null, 2));
      
      if (data.status === 'OK') {
        console.log('[GeocodingService] ✅ API Key is valid and working!');
        return true;
      } else {
        console.error('[GeocodingService] ❌ API Key test failed:', data.status, data.error_message);
        return false;
      }
    } catch (error) {
      console.error('[GeocodingService] ❌ API Key test error:', error);
      return false;
    }
  }

  async geocodeAddress(address: string): Promise<GeocodingResult | null> {
    try {
      const url = `${this.baseUrl}/geocode/json?address=${encodeURIComponent(
        address
      )}&key=${this.apiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 'OK' || !data.results || data.results.length === 0) {
        console.error('[GeocodingService] Geocode error:', data.status, data.error_message);
        return null;
      }

      return this.parseAddressComponents(data.results[0]);
    } catch (error) {
      console.error('[GeocodingService] geocodeAddress error:', error);
      return null;
    }
  }

  async reverseGeocode(latitude: number, longitude: number): Promise<GeocodingResult | null> {
    try {
      const url = `${this.baseUrl}/geocode/json?latlng=${latitude},${longitude}&key=${this.apiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 'OK' || !data.results || data.results.length === 0) {
        console.error('[GeocodingService] Reverse geocode error:', data.status);
        return null;
      }

      return this.parseAddressComponents(data.results[0]);
    } catch (error) {
      console.error('[GeocodingService] reverseGeocode error:', error);
      return null;
    }
  }

  private parseAddressComponents(result: any): GeocodingResult {
    const components = result.address_components || [];
    const geometry = result.geometry || {};

    let streetNumber = '';
    let route = '';
    let city = '';
    let state = '';
    let zipcode = '';
    let country = '';

    components.forEach((component: any) => {
      const types = component.types;
      
      if (types.includes('street_number')) {
        streetNumber = component.long_name;
      }
      if (types.includes('route')) {
        route = component.long_name;
      }
      // Try multiple types for city
      if (types.includes('locality')) {
        city = component.long_name;
      } else if (!city && types.includes('sublocality')) {
        city = component.long_name;
      } else if (!city && types.includes('sublocality_level_1')) {
        city = component.long_name;
      } else if (!city && types.includes('administrative_area_level_2')) {
        city = component.long_name;
      } else if (!city && types.includes('neighborhood')) {
        city = component.long_name;
      } else if (!city && types.includes('postal_town')) {
        city = component.long_name;
      }
      
      if (types.includes('administrative_area_level_1')) {
        state = component.short_name;
      }
      if (types.includes('postal_code')) {
        zipcode = component.long_name;
      }
      // Also check postal_code_prefix as fallback
      if (!zipcode && types.includes('postal_code_prefix')) {
        zipcode = component.long_name;
      }
      if (types.includes('country')) {
        country = component.long_name;
      }
    });

    // Fallback: try to extract ZIP from formatted_address (US pattern: "State XXXXX" or "State XXXXX-XXXX")
    if (!zipcode && result.formatted_address) {
      const zipMatch = result.formatted_address.match(/\b(\d{5}(?:-\d{4})?)\b/);
      if (zipMatch) {
        zipcode = zipMatch[1];
        console.log('[GeocodingService] ZIP extracted from formatted_address fallback:', zipcode);
      }
    }

    const addressLine1 = [streetNumber, route].filter(Boolean).join(' ') || result.formatted_address?.split(',')[0] || '';

    console.log('[GeocodingService] Parsed address:', {addressLine1, city, state, zipcode, country});

    return {
      formattedAddress: result.formatted_address || '',
      addressLine1,
      city,
      state,
      zipcode,
      country,
      latitude: geometry.location?.lat || 0,
      longitude: geometry.location?.lng || 0,
    };
  }

  validateApiKey(): boolean {
    return !!this.apiKey && this.apiKey.length > 0;
  }
}

export const geocodingService = new GeocodingService();
