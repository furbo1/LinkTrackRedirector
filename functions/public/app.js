// Enhanced URL Shortener Dashboard JavaScript
// Handles UI interactions, data fetching, filtering and sorting

// Global state
let statsData = [];
let currentSortField = 'totalClicks';
let currentSortDirection = 'desc';
let currentFilter = '';
let currentCountryFilter = '';

// Global state for filters and sorting
let currentFilters = {
  shortCode: null,
  date: null, 
  country: null,
  sortBy: 'clicks',
  sortOrder: 'desc'
};

// Available countries cache for filter dropdown
let availableCountries = [];
// Available dates cache for filter dropdown
let availableDates = [];

// Define the site domain as a global constant
const SITE_DOMAIN = 'dls.sale';

// Initialize Firebase with configuration
const firebaseConfig = {
  apiKey: window.env.FIREBASE_API_KEY,
  authDomain: window.env.FIREBASE_AUTH_DOMAIN,
  projectId: window.env.FIREBASE_PROJECT_ID,
  storageBucket: window.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: window.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: window.env.FIREBASE_APP_ID
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  // Initialize tabs
  setupTabs();
  
  // Setup filter and sort controls
  setupFiltersAndSorting();
  
  // Load stats if stats tab is active
  if (document.querySelector('#stats').classList.contains('active')) {
    loadClickStatistics();
  }
  
  // Add a MutationObserver to watch for table changes
  const statsBody = document.getElementById('stats-body');
  if (statsBody) {
    console.log("Setting up mutation observer for stats table");
    const observer = new MutationObserver(function(mutations) {
      checkDeleteButtonVisibility();
    });
    
    observer.observe(statsBody, { childList: true, subtree: true });
  }
});

// Tab switching setup
function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', function() {
      const tabId = this.getAttribute('data-tab');
      switchTab(tabId);
    });
  });
}

// Setup filters and sorting for statistics
function setupFiltersAndSorting() {
  // Setup sort dropdown
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', function() {
      const [field, direction] = this.value.split('-');
      currentSortField = field;
      currentSortDirection = direction;
      renderStatsTable(statsData);
    });
  }
  
  // Setup search filter
  const searchInput = document.getElementById('search-filter');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      currentFilter = this.value.toLowerCase();
      renderStatsTable(statsData);
    });
  }
  
  // Setup country filter
  const countrySelect = document.getElementById('country-filter');
  if (countrySelect) {
    countrySelect.addEventListener('change', function() {
      currentCountryFilter = this.value;
      renderStatsTable(statsData);
    });
  }
  
  // Setup date range filter
  const dateFromInput = document.getElementById('date-from');
  const dateToInput = document.getElementById('date-to');
  const applyDateFilterBtn = document.getElementById('apply-date-filter');
  
  if (applyDateFilterBtn) {
    applyDateFilterBtn.addEventListener('click', function() {
      loadClickStatistics({
        dateFrom: dateFromInput.value,
        dateTo: dateToInput.value
      });
    });
  }
  
  // Reset filters button
  const resetFiltersBtn = document.getElementById('reset-filters');
  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener('click', function() {
      // Reset all filter controls
      if (searchInput) searchInput.value = '';
      if (countrySelect) countrySelect.value = '';
      if (dateFromInput) dateFromInput.value = '';
      if (dateToInput) dateToInput.value = '';
      if (sortSelect) sortSelect.value = 'totalClicks-desc';
      
      // Reset global state
      currentFilter = '';
      currentCountryFilter = '';
      currentSortField = 'totalClicks';
      currentSortDirection = 'desc';
      
      // Reload stats
      loadClickStatistics();
    });
  }
}

// Tab switching logic
function switchTab(tabId) {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.remove('active');
    const dataTab = tab.getAttribute('data-tab');
    if (dataTab === tabId) {
      tab.classList.add('active');
    }
  });
  
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  
  document.getElementById(tabId).classList.add('active');
  
  if (tabId === 'stats') {
    console.log("Stats tab activated, initializing filters...");
    // Initialize filters before loading statistics
    initializeFilters();
    // Load the statistics data
    loadClickStatistics();
  }
}

// Display error message
function showError(message, isSuccess = false) {
  const errorElement = document.getElementById('error-message');
  errorElement.textContent = message;
  errorElement.style.display = 'block';
  
  if (isSuccess) {
    errorElement.className = 'message success';
  } else {
    errorElement.className = 'message error';
  }
  
  setTimeout(() => {
    errorElement.style.display = 'none';
  }, 5000);
}

// Single URL shortening
async function shortenUrl() {
  const urlInput = document.getElementById('url-input');
  const url = urlInput.value.trim();
  
  if (!url) {
    showError('Please enter a URL');
    return;
  }
  
  try {
    const response = await fetch('/api/shorten', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url })
    });
    
    const data = await response.json();
    
    if (data.error) {
      showError(data.error);
      return;
    }
    
    const originalUrlLink = document.getElementById('original-url-link');
    originalUrlLink.textContent = data.originalUrl;
    originalUrlLink.href = data.originalUrl;
    
    const shortUrlLink = document.getElementById('short-url-link');
    shortUrlLink.textContent = data.shortUrl;
    shortUrlLink.href = data.shortUrl;
    document.getElementById('result').style.display = 'block';
    
    // Show success message
    showError('URL shortened successfully!', true);
  } catch (error) {
    showError('Error shortening URL: ' + error.message);
  }
}

// Bulk URL shortening
async function bulkShortenUrls() {
  const bulkUrls = document.getElementById('bulk-urls').value.trim();
  
  if (!bulkUrls) {
    showError('Please enter at least one URL');
    return;
  }
  
  const urls = bulkUrls.split('\n');
  const resultsBody = document.getElementById('results-body');
  resultsBody.innerHTML = '';
  
  const validLinks = [];
  
  for (const url of urls) {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) continue;
    
    try {
      const response = await fetch('/api/shorten', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: trimmedUrl })
      });
      
      const data = await response.json();
      
      if (data.error) {
        const row = document.createElement('tr');
        row.innerHTML = '<td>' + trimmedUrl + '</td><td><span style="color: red;">Error: ' + data.error + '</span></td><td>N/A</td>';
        resultsBody.appendChild(row);
      } else {
        const row = document.createElement('tr');
        row.innerHTML = 
          '<td><a href="' + data.originalUrl + '" target="_blank">' + data.originalUrl + '</a></td>' +
          '<td><a href="' + data.shortUrl + '" target="_blank">' + data.shortUrl + '</a></td>' +
          '<td><button class="copy-btn" onclick="copyText(\'' + data.shortUrl + '\')">Copy</button></td>';
        resultsBody.appendChild(row);
        
        validLinks.push(data.shortUrl);
      }
    } catch (error) {
      const row = document.createElement('tr');
      row.innerHTML = '<td>' + trimmedUrl + '</td><td><span style="color: red;">Error processing URL</span></td><td>N/A</td>';
      resultsBody.appendChild(row);
    }
  }
  
  document.getElementById('bulk-results').style.display = 'block';
  
  // Store valid links for the "Copy All" button
  window.validLinks = validLinks;
  
  if (validLinks.length > 0) {
    showError(`Successfully shortened ${validLinks.length} URLs!`, true);
  }
}

// Copy functions
function copyToClipboard(elementId) {
  const element = document.getElementById(elementId);
  copyText(element.textContent);
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => {
    showError('Copied to clipboard!', true);
  }).catch(err => {
    showError('Failed to copy: ' + err);
  });
}

