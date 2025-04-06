/**
 * Service for managing contacts
 */
import * as Contacts from 'expo-contacts';
import logger from '../utils/logger';

/**
 * Get all contacts from the device
 * @param {Object} options - Options for fetching contacts
 * @returns {Promise<Array>} Array of contacts
 */
export const getAllContacts = async (options = {}) => {
  try {
    // Check permission
    const { status } = await Contacts.getPermissionsAsync();
    
    if (status !== 'granted') {
      const { status: newStatus } = await Contacts.requestPermissionsAsync();
      if (newStatus !== 'granted') {
        throw new Error('Contacts permission denied');
      }
    }
    
    // Set default fields if not provided
    const fields = options.fields || [
      Contacts.Fields.ID,
      Contacts.Fields.Name,
      Contacts.Fields.FirstName,
      Contacts.Fields.LastName,
      Contacts.Fields.PhoneNumbers,
      Contacts.Fields.Emails,
      Contacts.Fields.Addresses,
      Contacts.Fields.Company,
      Contacts.Fields.JobTitle
    ];
    
    // Fetch contacts
    const { data } = await Contacts.getContactsAsync({
      fields,
      sort: Contacts.SortTypes.FirstName,
      ...options
    });
    
    logger.info(`Fetched ${data.length} contacts`);
    return data;
  } catch (error) {
    logger.error(`Failed to get contacts: ${error.message}`);
    throw error;
  }
};

/**
 * Convert contacts to CSV format
 * @param {Array} contacts - Array of contacts
 * @returns {string} CSV string
 */
export const contactsToCSV = (contacts) => {
  if (!contacts || !contacts.length) {
    return 'No contacts found';
  }
  
  try {
    // CSV header
    let csv = 'Name,PhoneNumber,Email,Company,JobTitle,Address\n';
    
    // Add each contact as a row
    for (const contact of contacts) {
      const name = contact.name || 
                   `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 
                   'Unknown';
      
      const phone = contact.phoneNumbers && contact.phoneNumbers.length > 0 
        ? contact.phoneNumbers[0].number 
        : '';
      
      const email = contact.emails && contact.emails.length > 0 
        ? contact.emails[0].email 
        : '';
      
      const company = contact.company || '';
      const jobTitle = contact.jobTitle || '';
      
      const address = contact.addresses && contact.addresses.length > 0 
        ? `${contact.addresses[0].street || ''}, ${contact.addresses[0].city || ''}, ${contact.addresses[0].country || ''}`.replace(/^, |, $/, '') 
        : '';
      
      // Escape quotes and format CSV row
      csv += `"${name.replace(/"/g, '""')}","${phone.replace(/"/g, '""')}","${email.replace(/"/g, '""')}","${company.replace(/"/g, '""')}","${jobTitle.replace(/"/g, '""')}","${address.replace(/"/g, '""')}"\n`;
    }
    
    return csv;
  } catch (error) {
    logger.error(`Failed to convert contacts to CSV: ${error.message}`);
    return `Error: ${error.message}`;
  }
};

/**
 * Format a contact for display
 * @param {Object} contact - Contact object
 * @returns {string} Formatted contact string
 */
export const formatContact = (contact) => {
  if (!contact) return 'Invalid contact';
  
  const name = contact.name || 
               `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 
               'Unknown';
  
  const phones = contact.phoneNumbers 
    ? contact.phoneNumbers.map(p => p.number).join(', ') 
    : 'None';
  
  const emails = contact.emails 
    ? contact.emails.map(e => e.email).join(', ') 
    : 'None';
  
  const company = contact.company 
    ? `${contact.jobTitle ? contact.jobTitle + ' at ' : ''}${contact.company}` 
    : '';
  
  return `Name: ${name}\nPhone: ${phones}\nEmail: ${emails}${company ? '\n' + company : ''}`;
};

/**
 * Search contacts by query
 * @param {string} query - Search query
 * @param {Array} contacts - Array of contacts (optional, will fetch if not provided)
 * @returns {Promise<Array>} Array of matching contacts
 */
export const searchContacts = async (query, contacts = null) => {
  try {
    if (!query) return [];
    
    // If contacts not provided, fetch them
    const contactList = contacts || await getAllContacts();
    
    const lowerQuery = query.toLowerCase();
    
    return contactList.filter(contact => {
      // Search in name
      if ((contact.name && contact.name.toLowerCase().includes(lowerQuery)) ||
          (contact.firstName && contact.firstName.toLowerCase().includes(lowerQuery)) ||
          (contact.lastName && contact.lastName.toLowerCase().includes(lowerQuery))) {
        return true;
      }
      
      // Search in phone numbers
      if (contact.phoneNumbers && contact.phoneNumbers.some(p => 
        p.number && p.number.includes(query))) {
        return true;
      }
      
      // Search in emails
      if (contact.emails && contact.emails.some(e => 
        e.email && e.email.toLowerCase().includes(lowerQuery))) {
        return true;
      }
      
      // Search in company
      if (contact.company && contact.company.toLowerCase().includes(lowerQuery)) {
        return true;
      }
      
      return false;
    });
  } catch (error) {
    logger.error(`Contact search error: ${error.message}`);
    throw error;
  }
};

export default {
  getAllContacts,
  contactsToCSV,
  formatContact,
  searchContacts
};
