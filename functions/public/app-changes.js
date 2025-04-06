// Functions to add to app.js

// Delete a URL mapping
async function deleteUrlMapping(shortCode) {
  if (!confirm(`Are you sure you want to delete the URL mapping for "${shortCode}"? This action cannot be undone.`)) {
    return;
  }
  
  try {
    const response = await fetch(`/api/delete-url/${shortCode}`, {
      method: 'DELETE'
    });
    
    const data = await response.json();
    
    if (data.error) {
      showError(data.error);
      return;
    }
    
    showError(`URL mapping for "${shortCode}" has been deleted successfully!`, true);
    
    // Refresh the statistics table
    loadClickStatistics();
  } catch (error) {
    showError('Error deleting URL mapping: ' + error.message);
  }
}

// Modified renderStatsTable with added sort functionality and delete button
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
    const row = document.createElement('tr');
    if (rowCounter % 2 === 0) {
      row.classList.add('highlight-row');
    }
    rowCounter++;
    
    const lastClickDate = stat.lastClickAt 
      ? new Date(stat.lastClickAt).toLocaleString() 
      : 'N/A';
    
    const shortUrl = 'https://dlzz.pro/r/' + stat.shortCode;
    
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
    
    row.innerHTML = '<td>' + stat.shortCode + '</td>' +
      '<td><a href="' + shortUrl + '" target="_blank">' + shortUrl + '</a></td>' +
      '<td><a href="' + stat.targetUrl + '" target="_blank">' + stat.targetUrl + '</a></td>' +
      '<td>' + stat.totalClicks + '</td>' +
      '<td>' + lastClickDate + '</td>' +
      '<td>' + topCountries + '</td>' +
      '<td>' +
        '<button class="copy-btn" onclick="copyText(\'' + shortUrl + '\')">Copy</button>' +
        '<button class="details-btn" style="margin-left: 5px;" onclick="showClickDetails(\'' + stat.shortCode + '\')">Details</button>' +
        '<button class="delete-btn" style="margin-left: 5px;" onclick="deleteUrlMapping(\'' + stat.shortCode + '\')">Delete</button>' +
      '</td>';
    
    statsBody.appendChild(row);
  }
}

// Updated initializeFilters function with more sort options
function initializeFilters() {
  const filtersContainer = document.getElementById('stats-filters');
  
  if (!filtersContainer) {
    console.error('Stats filters container not found');
    return;
  }
  
  // Create filters HTML
  filtersContainer.innerHTML = `
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
    <div id="stats-count" style="margin-top: 10px; font-size: 0.9em; color: #666;"></div>
  `;
  
  // Add event listeners
  document.getElementById('apply-filters-btn').addEventListener('click', applyFilters);
  document.getElementById('clear-filters-btn').addEventListener('click', clearFilters);
  
  // Initialize filter values from current state
  updateFilterInputs();
} 