export default defineBackground(() => {
  // Listen for messages from content script
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'GET_RATINGS') {
      // Fetch ratings asynchronously
      fetchMovieRatings(message.movieTitle)
        .then(sendResponse)
        .catch(() => sendResponse(null));
      
      return true; // Indicates async response
    }
  });
});

// Fetch movie ratings from IMDb API
async function fetchMovieRatings(movieTitle: string) {
  try {
    const searchData = await searchIMDb(cleanMovieTitle(movieTitle));
    if (!searchData?.description?.length) return null;
    
    const movie = searchData.description[0];
    const imdbId = movie['#IMDB_ID'];
    const rating = await fetchOMDbRating(imdbId);
    
    return {
      ...rating,
      imdbId,
      imdbUrl: movie['#IMDB_URL'] || `https://www.imdb.com/title/${imdbId}`
    };
  } catch {
    return null;
  }
}

// Clean movie title for better search results
function cleanMovieTitle(title: string): string {
  return title
    .replace(/ - (English|Japanese|Hindi|Chinese).*$/i, '')
    .replace(/ - \d+th Anniversary$/i, '')
    .replace(/: (The Movie|First Steps)$/i, '')
    .replace(/ \d{4}$/, '') // Remove year
    .trim();
}

// Search IMDb for movie
async function searchIMDb(title: string) {
  const response = await fetch(
    `https://search.imdbot.workers.dev/?q=${encodeURIComponent(title)}`
  );
  
  if (!response.ok) return null;
  
  const data = await response.json();
  return data.ok ? data : null;
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
