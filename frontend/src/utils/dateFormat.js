/**
 * Format date to DDMMMYYYY format (e.g., 18FEB2026)
 * @param {string|Date} dateInput - Date string or Date object
 * @param {boolean} includeTime - Whether to include time
 * @returns {string} Formatted date string
 */
export const formatDateDDMMMYYYY = (dateInput, includeTime = false) => {
  if (!dateInput) return 'N/A';
  
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return 'N/A';
    
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    
    let result = `${day}${month}${year}`;
    
    if (includeTime) {
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      result += ` ${hours}:${minutes}`;
    }
    
    return result;
  } catch (e) {
    return 'N/A';
  }
};

/**
 * Format date with readable separator (e.g., 18 FEB 2026)
 */
export const formatDateReadable = (dateInput, includeTime = false) => {
  if (!dateInput) return 'N/A';
  
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return 'N/A';
    
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    
    let result = `${day} ${month} ${year}`;
    
    if (includeTime) {
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      result += `, ${hours}:${minutes}`;
    }
    
    return result;
  } catch (e) {
    return 'N/A';
  }
};

export default formatDateDDMMMYYYY;
