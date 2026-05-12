import { UserRole } from "@/types";

/**
 * Strips common professional prefixes from a name
 */
export const cleanName = (name: string): string => {
  if (!name) return "";
  // Remove prefixes like Dr., Doctor, Dr at the start of the string (case insensitive)
  const withoutPrefix = name.replace(/^(dr|dr\.|doctor)\s+/i, "").trim();
  
  // Capitalize first letter of each word
  return withoutPrefix
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

/**
 * Formats a user's name based on their role
 * Clinicians get a "Dr." prefix automatically.
 */
export const formatName = (name: string, role: string) => {
  if (!name) return '';
  let cleanName = name.trim();
  
  if (role === 'clinician') {
    // Aggressively remove all occurrences of "Dr." or "Dr" from the start
    // to ensure we only have exactly one "Dr." at the end.
    while (cleanName.toLowerCase().startsWith('dr.') || cleanName.toLowerCase().startsWith('dr ')) {
      if (cleanName.toLowerCase().startsWith('dr.')) cleanName = cleanName.slice(3).trim();
      else if (cleanName.toLowerCase().startsWith('dr ')) cleanName = cleanName.slice(3).trim();
    }
    // Now prepend exactly one "Dr. "
    return `Dr. ${cleanName}`;
  }
  return name;
};