function copyAllLinks() {
  if (!window.validLinks || window.validLinks.length === 0) {
    showError('No valid links to copy');
    return;
  }
  
  const links = window.validLinks.join('\n');
  navigator.clipboard.writeText(links).then(() => {
    showError('All links copied to clipboard!', true);
  }).catch(err => {
    showError('Failed to copy: ' + err);
  });
}

// Load click statistics with optional filters
async function loadClickStatistics(filters = {}) {
  try {
    document.getElementById('refreshStatsBtn').disabled = true;
    document.getElementById('refreshStatsBtn').textContent = 'Loading...';
    
    // Build query string for filters
    const queryParams = new URLSearchParams();
    if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) queryParams.append('dateTo', filters.dateTo);
    
    const queryString = queryParams.toString();
    const endpoint = '/api/click-stats' + (queryString ? `?${queryString}` : '');
    
    const response = await fetch(endpoint);
    const data = await response.json();
    
    // Store the original data for filtering
    statsData = data.stats || [];
    
    // Generate list of countries for the filter dropdown
    updateCountryFilterOptions(statsData);
    
    // Render the data with current filters
    renderStatsTable(statsData);
    
    document.getElementById('refreshStatsBtn').disabled = false;
    document.getElementById('refreshStatsBtn').textContent = 'Refresh Statistics';
    
    // Hide detailed stats section initially
    document.getElementById('detailed-stats').style.display = 'none';
    
    // Check for delete buttons after table is rendered
    setTimeout(checkDeleteButtonVisibility, 500);
    
    // Update summary statistics
    updateSummaryStatistics(statsData);
  } catch (error) {
    console.error('Error loading statistics:', error);
    showError('Error loading statistics: ' + error.message);
    
    const statsBody = document.getElementById('stats-body');
    statsBody.innerHTML = '<tr><td colspan="7">Error loading statistics. Please try again.</td></tr>';
    
    document.getElementById('refreshStatsBtn').disabled = false;
    document.getElementById('refreshStatsBtn').textContent = 'Refresh Statistics';
  }
}

// Update country filter dropdown with available countries
function updateCountryFilterOptions(stats) {
  const countrySelect = document.getElementById('country-filter');
  if (!countrySelect) return;
  
  // Clear existing options except the default
  while (countrySelect.options.length > 1) {
    countrySelect.remove(1);
  }
  
  // Collect all unique countries
  const uniqueCountries = new Set();
  stats.forEach(stat => {
    if (stat.countryData) {
      Object.keys(stat.countryData).forEach(country => {
        uniqueCountries.add(country);
      });
    }
  });
  
  // Add countries to dropdown
  const sortedCountries = Array.from(uniqueCountries).sort();
  sortedCountries.forEach(country => {
    const option = document.createElement('option');
    option.value = country;
    option.textContent = country;
    countrySelect.appendChild(option);
  });
}

