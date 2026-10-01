/**
 * Normalizes audio URLs from various cloud drives and hosting services so they can be
 * played directly in HTML5 <audio> elements.
 * 
 * Supported transformations:
 * - Google Drive: share / view links -> direct export=download or uc?export=download link
 * - Dropbox: ?dl=0 -> ?raw=1
 * - OneDrive: download links
 * - Internet Archive: direct media details
 * - Clean standard http/https mp3/wav/m4a/aac urls
 */
export function normalizeAudioUrl(rawUrl?: string | null): string {
  if (!rawUrl) return '';
  let url = rawUrl.trim();
  if (!url) return '';

  // 1. Google Drive Links:
  // Format A: https://drive.google.com/file/d/FILE_ID/view?usp=sharing
  // Format B: https://drive.google.com/open?id=FILE_ID
  // Format C: https://drive.google.com/uc?id=FILE_ID
  const driveMatch = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([a-zA-Z0-9_-]+)/);
  if (driveMatch && driveMatch[1]) {
    const fileId = driveMatch[1];
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
  }

  // 2. Dropbox Links:
  // Change ?dl=0 to ?raw=1 for direct streaming
  if (url.includes('dropbox.com')) {
    if (url.includes('?dl=0')) {
      return url.replace('?dl=0', '?raw=1');
    }
    if (url.includes('&dl=0')) {
      return url.replace('&dl=0', '&raw=1');
    }
    if (!url.includes('raw=1')) {
      return url.includes('?') ? `${url}&raw=1` : `${url}?raw=1`;
    }
  }

  // 3. GitHub raw links:
  if (url.includes('github.com') && url.includes('/blob/')) {
    return url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
  }

  return url;
}
