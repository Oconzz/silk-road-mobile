import axios from 'axios';
import type { InventoryItem } from '../types/navigation';
import Config from 'react-native-config';

// API URL from environment variable with /api suffix
// Set API_URL in .env file (e.g., http://192.168.1.54:5001 for local, https://staging-api.silkroadapp.com for staging)
const API_URL = `${Config.API_URL || 'https://staging-api.silkroadapp.com'}/api`;

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const inventoryService = {
  addItems: async (items: InventoryItem[]): Promise<void> => {
    try {
      await api.post('/inventory', { items });
    } catch (error) {
      console.error('Error adding inventory items:', error);
      throw error;
    }
  },

  getItems: async (): Promise<InventoryItem[]> => {
    try {
      const response = await api.get('/inventory');
      return response.data;
    } catch (error) {
      console.error('Error fetching inventory items:', error);
      throw error;
    }
  },
};

export const barcodeService = {
  lookup: async (barcode: string): Promise<any> => {
    try {
      const response = await api.get(`/barcode/${barcode}`);
      return response.data;
    } catch (error) {
      console.error('Error looking up barcode:', error);
      throw error;
    }
  },
};

export default api;