// Render stats table with sorting and filtering
function renderStatsTable(stats) {
  const statsBody = document.getElementById('stats-body');
  statsBody.innerHTML = '';
  
  // Apply text filter
  let filteredStats = stats;
  if (currentFilters.shortCode) {
    filteredStats = filteredStats.filter(stat => 
      stat.shortCode.toLowerCase().includes(currentFilters.shortCode.toLowerCase())
    );
  }
  
  // Apply country filter
  if (currentFilters.country) {
    filteredStats = filteredStats.filter(stat => 
      stat.countryData && stat.countryData[currentFilters.country]
    );
  }
  
  // Apply date filter
  if (currentFilters.date) {
    filteredStats = filteredStats.filter(stat => 
      stat.dailyClickData && stat.dailyClickData[currentFilters.date]
    );
  }
  
  // Apply sorting
  filteredStats.sort((a, b) => {
    let valueA, valueB;
    
    // Determine which field to sort by
    switch(currentFilters.sortBy) {
      case 'code':
        valueA = a.shortCode.toLowerCase();
        valueB = b.shortCode.toLowerCase();
        return currentFilters.sortOrder === 'asc' 
          ? valueA.localeCompare(valueB)
          : valueB.localeCompare(valueA);
      
      case 'url':
        valueA = a.targetUrl.toLowerCase();
        valueB = b.targetUrl.toLowerCase();
        return currentFilters.sortOrder === 'asc' 
          ? valueA.localeCompare(valueB)
          : valueB.localeCompare(valueA);
      
      case 'date':
        valueA = a.lastClickAt ? new Date(a.lastClickAt).getTime() : 0;
        valueB = b.lastClickAt ? new Date(b.lastClickAt).getTime() : 0;
        break;
        
      case 'clicks':
      default:
        valueA = a.totalClicks || 0;
        valueB = b.totalClicks || 0;
    }
    
    // Apply sort order for numeric values
    if (currentFilters.sortBy === 'date' || currentFilters.sortBy === 'clicks') {
      return currentFilters.sortOrder === 'asc' ? valueA - valueB : valueB - valueA;
    }
    
    // String comparison already done above for code and url
    return 0;
  });
  
  // Check if no data after filtering
  if (filteredStats.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = '<td colspan="8">No matching statistics found. Try different filters.</td>';
    statsBody.appendChild(row);
    return;
  }
  
  // Update stats count
  const statsCount = document.getElementById('stats-count');
  if (statsCount) {
    statsCount.textContent = `Showing ${filteredStats.length} of ${stats.length} URLs`;
  }
  
  // Render rows
  let rowCounter = 0;
  for (const stat of filteredStats) {
    // Create main row
    const row = document.createElement('tr');
    row.className = 'url-main-row';
    row.setAttribute('data-shortcode', stat.shortCode);
    if (rowCounter % 2 === 0) {
      row.classList.add('highlight-row');
    }
    rowCounter++;
    
    const lastClickDate = stat.lastClickAt 
      ? new Date(stat.lastClickAt).toLocaleString() 
      : 'N/A';
    
    const shortUrl = `https://${SITE_DOMAIN}/r/${stat.shortCode}`;
    
    // Format top countries
    let topCountries = 'None';
    if (stat.countryData && Object.keys(stat.countryData).length > 0) {
      const countries = Object.entries(stat.countryData)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([country, count]) => country + ' (' + count + ')')
        .join(', ');
      
      if (countries) {
        topCountries = countries;
      }
    }
    
    // Create the basic row content with URL preview button
    row.innerHTML = `
      <td>${stat.shortCode}</td>
      <td><a href="${shortUrl}" target="_blank">${shortUrl}</a></td>
      <td>
        <div class="target-url-container">
          <a href="${stat.targetUrl}" target="_blank">${stat.targetUrl}</a>
          <button class="preview-toggle-btn" data-shortcode="${stat.shortCode}">Preview</button>
        </div>
      </td>
      <td>${stat.totalClicks || 0}</td>
      <td>${lastClickDate}</td>
      <td>${topCountries}</td>
      <td></td>
    `;
    
    // Create the action buttons container
    const actionsCell = row.querySelector('td:last-child');
    const actionButtons = document.createElement('div');
    actionButtons.className = 'action-buttons';
    
    // Create and append copy button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', function() {
      copyText(shortUrl);
    });
    
    // Create and append details button
    const detailsBtn = document.createElement('button');
    detailsBtn.className = 'details-btn';
    detailsBtn.textContent = 'Details';
    detailsBtn.addEventListener('click', function() {
      showClickDetails(stat.shortCode);
    });
    
    // Create and append delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.setAttribute('data-shortcode', stat.shortCode);
    // Apply the styles directly to ensure Firefox compatibility
    deleteBtn.style.backgroundColor = '#f44336';
    deleteBtn.style.color = 'white';
    deleteBtn.style.border = 'none';
    deleteBtn.style.borderRadius = '4px';
    deleteBtn.style.padding = '5px 10px';
    deleteBtn.style.marginLeft = '5px';
    deleteBtn.style.cursor = 'pointer';
    deleteBtn.style.display = 'inline-block';
    deleteBtn.style.visibility = 'visible';
    deleteBtn.style.opacity = '1';
    deleteBtn.style.fontSize = '0.8em';
    
    // Use an event listener instead of onclick attribute
    deleteBtn.addEventListener('click', function() {
      deleteUrlMapping(stat.shortCode);
    });
    
    // Append all buttons to the action container
    actionButtons.appendChild(copyBtn);
    actionButtons.appendChild(detailsBtn);
    actionButtons.appendChild(deleteBtn);
    
    // Append the action container to the cell
    actionsCell.appendChild(actionButtons);
    
    // Append the main row to the table
    statsBody.appendChild(row);
    
    // Create a preview row
    const previewRow = document.createElement('tr');
    previewRow.className = 'url-preview-row';
    previewRow.id = `preview-row-${stat.shortCode}`;
    previewRow.style.display = 'none'; // Hidden by default
    
    // Create a cell that spans all columns
    const previewCell = document.createElement('td');
    previewCell.colSpan = 7;
    previewCell.className = 'url-preview-cell';
    
    // Add preview content
    previewCell.innerHTML = `
      <div class="url-preview-wrapper">
        <div class="url-preview-header">
          <h4>Preview of ${stat.targetUrl.substring(0, 50)}${stat.targetUrl.length > 50 ? '...' : ''}</h4>
          <div class="url-stats-summary">
            <div class="stat-block">
              <div class="stat-label">Total Clicks</div>
              <div class="stat-value">${stat.totalClicks || 0}</div>
            </div>
            <div class="stat-block">
              <div class="stat-label">Last Click</div>
              <div class="stat-value">${stat.lastClickAt ? new Date(stat.lastClickAt).toLocaleDateString() : 'Never'}</div>
            </div>
            <div class="stat-block">
              <div class="stat-label">Performance</div>
              <div class="stat-value">${getPerformanceIndicator(stat)}</div>
            </div>
          </div>
        </div>
        <div class="url-preview-content">
          <div class="preview-loading">Loading preview...</div>
          <div class="meta-preview-container" id="meta-preview-${stat.shortCode}">
            <div class="meta-preview-image-container">
              <img src="/placeholder-image.png" alt="Site preview" class="meta-preview-image">
            </div>
            <div class="meta-preview-info">
              <h3 class="meta-preview-title">Loading title...</h3>
              <p class="meta-preview-description">Loading description...</p>
              <p class="meta-preview-domain"></p>
            </div>
          </div>
          <div class="click-list-preview">
            <h4>Recent Clicks (Last 5)</h4>
            <div class="click-list-container" id="click-list-${stat.shortCode}">
              <p>Loading click data...</p>
            </div>
            <button class="view-all-clicks-btn" data-shortcode="${stat.shortCode}">View All Details</button>
          </div>
        </div>
      </div>
    `;
    
    // Append the preview row
    previewRow.appendChild(previewCell);
    statsBody.appendChild(previewRow);
    
    // Fetch meta data for this URL
    fetchMetaData(stat.targetUrl, `meta-preview-${stat.shortCode}`);
    
    // Load recent clicks for this URL
    if (stat.recentClicks && stat.recentClicks.length > 0) {
      renderRecentClicks(stat.recentClicks.slice(0, 5), `click-list-${stat.shortCode}`);
    } else {
      document.getElementById(`click-list-${stat.shortCode}`).innerHTML = 
        '<p class="no-data">No click data available</p>';
    }
  }
  
  // Add toggle functionality for preview buttons
  document.querySelectorAll('.preview-toggle-btn').forEach(button => {
    button.addEventListener('click', function() {
      const shortCode = this.getAttribute('data-shortcode');
      const previewRow = document.getElementById(`preview-row-${shortCode}`);
      
      if (previewRow) {
        // Toggle the display
        if (previewRow.style.display === 'none' || !previewRow.style.display) {
          // First hide all other previews
          document.querySelectorAll('.url-preview-row').forEach(row => {
            row.style.display = 'none';
            // Reset all other button texts
            document.querySelectorAll('.preview-toggle-btn').forEach(btn => {
              if (btn !== this) btn.textContent = 'Preview';
            });
          });
          
          // Then show this preview
          previewRow.style.display = 'table-row';
          this.textContent = 'Hide Preview';
        } else {
          previewRow.style.display = 'none';
          this.textContent = 'Preview';
        }
      }
    });
  });
  
  // Add event listeners for view all clicks buttons
  document.querySelectorAll('.view-all-clicks-btn').forEach(button => {
    button.addEventListener('click', function() {
      const shortCode = this.getAttribute('data-shortcode');
      showClickDetails(shortCode);
    });
  });
  
  // Add CSS for preview rows if not already added
  if (!document.getElementById('stats-preview-styles')) {
    const style = document.createElement('style');
    style.id = 'stats-preview-styles';
    style.textContent = `
      .url-preview-cell {
        padding: 0 !important;
      }
      .url-preview-wrapper {
        padding: 15px;
        background-color: #f9f9f9;
        border-top: 1px solid #ddd;
      }
      .url-preview-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
      }
      .url-preview-header h4 {
        margin: 0;
        color: #333;
      }
      .url-stats-summary {
        display: flex;
        gap: 20px;
      }
      .stat-block {
        text-align: center;
        padding: 5px 10px;
        background: white;
        border-radius: 4px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      }
      .stat-label {
        font-size: 0.8em;
        color: #666;
      }
      .stat-value {
        font-weight: bold;
        font-size: 1.1em;
      }
      .url-preview-content {
        position: relative;
        border: 1px solid #ddd;
        border-radius: 4px;
        overflow: hidden;
        background-color: white;
        padding: 0;
      }
      .preview-loading {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(255,255,255,0.8);
        padding: 10px;
        border-radius: 4px;
        z-index: 5;
      }
      .target-url-container {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .preview-toggle-btn {
        background-color: #4a3f9f;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 3px 8px;
        font-size: 0.7em;
        cursor: pointer;
        margin-left: 10px;
        display: inline-block; /* Ensure visibility in Firefox */
      }
      .preview-toggle-btn:hover {
        background-color: #3a2f8f;
      }
      .high-performance {
        color: #4CAF50;
      }
      .medium-performance {
        color: #FF9800;
      }
      .low-performance {
        color: #F44336;
      }
      .meta-preview-container {
        display: flex;
        padding: 15px;
        border-bottom: 1px solid #eee;
      }
      .meta-preview-image-container {
        flex: 0 0 120px;
        margin-right: 15px;
      }
      .meta-preview-image {
        max-width: 100%;
        border-radius: 4px;
        object-fit: cover;
        height: 100px;
        background-color: #f0f0f0;
      }
      .meta-preview-info {
        flex: 1;
      }
      .meta-preview-title {
        margin: 0 0 8px 0;
        font-size: 16px;
        color: #333;
      }
      .meta-preview-description {
        margin: 0 0 8px 0;
        font-size: 14px;
        color: #666;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .meta-preview-domain {
        margin: 0;
        font-size: 12px;
        color: #999;
      }
      .click-list-preview {
        padding: 15px;
      }
      .click-list-preview h4 {
        margin-top: 0;
        margin-bottom: 10px;
        font-size: 14px;
        color: #555;
      }
      .click-list-container {
        max-height: 200px;
        overflow-y: auto;
        margin-bottom: 10px;
        font-size: 13px;
      }
      .click-item {
        padding: 8px;
        border-bottom: 1px solid #eee;
      }
      .click-item:last-child {
        border-bottom: none;
      }
      .click-datetime {
        font-weight: bold;
        display: block;
        margin-bottom: 3px;
      }
      .click-details {
        color: #666;
        font-size: 12px;
      }
      .view-all-clicks-btn {
        background-color: #2196F3;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 5px 10px;
        cursor: pointer;
        font-size: 13px;
      }
      .view-all-clicks-btn:hover {
        background-color: #0b7dda;
      }
      .no-data {
        color: #999;
        font-style: italic;
        text-align: center;
        padding: 15px;
      }
      /* Firefox specific fixes */
      @-moz-document url-prefix() {
        .url-preview-row {
          display: none; /* Ensure proper initial state in Firefox */
        }
        .preview-toggle-btn {
          opacity: 1 !important;
          visibility: visible !important;
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  // Run the check for button visibility
  setTimeout(checkDeleteButtonVisibility, 100);
}

// Calculate performance indicator based on stats
function getPerformanceIndicator(stat) {
  if (!stat || !stat.totalClicks) return '<span class="low-performance">No data</span>';
  
  // Find how long the URL has been active
  const now = new Date();
  const createdAt = stat.createdAt ? new Date(stat.createdAt) : now;
  const daysSinceCreation = Math.max(1, Math.floor((now - createdAt) / (1000 * 60 * 60 * 24)));
  
  // Calculate clicks per day
  const clicksPerDay = stat.totalClicks / daysSinceCreation;
  
  // Calculate recency of clicks
  let recencyScore = 0;
  if (stat.lastClickAt) {
    const daysSinceLastClick = Math.floor((now - new Date(stat.lastClickAt)) / (1000 * 60 * 60 * 24));
    recencyScore = daysSinceLastClick <= 1 ? 3 : // Today or yesterday
                   daysSinceLastClick <= 7 ? 2 : // Last week
                   daysSinceLastClick <= 30 ? 1 : // Last month
                   0; // Older
  }
  
  // Calculate diversity of traffic sources
  const countryDiversity = stat.countryData ? Object.keys(stat.countryData).length : 0;
  const diversityScore = countryDiversity >= 5 ? 3 : // Very diverse
                         countryDiversity >= 2 ? 2 : // Somewhat diverse
                         countryDiversity >= 1 ? 1 : // Single country
                         0; // No data
  
  // Calculate overall performance score (max 10)
  const performanceScore = Math.min(10, Math.round(
    (clicksPerDay * 2) + // Weight clicks per day more heavily
    recencyScore +
    diversityScore
  ));
  
  // Return performance indicator with appropriate color
  if (performanceScore >= 7) {
    return `<span class="high-performance">High (${performanceScore}/10)</span>`;
  } else if (performanceScore >= 4) {
    return `<span class="medium-performance">Medium (${performanceScore}/10)</span>`;
  } else {
    return `<span class="low-performance">Low (${performanceScore}/10)</span>`;
  }
}

// Show click details for a specific short code
function showClickDetails(shortCode) {
  const stat = statsData.find(s => s.shortCode === shortCode);
  if (!stat) {
    showError('No data found for this URL', false);
    return;
  }
  
  console.log('Showing details for:', shortCode, stat);
  
  const detailedStats = document.getElementById('detailed-stats');
  const detailedStatsTitle = document.getElementById('detailed-stats-title');
  const clickHistoryBody = document.getElementById('click-history-body');
  const dailyClicksChart = document.getElementById('daily-clicks-chart');
  
  // Update title with URL info
  detailedStatsTitle.innerHTML = `
    <div class="url-details-header">
      <h3>Statistics for ${shortCode}</h3>
      <p class="url-info">Target URL: <a href="${stat.targetUrl}" target="_blank">${stat.targetUrl}</a></p>
      <p class="short-url-info">Short URL: <a href="https://${SITE_DOMAIN}/r/${shortCode}" target="_blank">https://${SITE_DOMAIN}/r/${shortCode}</a></p>
      <p class="click-summary">Total Clicks: <strong>${stat.totalClicks || 0}</strong> | Last Click: <strong>${stat.lastClickAt ? new Date(stat.lastClickAt).toLocaleString() : 'Never'}</strong></p>
    </div>
  `;
  
  // Clear previous data
  clickHistoryBody.innerHTML = '';
  dailyClicksChart.innerHTML = '';
  
  // Remove any existing preview section to rebuild it
  const oldPreviewSections = document.querySelectorAll('.url-preview-section');
  oldPreviewSections.forEach(section => section.remove());
  
  // Generate daily clicks chart if we have data
  if (stat.dailyClickData && Object.keys(stat.dailyClickData).length > 0) {
    generateDailyClicksChart(dailyClicksChart, stat.dailyClickData);
  } else {
    dailyClicksChart.innerHTML = '<p class="no-data">No daily click data available</p>';
  }
  
  // Add URL preview section using meta data instead of iframe
  const previewSection = document.createElement('div');
  previewSection.className = 'url-preview-section';
  previewSection.innerHTML = `
    <h4>URL Preview</h4>
    <div class="url-preview meta-preview">
      <div class="preview-loading">Loading preview...</div>
      <div class="meta-preview-container" id="meta-preview-detail-${shortCode}">
        <div class="meta-preview-image-container">
          <img src="https://via.placeholder.com/120x100/4a3f9f/ffffff?text=..." alt="Site preview" class="meta-preview-image">
        </div>
        <div class="meta-preview-info">
          <h3 class="meta-preview-title">Loading title...</h3>
          <p class="meta-preview-description">Loading description...</p>
          <p class="meta-preview-domain"></p>
        </div>
      </div>
    </div>
  `;
  
  // Add preview section before click history
  const clickHistoryContainer = document.querySelector('.click-history-container') || document.getElementById('detailed-stats-content');
  if (clickHistoryContainer) {
    clickHistoryContainer.parentNode.insertBefore(previewSection, clickHistoryContainer);
    
    // Fetch meta data for the URL
    fetchMetaData(stat.targetUrl, `meta-preview-detail-${shortCode}`);
  }
  
  // Update click history title to emphasize complete data
  const clickHistoryTitle = document.querySelector('#detailed-stats-content h4');
  if (clickHistoryTitle) {
    clickHistoryTitle.textContent = 'Complete Click History';
  }
  
  // Show all click history with improved formatting - now showing ALL clicks
  if (!stat.recentClicks || stat.recentClicks.length === 0) {
    clickHistoryBody.innerHTML = '<tr><td colspan="5" class="no-data">No detailed click data available</td></tr>';
  } else {
    // Sort clicks by date, newest first
    const sortedClicks = [...stat.recentClicks].sort((a, b) => {
      const dateA = a.timestamp instanceof Date ? a.timestamp : new Date(a.timestamp);
      const dateB = b.timestamp instanceof Date ? b.timestamp : new Date(b.timestamp);
      return dateB - dateA; // Newest first
    });
    
    // Update table header to include IP
    const historyTable = document.getElementById('click-history-table');
    if (historyTable && historyTable.querySelector('thead')) {
      historyTable.querySelector('thead').innerHTML = `
        <tr>
          <th>Date & Time</th>
          <th>Country</th>
          <th>Referrer</th>
          <th>User Agent</th>
          <th>IP Address</th>
        </tr>
      `;
    }
    
    // Add each click with detailed information
    sortedClicks.forEach(click => {
      const row = document.createElement('tr');
      
      // Format the timestamp
      const clickDate = click.timestamp instanceof Date ? 
        click.timestamp : new Date(click.timestamp);
      
      // Format date and time separately for better readability
      const dateFormatted = clickDate.toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
      
      const timeFormatted = clickDate.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      
      // Create a data cell with both date and time
      const dateCell = document.createElement('td');
      dateCell.innerHTML = `
        <div class="click-date">${dateFormatted}</div>
        <div class="click-time">${timeFormatted}</div>
      `;
      
      // Create country cell with flag if available
      const countryCell = document.createElement('td');
      const country = click.country || 'Unknown';
      countryCell.innerHTML = country;
      
      // Create referrer cell with proper formatting
      const referrerCell = document.createElement('td');
      if (click.referrer) {
        try {
          const referrerUrl = new URL(click.referrer);
          referrerCell.innerHTML = `
            <span class="referrer-domain">${referrerUrl.hostname}</span>
            <span class="referrer-path" title="${click.referrer}">${referrerUrl.pathname.substring(0, 25)}${referrerUrl.pathname.length > 25 ? '...' : ''}</span>
          `;
        } catch (e) {
          referrerCell.textContent = click.referrer;
        }
      } else {
        referrerCell.innerHTML = '<span class="direct-visit">Direct Visit</span>';
      }
      
      // Create user agent cell with proper formatting
      const uaCell = document.createElement('td');
      uaCell.innerHTML = click.userAgent ? formatUserAgent(click.userAgent) : 'Unknown';
      
      // Create IP cell (if available)
      const ipCell = document.createElement('td');
      ipCell.textContent = click.ip || 'Not recorded';
      
      // Add all cells to the row
      row.appendChild(dateCell);
      row.appendChild(countryCell);
      row.appendChild(referrerCell);
      row.appendChild(uaCell);
      row.appendChild(ipCell);
      
      // Add the row to the table
      clickHistoryBody.appendChild(row);
    });
  }
  
  // Show the details section
  detailedStats.style.display = 'block';
  
  // Scroll to the detailed stats
  detailedStats.scrollIntoView({ behavior: 'smooth' });
  
  // Add CSS for the url preview section if not already added
  if (!document.getElementById('url-preview-styles')) {
    const style = document.createElement('style');
    style.id = 'url-preview-styles';
    style.textContent = `
      .url-preview-section {
        margin: 20px 0;
        padding: 15px;
        background-color: #f9f9f9;
        border-radius: 8px;
      }
      .url-preview {
        position: relative;
        margin-top: 10px;
      }
      .meta-preview {
        border: 1px solid #ddd;
        border-radius: 4px;
        background-color: white;
        overflow: hidden;
      }
      .preview-loading {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(255,255,255,0.8);
        padding: 10px;
        border-radius: 4px;
        z-index: 5;
      }
      .click-date {
        font-weight: bold;
      }
      .click-time {
        color: #666;
        font-size: 0.9em;
      }
      .referrer-domain {
        font-weight: bold;
        display: block;
      }
      .referrer-path {
        color: #666;
        font-size: 0.9em;
      }
      .direct-visit {
        color: #666;
        font-style: italic;
      }
      .url-details-header {
        margin-bottom: 20px;
      }
      .url-info, .short-url-info {
        margin: 5px 0;
        word-break: break-all;
      }
      .click-summary {
        margin-top: 10px;
        padding: 5px;
        background: #f2f2f2;
        border-radius: 4px;
      }
      .no-data {
        color: #666;
        font-style: italic;
        text-align: center;
        padding: 20px;
      }
    `;
    document.head.appendChild(style);
  }
}

// Format user agent to show device/browser information
function formatUserAgent(userAgent) {
  if (!userAgent) return 'Unknown';
  
  let formatted = userAgent;
  
  // Extract browser
  if (userAgent.includes('Chrome')) {
    formatted = 'Chrome';
  } else if (userAgent.includes('Firefox')) {
    formatted = 'Firefox';
  } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    formatted = 'Safari';
  } else if (userAgent.includes('Edge')) {
    formatted = 'Edge';
  } else if (userAgent.includes('MSIE') || userAgent.includes('Trident/')) {
    formatted = 'Internet Explorer';
  }
  
  // Extract device type
  if (userAgent.includes('iPhone')) {
    formatted += ' (iPhone)';
  } else if (userAgent.includes('iPad')) {
    formatted += ' (iPad)';
  } else if (userAgent.includes('Android')) {
    formatted += ' (Android)';
  } else if (!userAgent.includes('Mobile')) {
    formatted += ' (Desktop)';
  }
  
  return formatted;
}

// Generate daily clicks chart
function generateDailyClicksChart(container, dailyClickData) {
  const days = Object.keys(dailyClickData).sort();
  
  // Find the maximum clicks for scaling
  const maxClicks = Math.max(...Object.values(dailyClickData));
  
  // Calculate the width per bar
  const chartWidth = container.offsetWidth;
  const barWidth = Math.min(60, Math.max(30, chartWidth / days.length - 10));
  
  // Generate bars
  days.forEach((day, index) => {
    const clicks = dailyClickData[day];
    const heightPercentage = (clicks / maxClicks) * 100;
    const actualHeight = Math.max(20, heightPercentage * 1.8); // Minimum height for visibility
    
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.height = actualHeight + 'px';
    bar.style.width = barWidth + 'px';
    bar.style.left = (index * (barWidth + 10)) + 'px';
    bar.setAttribute('data-value', clicks + ' clicks');
    
    const label = document.createElement('div');
    label.className = 'chart-label';
    label.textContent = day;
    label.style.left = (index * (barWidth + 10)) + (barWidth / 2) + 'px';
    
    container.appendChild(bar);
    container.appendChild(label);
  });
}

// Generate country clicks chart
function generateCountryClicksChart(container, countryData) {
  const countries = Object.keys(countryData).sort();
  
  // Find the maximum clicks for scaling
  const maxClicks = Math.max(...Object.values(countryData));
  
  // Calculate the width per bar
  const chartWidth = container.offsetWidth;
  const barWidth = Math.min(60, Math.max(30, chartWidth / countries.length - 10));
  
  // Generate bars
  countries.forEach((country, index) => {
    const clicks = countryData[country];
    const heightPercentage = (clicks / maxClicks) * 100;
    const actualHeight = Math.max(20, heightPercentage * 1.8); // Minimum height for visibility
    
    const bar = document.createElement('div');
    bar.className = 'bar country-bar';
    bar.style.height = actualHeight + 'px';
    bar.style.width = barWidth + 'px';
    bar.style.left = (index * (barWidth + 10)) + 'px';
    bar.setAttribute('data-value', clicks + ' clicks');
    
    const label = document.createElement('div');
    label.className = 'chart-label';
    label.textContent = country;
    label.style.left = (index * (barWidth + 10)) + (barWidth / 2) + 'px';
    
    container.appendChild(bar);
    container.appendChild(label);
  });
}

// Export URLs as CSV
function exportUrlsAsCSV() {
  if (!statsData || statsData.length === 0) {
    showError('No data to export');
    return;
  }
  
  // Create CSV content
  let csvContent = 'Short Code,Short URL,Target URL,Total Clicks,Last Click,Top Countries\n';
  
  statsData.forEach(stat => {
    const shortUrl = `https://${SITE_DOMAIN}/r/${stat.shortCode}`;
    const lastClickDate = stat.lastClickAt 
      ? new Date(stat.lastClickAt).toLocaleString() 
      : 'N/A';
    
    let topCountries = '';
    if (stat.countryData && Object.keys(stat.countryData).length > 0) {
      topCountries = Object.entries(stat.countryData)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([country, count]) => country + ' (' + count + ')')
        .join('; ');
    }
    
    // Escape fields that might contain commas
    const escapeCsv = (str) => {
      if (!str) return '';
      return `"${String(str).replace(/"/g, '""')}"`;
    };
    
    csvContent += `${escapeCsv(stat.shortCode)},${escapeCsv(shortUrl)},${escapeCsv(stat.targetUrl)},${stat.totalClicks},${escapeCsv(lastClickDate)},${escapeCsv(topCountries)}\n`;
  });
  
  // Create download link
  const encodedUri = encodeURI('data:text/csv;charset=utf-8,' + csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', 'url-statistics.csv');
  document.body.appendChild(link);
  
  // Trigger download
  link.click();
  document.body.removeChild(link);
  
  showError('Statistics exported successfully!', true);
}

