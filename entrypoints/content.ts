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
  setTimeout(() => {
    runEnhancements();
  }, 1000);
}

// Observe DOM changes to handle dynamically loaded content
function observePageChanges() {
  let debounceTimer: ReturnType<typeof setTimeout>;
  
  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      runEnhancements();
    }, 500);
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

function runEnhancements() {
  enhanceMovieCards();
  injectNoShadowCSS();
  hideExperienceSections();
  hideHeaderFooterSections();
  removeAdElements();
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
    padding: 3px 10px;
    margin: 2px auto;
    background: rgba(0,0,0,0.8);
    border-radius: 12px;
    font-size: 11px;
    color: white;
    display: block;
    text-align: center;
    width: fit-content;
  `;
  container.textContent = 'Loading...';
  return container;
}

// Fetch movie ratings from IMDb
async function fetchRatings(movieTitle: string, container: HTMLElement) {
  try {
    const ratings = await browser.runtime.sendMessage({
      type: 'GET_RATINGS',
      movieTitle
    });
    displayRatings(ratings, container);
  } catch {
    container.innerHTML = '<span style="color: #888; font-size: 10px;">Failed to load</span>';
  }
}

// Hide footer cinemas list, global header links, and slider arrows
function hideHeaderFooterSections() {
  try {
    const selector = [
      '.footer-cinemas',
      '.left-arrow.arrow',
      '.right-arrow.arrow',
    ].join(', ');
    document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
      el.style.setProperty('display', 'none', 'important');
      el.remove();
    });

    const styleId = 'ece-hide-header-footer-style';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .footer-cinemas,
        .left-arrow.arrow,
        .right-arrow.arrow { display: none !important; }
      `;
      document.head.appendChild(style);
    }
  } catch {}
}

// Display rating information
function displayRatings(ratings: any, container: HTMLElement) {
  if (!ratings?.imdbUrl) {
    container.innerHTML = '<span style="color: #888; font-size: 10px;">No data</span>';
    return;
  }
  
  const link = document.createElement('a');
  link.href = ratings.imdbUrl;
  link.target = '_blank';
  link.style.cssText = 'display: inline-flex; align-items: center; gap: 6px; text-decoration: none; cursor: pointer;';
  
  if (ratings.imdbRating) {
    const score = parseFloat(ratings.imdbRating);
    link.innerHTML = `
      <strong style="color: ${getScoreColor(score)};">${ratings.imdbRating}</strong>
      ${ratings.imdbVotes ? `<span style="color: #999; font-size: 9px;">(${ratings.imdbVotes})</span>` : ''}
    `;
  } else {
    link.innerHTML = '<span style="color: #f5c518; font-size: 10px;">View IMDb</span>';
  }
  
  container.innerHTML = '';
  container.appendChild(link);
}

// Get color based on rating score
function getScoreColor(score: number): string {
  if (score >= 7) return '#f5c518'; // Gold - Good
  if (score >= 5) return '#ffb400'; // Orange - Average
  return '#ff6161'; // Red - Poor
}

// Remove common ad containers
function removeAdElements() {
  try {
    // Remove ad network iframes directly
    const adIframes = document.querySelectorAll<HTMLElement>(
      'iframe[src*="doubleclick" i], iframe[src*="googlesyndication" i], iframe[src*="adservice" i], iframe[src*="adnxs" i], iframe[src*="taboola" i]'
    );
    adIframes.forEach((el) => el.remove());

    // CSS to hide common ad classes/containers
    const styleId = 'ece-adblock-style';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .ad, .ads, .adsbygoogle, .advertisement, .ad-slot, .adslot,
        .ad-container, .adcontainer, .ad-wrapper, .adbanner, .banner-ad,
        .leaderboard, .billboard, .sponsor, .sponsored, .promo-banner {
          display: none !important;
        }
      `;
      document.head.appendChild(style);
    }
  } catch (err) {
    // no-op
  }
}

// Remove drop-shadows on movie containers
function injectNoShadowCSS() {
  const styleId = 'ece-no-shadow-style';
  if (document.getElementById(styleId)) return;
  const style = document.createElement('style');
  style.id = styleId;
  const selectors = [
    // Common wrappers on Event Cinemas
    '.title-wrapper',
    '.movie-list-detail',
    // From provided DOM: exact classes
    '.movie-container',
    '.movie-container-item',
    '.movie-thumb-wrapper',
    '.movie-thumb',
    '.movie-info-wrapper',
    '.movie-release-date',
    '.mobile-grid-on-sale',
    '.mobile-trailer-wapper',
    '.mobile-arrow-right',
    // Heuristics for movie card/tile containers
    '[class*="movie-card" i]', '[class*="movie-tile" i]', '[class*="movie-item" i]',
    '[class*="movie-container" i]', '[class*="moviecontainer" i]',
    '[id*="movie-container" i]', '[id*="moviecontainer" i]',
    '[class*="film-card" i]', '[class*="film-tile" i]',
    '[class*="movie" i][class*="card" i]', '[class*="movie" i][class*="tile" i]'
  ].join(', ');
  style.textContent = `
    ${selectors},
    ${selectors} *,
    ${selectors} *::before,
    ${selectors} *::after {
      box-shadow: none !important;
      filter: none !important; /* covers drop-shadow() */
    }
    /* Anchor wrappers inside movie items */
    .movie-container-item a {
      box-shadow: none !important;
      filter: none !important;
      text-shadow: none !important;
    }
    /* Also catch common class names for shadow within the container */
    ${selectors} [class*="shadow" i] {
      box-shadow: none !important;
      filter: none !important;
    }
  `;
  document.head.appendChild(style);
}

// Hide homepage experience sections
function hideExperienceSections() {
  try {
    const selector = '.experience, .experience-bottom';
    document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
      el.style.setProperty('display', 'none', 'important');
      // Remove to avoid layout gaps
      el.remove();
    });

    // Fallback CSS for late-injected nodes
    const styleId = 'ece-hide-experience-style';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .experience, .experience-bottom {
          display: none !important;
        }
      `;
      document.head.appendChild(style);
    }
  } catch (err) {
    // no-op
  }
}
