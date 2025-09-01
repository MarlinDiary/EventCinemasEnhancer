export default defineContentScript({
  matches: ['*://*.eventcinemas.co.nz/*'],
  main() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  },
});

function init() {
  // Monitor page changes (Event Cinema is a SPA)
  observePageChanges();
  
  // Initial scan (delayed to ensure dynamic content is loaded)
  setTimeout(enhanceMovieCards, 1000);
}

// Observe DOM changes to handle dynamically loaded content
function observePageChanges() {
  let debounceTimer: NodeJS.Timeout;
  
  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(enhanceMovieCards, 500);
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Enhance movie cards with IMDb ratings
function enhanceMovieCards() {
  document.querySelectorAll('.title-wrapper .title, .movie-list-detail .title')
    .forEach(titleDiv => {
      // Skip if already processed
      if (titleDiv.parentElement?.querySelector('.rating-enhancer')) return;
      
      const movieTitle = extractMovieTitle(titleDiv);
      if (!movieTitle || !titleDiv.parentNode) return;
      
      // Create and insert rating container
      const ratingsContainer = createRatingsContainer();
      titleDiv.parentNode.insertBefore(ratingsContainer, titleDiv.nextSibling);
      
      // Fetch and display ratings
      fetchRatings(movieTitle, ratingsContainer);
    });
}

// Extract movie title from title element
function extractMovieTitle(titleDiv: Element): string | null {
  const nameSpan = titleDiv.querySelector('span.name') || titleDiv.querySelector('span');
  if (!nameSpan) return null;
  
  // Get all text before the rating span
  let movieTitle = '';
  for (const node of nameSpan.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      movieTitle += node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE && 
               (node as HTMLElement).classList.contains('rating')) {
      break;
    }
  }
  
  return movieTitle.trim() || null;
}

// Create rating container element
function createRatingsContainer(): HTMLDivElement {
  const container = document.createElement('div');
  container.className = 'rating-enhancer';
  container.style.cssText = `
    padding: 4px 8px;
    margin: 4px 0;
    background: rgba(0,0,0,0.8);
    border-radius: 4px;
    font-size: 11px;
    color: white;
    display: inline-block;
    text-align: center;
  `;
  container.textContent = 'Loading...';
  return container;
}

// Fetch movie ratings from IMDb
async function fetchRatings(movieTitle: string, container: HTMLElement) {
  try {
    const currentYear = new Date().getFullYear();
    // Try with year first for better accuracy
    const ratings = await browser.runtime.sendMessage({
      type: 'GET_RATINGS',
      movieTitle: `${movieTitle} ${currentYear}`
    }) || await browser.runtime.sendMessage({
      type: 'GET_RATINGS',
      movieTitle
    });
    
    displayRatings(ratings, container);
  } catch {
    container.innerHTML = '<span style="color: #888; font-size: 10px;">Failed to load</span>';
  }
}

// Display rating information
function displayRatings(ratings: any, container: HTMLElement) {
  if (!ratings || (!ratings.imdbRating && !ratings.imdbUrl)) {
    container.innerHTML = '<span style="color: #888; font-size: 10px;">No data</span>';
    return;
  }
  
  const imdbUrl = ratings.imdbUrl || `https://www.imdb.com/title/${ratings.imdbId || ''}`;
  
  if (ratings.imdbRating) {
    const score = parseFloat(ratings.imdbRating);
    const scoreColor = getScoreColor(score);
    container.innerHTML = `
      <a href="${imdbUrl}" target="_blank" 
         style="display: inline-flex; align-items: center; gap: 4px; text-decoration: none; cursor: pointer;">
        <img src="https://upload.wikimedia.org/wikipedia/commons/6/69/IMDB_Logo_2016.svg" 
             style="height: 12px; filter: brightness(0) invert(1);" alt="IMDb">
        <strong style="color: ${scoreColor};">${ratings.imdbRating}</strong>
        ${ratings.imdbVotes ? `<span style="color: #999; font-size: 9px;">(${ratings.imdbVotes})</span>` : ''}
      </a>
    `;
  } else {
    container.innerHTML = `
      <a href="${imdbUrl}" target="_blank" 
         style="color: #f5c518; text-decoration: none; cursor: pointer;">
        <span style="font-size: 10px;">View IMDb</span>
      </a>
    `;
  }
}

// Get color based on rating score
function getScoreColor(score: number): string {
  if (score >= 7) return '#f5c518'; // Gold - Good
  if (score >= 5) return '#ffb400'; // Orange - Average
  return '#ff6161'; // Red - Poor
}