// Login/logout functionality
function checkLoginState() {
  fetch('/api/auth/status')
    .then(response => response.json())
    .then(data => {
      if (data.authenticated) {
        document.querySelectorAll('.auth-only').forEach(el => el.style.display = 'block');
        document.querySelectorAll('.guest-only').forEach(el => el.style.display = 'none');
        
        const userDisplayEl = document.getElementById('user-display');
        if (userDisplayEl && data.user) {
          userDisplayEl.textContent = `Logged in as: ${data.user.email || data.user.displayName || 'User'}`;
        }
      } else {
        document.querySelectorAll('.auth-only').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.guest-only').forEach(el => el.style.display = 'block');
      }
    })
    .catch(error => {
      console.error('Error checking auth status:', error);
    });
}

function logout() {
  fetch('/api/auth/logout', { method: 'POST' })
    .then(response => response.json())
    .then(data => {
      showError('Logged out successfully', true);
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);
    })
    .catch(error => {
      showError('Logout failed: ' + error.message);
    });
}

// Check auth state on page load
document.addEventListener('DOMContentLoaded', function() {
  checkLoginState();
});

// Initialize the filters UI
function initializeFilters() {
  console.log("Initializing filters UI...");
  const filtersContainer = document.getElementById('stats-filters');
  
  if (!filtersContainer) {
    console.error('Stats filters container not found');
    return;
  }
  
  // Create filters HTML
  filtersContainer.innerHTML = `
    <div class="filter-section">
      <h3>Filter and Sort Options</h3>
      <div class="filters-row">
        <div class="filter-group">
          <label for="shortcode-filter">Filter by Short Code:</label>
          <input type="text" id="shortcode-filter" placeholder="e.g. a1b2c3">
        </div>
        
        <div class="filter-group">
          <label for="date-filter">Filter by Date:</label>
          <select id="date-filter">
            <option value="">All Dates</option>
          </select>
        </div>
        
        <div class="filter-group">
          <label for="country-filter">Filter by Country:</label>
          <select id="country-filter">
            <option value="">All Countries</option>
          </select>
        </div>
      </div>
      
      <div class="filters-row">
        <div class="filter-group">
          <label for="sort-by">Sort by:</label>
          <select id="sort-by">
            <option value="clicks">Total Clicks</option>
            <option value="date">Last Click Date</option>
            <option value="code">Short Code</option>
            <option value="url">Target URL</option>
          </select>
        </div>
        
        <div class="filter-group">
          <label for="sort-order">Order:</label>
          <select id="sort-order">
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>
        
        <div class="filter-group">
          <button id="apply-filters-btn" class="filter-btn">Apply Filters</button>
          <button id="clear-filters-btn" class="filter-btn clear-btn">Clear Filters</button>
        </div>
      </div>
    </div>
    <div id="stats-count" style="margin-top: 10px; font-size: 0.9em; color: #666;"></div>
  `;
  
  // Add event listeners
  document.getElementById('apply-filters-btn').addEventListener('click', applyFilters);
  document.getElementById('clear-filters-btn').addEventListener('click', clearFilters);
  
  // Initialize filter values from current state
  updateFilterInputs();
}

