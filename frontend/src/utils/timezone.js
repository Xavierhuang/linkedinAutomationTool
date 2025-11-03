import { toZonedTime, formatInTimeZone } from 'date-fns-tz';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Get user's timezone preference from backend or detect automatically
 */
export const getUserTimezone = async (userId) => {
  try {
    const response = await axios.get(`${BACKEND_URL}/api/settings/timezone?user_id=${userId}`);
    const savedTimezone = response.data.timezone;
    
    // If user has saved a timezone, use it
    if (savedTimezone && savedTimezone.trim() !== '') {
      return savedTimezone;
    }
    
    // Otherwise, auto-detect
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    console.error('Error fetching timezone:', error);
    // Fallback to auto-detection
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
};

/**
 * Convert UTC time to user's local timezone for display
 * @param {string|Date} utcTime - UTC time (ISO string or Date object)
 * @param {string} timezone - User's timezone (e.g., 'Africa/Nairobi')
 * @param {string} formatStr - Display format (default: 'MMM d, yyyy h:mm a')
 * @returns {string} Formatted time in user's timezone
 */
export const convertUTCToUserTime = (utcTime, timezone, formatStr = 'MMM d, yyyy h:mm a') => {
  if (!utcTime) return '';
  
  try {
    // Parse the UTC time and format it in the user's timezone
    const date = typeof utcTime === 'string' ? new Date(utcTime) : utcTime;
    return formatInTimeZone(date, timezone, formatStr);
  } catch (error) {
    console.error('Error converting UTC to user time:', error, { utcTime, timezone });
    return new Date(utcTime).toLocaleString();
  }
};

/**
 * Convert user's local time to UTC for storage
 * @param {string} localTime - Local time string
 * @param {string} timezone - User's timezone
 * @returns {string} ISO string in UTC
 */
export const convertUserTimeToUTC = (localTime, timezone) => {
  try {
    // Create a date in the user's timezone and convert to UTC
    const date = new Date(localTime);
    return date.toISOString();
  } catch (error) {
    console.error('Error converting user time to UTC:', error);
    return new Date(localTime).toISOString();
  }
};

/**
 * Get just the time portion in user's timezone (e.g., "9:00 AM")
 * @param {string|Date} utcTime - UTC time
 * @param {string} timezone - User's timezone (not used, browser handles it)
 * @returns {string} Time string (e.g., "9:00 AM")
 */
export const getTimeInUserTimezone = (utcTime, timezone) => {
  if (!utcTime) return '';
  
  try {
    let dateStr = utcTime;
    
    // If it's a string without 'Z', add it to indicate UTC
    if (typeof dateStr === 'string' && !dateStr.endsWith('Z') && !dateStr.includes('+')) {
      dateStr = dateStr + 'Z';
    }
    
    const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch (error) {
    console.error('Error formatting time:', error);
    return '';
  }
};

/**
 * Get just the date portion in user's timezone (e.g., "Oct 21, 2025")
 * @param {string|Date} utcTime - UTC time
 * @param {string} timezone - User's timezone
 * @returns {string} Date string
 */
export const getDateInUserTimezone = (utcTime, timezone) => {
  return convertUTCToUserTime(utcTime, timezone, 'MMM d, yyyy');
};

/**
 * Get day of week in user's timezone (e.g., "Monday")
 * @param {string|Date} utcTime - UTC time
 * @param {string} timezone - User's timezone
 * @returns {string} Day name
 */
export const getDayInUserTimezone = (utcTime, timezone) => {
  return convertUTCToUserTime(utcTime, timezone, 'EEEE');
};



