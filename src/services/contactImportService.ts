import Contacts, { Contact } from 'react-native-contacts';
import { Platform, PermissionsAndroid, Linking } from 'react-native';

export interface DeviceContact {
  id: string;
  displayName: string;
  firstName: string;
  lastName: string;
  company: string;
  phoneNumbers: Array<{ label: string; number: string }>;
  emailAddresses: Array<{ label: string; email: string }>;
  // Mapped fields for client creation
  contactName: string;
  phone: string;
  email: string;
  companyName: string;
  // Validation flags
  hasRequiredFields: boolean;
  missingFields: string[];
}

export type PermissionStatus = 'authorized' | 'denied' | 'restricted' | 'undefined';

class ContactImportService {
  /**
   * Request contacts permission based on platform
   */
  async requestPermission(): Promise<PermissionStatus> {
    try {
      if (Platform.OS === 'ios') {
        const status = await Contacts.requestPermission();
        return status as PermissionStatus;
      } else {
        // Android
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
          {
            title: 'Contacts Permission',
            message: 'SilkRoad needs access to your contacts to import client information.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED ? 'authorized' : 'denied';
      }
    } catch (error) {
      console.error('[ContactImportService] Error requesting permission:', error);
      return 'denied';
    }
  }

  /**
   * Check current permission status
   */
  async checkPermission(): Promise<PermissionStatus> {
    try {
      if (Platform.OS === 'ios') {
        const status = await Contacts.checkPermission();
        return status as PermissionStatus;
      } else {
        const granted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.READ_CONTACTS
        );
        return granted ? 'authorized' : 'denied';
      }
    } catch (error) {
      console.error('[ContactImportService] Error checking permission:', error);
      return 'undefined';
    }
  }

  /**
   * Open device settings for permission management
   */
  openSettings(): void {
    Linking.openSettings();
  }

  /**
   * Get all contacts from device
   */
  async getContacts(): Promise<DeviceContact[]> {
    try {
      const contacts = await Contacts.getAll();
      return contacts.map(this.mapContact).sort((a: DeviceContact, b: DeviceContact) =>
        a.displayName.localeCompare(b.displayName)
      );
    } catch (error) {
      console.error('[ContactImportService] Error getting contacts:', error);
      throw error;
    }
  }

  /**
   * Search contacts by name
   */
  async searchContacts(searchTerm: string): Promise<DeviceContact[]> {
    try {
      const contacts = await Contacts.getContactsMatchingString(searchTerm);
      return contacts.map(this.mapContact).sort((a: DeviceContact, b: DeviceContact) =>
        a.displayName.localeCompare(b.displayName)
      );
    } catch (error) {
      console.error('[ContactImportService] Error searching contacts:', error);
      throw error;
    }
  }

  /**
   * Map native contact to our DeviceContact interface
   */
  private mapContact = (contact: Contact): DeviceContact => {
    const firstName = contact.givenName || '';
    const lastName = contact.familyName || '';
    const displayName = contact.displayName || `${firstName} ${lastName}`.trim() || 'Unknown';

    // Get primary phone (prefer mobile, then any)
    const mobilePhone = contact.phoneNumbers.find((p: {label?: string; number: string}) =>
      p.label?.toLowerCase().includes('mobile') ||
      p.label?.toLowerCase().includes('cell')
    );
    const primaryPhone = mobilePhone || contact.phoneNumbers[0];
    const phone = primaryPhone?.number || '';

    // Get primary email (prefer work, then any)
    const workEmail = contact.emailAddresses.find((e: {label?: string; email: string}) =>
      e.label?.toLowerCase().includes('work')
    );
    const primaryEmail = workEmail || contact.emailAddresses[0];
    const email = primaryEmail?.email || '';

    const company = contact.company || '';

    // Determine missing required fields
    // Note: For client creation, contactName is required, phone and email are optional
    const missingFields: string[] = [];
    if (!phone && !email) {
      missingFields.push('phone or email');
    }

    return {
      id: contact.recordID,
      displayName,
      firstName,
      lastName,
      company,
      phoneNumbers: contact.phoneNumbers.map((p: {label?: string; number: string}) => ({
        label: p.label || 'other',
        number: p.number,
      })),
      emailAddresses: contact.emailAddresses.map((e: {label?: string; email: string}) => ({
        label: e.label || 'other',
        email: e.email,
      })),
      // Mapped fields
      contactName: displayName,
      phone,
      email,
      companyName: company,
      // Validation
      hasRequiredFields: missingFields.length === 0,
      missingFields,
    };
  };

  /**
   * Filter contacts that have at least a name
   */
  filterValidContacts(contacts: DeviceContact[]): DeviceContact[] {
    return contacts.filter(c => c.contactName && c.contactName !== 'Unknown');
  }

  /**
   * Filter contacts by search term (client-side)
   */
  filterBySearchTerm(contacts: DeviceContact[], searchTerm: string): DeviceContact[] {
    if (!searchTerm) return contacts;

    const term = searchTerm.toLowerCase();
    return contacts.filter(c =>
      c.displayName.toLowerCase().includes(term) ||
      c.email.toLowerCase().includes(term) ||
      c.phone.includes(term) ||
      c.companyName.toLowerCase().includes(term)
    );
  }
}

export const contactImportService = new ContactImportService();