// Apply current filters
function applyFilters() {
  // Get values from the filter inputs
  currentFilters.shortCode = document.getElementById('shortcode-filter').value.trim() || null;
  currentFilters.date = document.getElementById('date-filter').value || null;
  currentFilters.country = document.getElementById('country-filter').value || null;
  currentFilters.sortBy = document.getElementById('sort-by').value;
  currentFilters.sortOrder = document.getElementById('sort-order').value;
  
  // Refresh statistics with the new filters
  loadClickStatistics();
}

// Clear all filters
function clearFilters() {
  currentFilters = {
    shortCode: null,
    date: null,
    country: null,
    sortBy: 'clicks',
    sortOrder: 'desc'
  };
  
  // Update UI
  updateFilterInputs();
  
  // Refresh statistics
  loadClickStatistics();
}

// Update filter UI based on current filter state
function updateFilterInputs() {
  document.getElementById('shortcode-filter').value = currentFilters.shortCode || '';
  
  const dateFilter = document.getElementById('date-filter');
  const countryFilter = document.getElementById('country-filter');
  
  // Reset these to just have the default option
  dateFilter.innerHTML = '<option value="">All Dates</option>';
  countryFilter.innerHTML = '<option value="">All Countries</option>';
  
  // Add available dates
  availableDates.forEach(date => {
    const option = document.createElement('option');
    option.value = date;
    option.textContent = date;
    option.selected = date === currentFilters.date;
    dateFilter.appendChild(option);
  });
  
  // Add available countries
  availableCountries.forEach(country => {
    const option = document.createElement('option');
    option.value = country;
    option.textContent = country;
    option.selected = country === currentFilters.country;
    countryFilter.appendChild(option);
  });
  
  // Set sort options
  document.getElementById('sort-by').value = currentFilters.sortBy;
  document.getElementById('sort-order').value = currentFilters.sortOrder;
}

