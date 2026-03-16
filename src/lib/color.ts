/**
 * Flux Protocol OS — Color Utilities
 */

/**
 * Calculates the appropriate text color (dark or light) for a given background hex color
 * based on perceived luminance (ITU-R BT.601).
 * 
 * @param hex - The background color in hex format (e.g., "#FFE01A")
 * @returns A hex string for dark text (#1A1600) or a semi-transparent white for light text.
 */
export function getTextOnColor(hex: string): string {
  // Remove hash if present
  const cleanHex = hex.startsWith('#') ? hex.slice(1) : hex;
  
  // Parse RGB
  const r = parseInt(cleanHex.slice(0, 2), 16);
  const g = parseInt(cleanHex.slice(2, 4), 16);
  const b = parseInt(cleanHex.slice(4, 6), 16);
  
  // Perceived luminance (ITU-R BT.601)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Threshold 0.5: return dark text for light backgrounds, light text for dark backgrounds
  return luminance > 0.5 ? '#1A1600' : 'rgba(255, 255, 255, 0.92)';
}
