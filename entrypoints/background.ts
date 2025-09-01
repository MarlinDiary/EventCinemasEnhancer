export default defineBackground(() => {
  // Clean expired cache on startup
  cleanExpiredCache();
  
  // Listen for messages from content script
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'GET_RATINGS') {
      // Fetch ratings with caching
      getCachedOrFetchRatings(message.movieTitle)
        .then(sendResponse)
        .catch(() => sendResponse(null));
      
      return true; // Indicates async response
    }
  });
});

// Cache configuration
const CACHE_PREFIX = 'imdb_rating_';
const CACHE_EXPIRY_DAYS = 3;
const CACHE_EXPIRY_MS = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

// Get cached rating or fetch new one
async function getCachedOrFetchRatings(movieTitle: string) {
  const cacheKey = CACHE_PREFIX + cleanMovieTitle(movieTitle);
  
  try {
    // Check cache first
    const cached = await browser.storage.local.get(cacheKey);
    if (cached[cacheKey]) {
      const { data, timestamp } = cached[cacheKey];
      
      // Check if cache is still valid (within 3 days)
      if (Date.now() - timestamp < CACHE_EXPIRY_MS) {
        console.log('Using cached data for:', movieTitle);
        return data;
      }
    }
    
    // Cache miss or expired, fetch new data
    console.log('Fetching fresh data for:', movieTitle);
    const ratings = await fetchMovieRatings(movieTitle);
    
    // Log result
    console.log(ratings ? `Found rating for "${movieTitle}": ${ratings.imdbRating || 'N/A'}` : `No data for "${movieTitle}"`)
    
    // Store in cache if we got valid data
    if (ratings) {
      await browser.storage.local.set({
        [cacheKey]: {
          data: ratings,
          timestamp: Date.now()
        }
      });
    }
    
    return ratings;
  } catch (error) {
    console.error('Cache error:', error);
    // Fallback to direct fetch if cache fails
    return fetchMovieRatings(movieTitle);
  }
}

// Fetch movie ratings from IMDb API
async function fetchMovieRatings(movieTitle: string) {
  try {
    // Try multiple search strategies
    const searchStrategies = [
      () => cleanMovieTitle(movieTitle),
      () => movieTitle.toLowerCase()
        .replace(/ - (english|chinese|japanese|hindi|dubbed|subtitled).*$/i, '')
        .replace(/:.*$/i, '')
        .replace(/ (part|chapter|episode) \d+.*$/i, '')
        .trim(),
      () => movieTitle.split(' ').slice(0, 3).join(' ').toLowerCase()
    ];
    
    let searchData = null;
    for (const strategy of searchStrategies) {
      const searchTerm = strategy();
      if (searchTerm) {
        searchData = await searchIMDb(searchTerm);
        if (searchData?.description?.length) break;
      }
    }
    
    if (!searchData?.description?.length) return null;
    
    const movie = searchData.description[0];
    const imdbId = movie['#IMDB_ID'];
    const imdbUrl = movie['#IMDB_URL'] || `https://www.imdb.com/title/${imdbId}`;
    
    // Try to get rating from OMDb
    const rating = await fetchOMDbRating(imdbId);
    
    // Return combined data
    return {
      imdbId,
      imdbUrl,
      imdbRating: rating?.imdbRating || null,
      imdbVotes: rating?.imdbVotes || null
    };
  } catch {
    return null;
  }
}

// Clean movie title for better search results and cache key
function cleanMovieTitle(title: string): string {
  return title
    .replace(/ - \d+th Anniversary$/i, '')
    .replace(/ \d{4}$/, '') // Remove year
    .trim()
    .toLowerCase(); // Normalize for cache key
}

// Search IMDb for movie
async function searchIMDb(title: string) {
  try {
    const response = await fetch(`https://search.imdbot.workers.dev/?q=${encodeURIComponent(title)}`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.ok ? data : null;
  } catch {
    return null;
  }
}

// Get rating information from OMDb
async function fetchOMDbRating(imdbId: string) {
  try {
    const response = await fetch(`https://www.omdbapi.com/?i=${imdbId}&apikey=trilogy`);
    if (!response.ok) return null;
    
    const details = await response.json();
    return details.imdbRating && details.imdbRating !== 'N/A' 
      ? { imdbRating: details.imdbRating, imdbVotes: details.imdbVotes }
      : null;
  } catch {
    return null;
  }
}

// Clean expired cache entries
async function cleanExpiredCache() {
  try {
    const allItems = await browser.storage.local.get(null);
    const now = Date.now();
    const keysToRemove: string[] = [];
    
    for (const key in allItems) {
      if (key.startsWith(CACHE_PREFIX)) {
        const { timestamp } = allItems[key];
        if (now - timestamp > CACHE_EXPIRY_MS) {
          keysToRemove.push(key);
        }
      }
    }
    
    if (keysToRemove.length > 0) {
      await browser.storage.local.remove(keysToRemove);
      console.log(`Cleaned ${keysToRemove.length} expired cache entries`);
    }
  } catch (error) {
    console.error('Error cleaning cache:', error);
  }
}