// Filter by a specific country
function filterByCountry(country) {
  currentFilters.country = country;
  updateFilterInputs();
  loadClickStatistics();
}

// Delete a URL mapping
async function deleteUrlMapping(shortCode) {
  console.log('Delete button clicked for:', shortCode);
  
  if (!shortCode) {
    console.error('No shortCode provided to deleteUrlMapping function');
    alert('Error: No URL identifier provided for deletion');
    return;
  }
  
  // Ask for confirmation first
  if (!confirm(`Are you sure you want to delete the URL mapping for "${shortCode}"? This action cannot be undone.`)) {
    console.log('User cancelled deletion');
    return;
  }

  // Get the current domain
  const baseUrl = window.location.origin;
  
  // Show loading indication
  const errorElement = document.getElementById('error-message');
  errorElement.textContent = `Deleting URL mapping for "${shortCode}"...`;
  errorElement.style.display = 'block';
  errorElement.className = 'message info';
  
  try {
    console.log(`Attempting to delete shortcode: ${shortCode} via XHR`);
    
    // First attempt: Use XMLHttpRequest (most compatible)
    const deleteResult = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${baseUrl}/api/url-action`, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Cache-Control', 'no-cache');
      
      xhr.onload = function() {
        console.log(`XHR status: ${xhr.status}, response:`, xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve({ success: !data.error, data: data });
          } catch (e) {
            console.error('Error parsing JSON response:', e);
            resolve({ success: false, error: 'Invalid JSON response' });
          }
        } else {
          resolve({ success: false, error: `Server returned status ${xhr.status}` });
        }
      };
      
      xhr.onerror = function() {
        console.error('XHR network error');
        resolve({ success: false, error: 'Network error' });
      };
      
      xhr.send(JSON.stringify({
        action: 'delete',
        shortCode: shortCode
      }));
    });
    
    console.log('Delete result:', deleteResult);
    
    // Handle the result
    if (deleteResult.success) {
      // Success!
      errorElement.textContent = `URL mapping for "${shortCode}" has been deleted successfully!`;
      errorElement.className = 'message success';
      
      // Remove the row from the table
      const rows = document.querySelectorAll('#stats-body tr');
      rows.forEach(row => {
        const firstCell = row.querySelector('td');
        if (firstCell && firstCell.textContent.trim() === shortCode) {
          console.log('Removing row for deleted shortcode:', shortCode);
          row.style.backgroundColor = '#ffdddd';
          
          setTimeout(() => {
            row.style.opacity = '0';
            row.style.transition = 'opacity 0.5s';
            setTimeout(() => row.remove(), 500);
          }, 500);
        }
      });
      
      // Also remove the preview row if it exists
      const previewRow = document.getElementById(`preview-row-${shortCode}`);
      if (previewRow) {
        previewRow.remove();
      }
      
      // Refresh statistics after a delay
      setTimeout(() => {
        loadClickStatistics();
        
        // Hide success message after refresh
        setTimeout(() => {
          errorElement.style.display = 'none';
        }, 3000);
      }, 2000);
    } else {
      // If the first attempt failed, try the fallback direct-delete endpoint
      console.log('First delete attempt failed, trying direct-delete endpoint');
      
      // Try with fetch to the direct-delete endpoint
      try {
        const directResponse = await fetch(`${baseUrl}/direct-delete/${shortCode}`);
        console.log('Direct delete response:', directResponse);
        
        if (directResponse.ok) {
          // Success with the direct endpoint
          errorElement.textContent = `URL mapping for "${shortCode}" has been deleted successfully!`;
          errorElement.className = 'message success';
          
          // Remove the row from the statistics table
          const rows = document.querySelectorAll('#stats-body tr');
          rows.forEach(row => {
            const firstCell = row.querySelector('td');
            if (firstCell && firstCell.textContent.trim() === shortCode) {
              row.style.backgroundColor = '#ffdddd';
              setTimeout(() => {
                row.style.opacity = '0';
                row.style.transition = 'opacity 0.5s';
                setTimeout(() => row.remove(), 500);
              }, 500);
            }
          });
          
          // Also remove the preview row if it exists
          const previewRow = document.getElementById(`preview-row-${shortCode}`);
          if (previewRow) {
            previewRow.remove();
          }
          
          // Refresh statistics after successful deletion
          setTimeout(() => {
            loadClickStatistics();
            setTimeout(() => {
              errorElement.style.display = 'none';
            }, 3000);
          }, 2000);
          
          return;
        }
      } catch (directError) {
        console.error('Error with direct delete endpoint:', directError);
      }
      
      // If we get here, both attempts failed
      let errorMsg = "Failed to delete URL. ";
      
      if (deleteResult.error) {
        errorMsg += deleteResult.error;
      } else if (deleteResult.data && deleteResult.data.error) {
        errorMsg += deleteResult.data.error;
      } else {
        errorMsg += "Unknown error occurred.";
      }
      
      console.error(errorMsg);
      errorElement.textContent = errorMsg;
      errorElement.className = 'message error';
      
      // Last resort: Redirect to dedicated delete page
      if (confirm(`Server delete failed. Would you like to try the direct delete page instead?`)) {
        window.location.href = `/direct-delete.html?code=${shortCode}&return=/dashboard.html`;
      } else {
        setTimeout(() => {
          errorElement.style.display = 'none';
        }, 5000);
      }
    }
  } catch (error) {
    console.error('Delete operation error:', error);
    errorElement.textContent = `Error: ${error.message}`;
    errorElement.className = 'message error';
    
    setTimeout(() => {
      errorElement.style.display = 'none';
    }, 5000);
  }
}

// Show success message
function showSuccess(message) {
  const errorContainer = document.getElementById('error-message');
  errorContainer.textContent = message;
  errorContainer.style.display = 'block';
  errorContainer.className = 'message success';
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    errorContainer.style.display = 'none';
  }, 5000);
}

// Check if delete buttons are visible and fix if needed - updated for Firefox
function checkDeleteButtonVisibility() {
  console.log('Checking delete button visibility');
  const deleteButtons = document.querySelectorAll('[onclick*="deleteUrlMapping"], .delete-btn');
  
  if (deleteButtons.length === 0) {
    console.warn('No delete buttons found in the document!');
    
    // Try to find rows in the stats table and add delete buttons if missing
    const statsRows = document.querySelectorAll('#stats-body tr');
    if (statsRows.length > 0) {
      console.log(`Found ${statsRows.length} rows in stats table, checking for missing delete buttons`);
      
      statsRows.forEach(row => {
        const actionCell = row.querySelector('td:last-child');
        if (actionCell) {
          const hasDeleteBtn = actionCell.innerHTML.includes('deleteUrlMapping') || 
                               actionCell.querySelector('.delete-btn');
          
          if (!hasDeleteBtn) {
            const shortCodeCell = row.querySelector('td:first-child');
            if (shortCodeCell && shortCodeCell.textContent.trim()) {
              const shortCode = shortCodeCell.textContent.trim();
              console.log(`Adding missing delete button for ${shortCode}`);
              
              // Create delete button with both inline style and class
              const deleteBtn = document.createElement('button');
              deleteBtn.textContent = 'Delete';
              deleteBtn.className = 'delete-btn';
              deleteBtn.setAttribute('data-shortcode', shortCode);
              deleteBtn.style.backgroundColor = '#f44336';
              deleteBtn.style.color = 'white';
              deleteBtn.style.border = 'none';
              deleteBtn.style.borderRadius = '4px';
              deleteBtn.style.padding = '5px 10px';
              deleteBtn.style.marginLeft = '5px';
              deleteBtn.style.cursor = 'pointer';
              deleteBtn.style.display = 'inline-block';
              deleteBtn.style.visibility = 'visible';
              deleteBtn.style.opacity = '1';
              
              // Add event listener instead of onclick attribute
              deleteBtn.addEventListener('click', () => {
                deleteUrlMapping(shortCode);
              });
              
              // Add to action cell
              actionCell.appendChild(deleteBtn);
            }
          }
        }
      });
    }
  } else {
    console.log(`Found ${deleteButtons.length} delete buttons in document`);
    
    // Ensure all delete buttons are visible with inline styles for Firefox compatibility
    deleteButtons.forEach(btn => {
      btn.style.backgroundColor = '#f44336';
      btn.style.color = 'white';
      btn.style.border = 'none';
      btn.style.borderRadius = '4px';
      btn.style.padding = '5px 10px';
      btn.style.marginLeft = '5px';
      btn.style.cursor = 'pointer';
      btn.style.display = 'inline-block';
      btn.style.visibility = 'visible';
      btn.style.opacity = '1';
      btn.style.fontFamily = 'inherit';
      btn.style.fontSize = '0.8em';
    });
  }
}

// Fetch meta data for a URL and update the preview
async function fetchMetaData(url, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  try {
    // Extract domain for display
    let domain = '';
    try {
      const urlObj = new URL(url);
      domain = urlObj.hostname;
      container.querySelector('.meta-preview-domain').textContent = domain;
    } catch (e) {
      console.warn('Error extracting domain:', e);
    }
    
    // Create a proxy request to get the website's HTML
    const response = await fetch(`/api/url-info?url=${encodeURIComponent(url)}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch metadata: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    // Update the preview with actual meta data
    if (data.title) {
      container.querySelector('.meta-preview-title').textContent = data.title;
    } else {
      container.querySelector('.meta-preview-title').textContent = domain || 'Unknown Website';
    }
    
    if (data.description) {
      container.querySelector('.meta-preview-description').textContent = data.description;
    } else {
      container.querySelector('.meta-preview-description').textContent = 'No description available';
    }
    
    if (data.image) {
      container.querySelector('.meta-preview-image').src = data.image;
    } else {
      // Use a generic placeholder based on the domain initial
      const initial = (domain && domain[0]) ? domain[0].toUpperCase() : 'W';
      container.querySelector('.meta-preview-image').src = `https://via.placeholder.com/120x100/4a3f9f/ffffff?text=${initial}`;
    }
    
    // Hide the loading message
    const loadingEl = container.closest('.url-preview-content').querySelector('.preview-loading');
    if (loadingEl) {
      loadingEl.style.display = 'none';
    }
  } catch (error) {
    console.error('Error fetching meta data:', error);
    
    // Update with fallback content
    container.querySelector('.meta-preview-title').textContent = url.substring(0, 50) + (url.length > 50 ? '...' : '');
    container.querySelector('.meta-preview-description').textContent = 'Preview not available';
    container.querySelector('.meta-preview-image').src = 'https://via.placeholder.com/120x100/cccccc/666666?text=No+Preview';
    
    // Hide the loading message
    const loadingEl = container.closest('.url-preview-content').querySelector('.preview-loading');
    if (loadingEl) {
      loadingEl.style.display = 'none';
    }
  }
}

// Render recent clicks in the preview
function renderRecentClicks(clicks, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  // Clear the container
  container.innerHTML = '';
  
  if (!clicks || clicks.length === 0) {
    container.innerHTML = '<p class="no-data">No click data available</p>';
    return;
  }
  
  // Sort clicks by date, newest first
  const sortedClicks = [...clicks].sort((a, b) => {
    const dateA = a.timestamp instanceof Date ? a.timestamp : new Date(a.timestamp);
    const dateB = b.timestamp instanceof Date ? b.timestamp : new Date(b.timestamp);
    return dateB - dateA; // Newest first
  });
  
  // Render each click
  sortedClicks.forEach(click => {
    const clickItem = document.createElement('div');
    clickItem.className = 'click-item';
    
    // Format the timestamp
    const clickDate = click.timestamp instanceof Date ? 
      click.timestamp : new Date(click.timestamp);
    
    // Format date and time for display
    const dateFormatted = clickDate.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
    
    const timeFormatted = clickDate.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    // Create click details
    clickItem.innerHTML = `
      <span class="click-datetime">${dateFormatted} at ${timeFormatted}</span>
      <div class="click-details">
        <span class="click-country">${click.country || 'Unknown location'}</span>
        ${click.referrer ? ` • From: ${formatReferrer(click.referrer)}` : ''}
      </div>
    `;
    
    container.appendChild(clickItem);
  });
}

// Format referrer URL for display
function formatReferrer(referrer) {
  try {
    const url = new URL(referrer);
    return url.hostname;
  } catch (e) {
    return referrer.substring(0, 30) + (referrer.length > 30 ? '...' : '');
  }
}

// Update summary statistics
function updateSummaryStatistics(stats) {
  // Get elements
  const dailyClicksElement = document.getElementById('daily-clicks-count');
  const weeklyClicksElement = document.getElementById('weekly-clicks-count');
  const monthlyClicksElement = document.getElementById('monthly-clicks-count');
  const ytdClicksElement = document.getElementById('ytd-clicks-count');
  
  // Return if any element doesn't exist
  if (!dailyClicksElement || !weeklyClicksElement || !monthlyClicksElement || !ytdClicksElement) {
    console.log('Missing summary statistics elements');
    return;
  }
  
  // Get current date
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay()); // Start of current week (Sunday)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  
  console.log('Period dates:', { 
    today: today.toISOString(), 
    startOfWeek: startOfWeek.toISOString(), 
    startOfMonth: startOfMonth.toISOString(), 
    startOfYear: startOfYear.toISOString() 
  });
  
  // Initialize counters
  let dailyClicks = 0;
  let weeklyClicks = 0;
  let monthlyClicks = 0;
  let ytdClicks = 0;
  
  // Process each stats object
  if (!stats || stats.length === 0) {
    console.log('No statistics data to process for summary');
  } else {
    console.log(`Processing ${stats.length} stats entries for summary`);
    
    stats.forEach(stat => {
      // Process with recentClicks data
      if (stat.recentClicks && Array.isArray(stat.recentClicks) && stat.recentClicks.length > 0) {
        console.log(`Processing ${stat.recentClicks.length} clicks for ${stat.shortCode}`);
        
        stat.recentClicks.forEach(click => {
          if (!click.timestamp) {
            console.log('Click missing timestamp:', click);
            return;
          }
          
          const clickTime = new Date(click.timestamp);
          
          // Count clicks for different time periods
          if (clickTime >= today) {
            dailyClicks++;
          }
          if (clickTime >= startOfWeek) {
            weeklyClicks++;
          }
          if (clickTime >= startOfMonth) {
            monthlyClicks++;
          }
          if (clickTime >= startOfYear) {
            ytdClicks++;
          }
        });
      } else {
        // Alternative approach: Use dailyClickData if available
        if (stat.dailyClickData) {
          console.log(`Using dailyClickData for ${stat.shortCode}`);
          
          Object.entries(stat.dailyClickData).forEach(([dateStr, count]) => {
            const clickDate = new Date(dateStr);
            
            if (isNaN(clickDate.getTime())) {
              // Try to parse YYYY-MM-DD format manually
              const parts = dateStr.split('-');
              if (parts.length === 3) {
                const year = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1;
                const day = parseInt(parts[2], 10);
                const clickDate = new Date(year, month, day);
                
                if (!isNaN(clickDate.getTime())) {
                  if (clickDate.getTime() === today.getTime()) {
                    dailyClicks += count;
                  }
                  if (clickDate >= startOfWeek) {
                    weeklyClicks += count;
                  }
                  if (clickDate >= startOfMonth) {
                    monthlyClicks += count;
                  }
                  if (clickDate >= startOfYear) {
                    ytdClicks += count;
                  }
                }
              }
            } else {
              // Date parsed correctly
              if (clickDate.getTime() === today.getTime()) {
                dailyClicks += count;
              }
              if (clickDate >= startOfWeek) {
                weeklyClicks += count;
              }
              if (clickDate >= startOfMonth) {
                monthlyClicks += count;
              }
              if (clickDate >= startOfYear) {
                ytdClicks += count;
              }
            }
          });
        }
        
        // If we have a lastClickAt date and totalClicks, but no detailed data
        // at least count it in the year-to-date if appropriate
        if (stat.lastClickAt && stat.totalClicks && stat.totalClicks > 0) {
          const lastClickTime = new Date(stat.lastClickAt);
          if (lastClickTime >= startOfYear) {
            // If we don't have detailed data, assume all clicks were recent
            // This is an approximation, but better than showing 0
            if (!stat.recentClicks && !stat.dailyClickData) {
              console.log(`Using totalClicks (${stat.totalClicks}) for ${stat.shortCode}`);
              ytdClicks += stat.totalClicks;
              
              // If last click was this month, count towards monthly
              if (lastClickTime >= startOfMonth) {
                monthlyClicks += stat.totalClicks;
                
                // If last click was this week, count towards weekly
                if (lastClickTime >= startOfWeek) {
                  weeklyClicks += stat.totalClicks;
                  
                  // If last click was today, count towards daily
                  if (lastClickTime >= today) {
                    dailyClicks += stat.totalClicks;
                  }
                }
              }
            }
          }
        }
      }
    });
  }
  
  console.log('Summary counts:', { dailyClicks, weeklyClicks, monthlyClicks, ytdClicks });
  
  // Update the UI
  dailyClicksElement.textContent = dailyClicks || 0;
  weeklyClicksElement.textContent = weeklyClicks || 0;
  monthlyClicksElement.textContent = monthlyClicks || 0;
  ytdClicksElement.textContent = ytdClicks || 0;
} 