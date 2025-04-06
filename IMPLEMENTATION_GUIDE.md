# Implementation Guide: Adding Sorting & Delete URL Functionality

This guide explains how to implement the requested features:
1. Add enhanced sorting functionality to the statistics page
2. Add ability to delete URLs from the statistics page

## Files to Modify

1. `functions/index.js` - Add deletion API endpoint
2. `functions/public/app.js` - Add delete functionality and improve sorting
3. `functions/public/index.html` - Update CSS references

## Step 1: Add the URL Deletion API Endpoint

Add the following code to `functions/index.js` (before the exports.api line):

```javascript
// Add a DELETE endpoint for URL mappings
app.delete('/api/delete-url/:shortCode', async (req, res) => {
  try {
    const shortCode = req.params.shortCode;
    
    if (!shortCode) {
      return res.status(400).json({
        error: 'Short code is required'
      });
    }
    
    console.log(`Attempting to delete URL mapping for shortCode: ${shortCode}`);
    
    // First check if the URL mapping exists
    let existingUrl = urlMappings[shortCode];
    
    if (!existingUrl) {
      try {
        // Check in Firestore
        const doc = await urlMappingsCollection.doc(shortCode).get();
        if (doc.exists) {
          existingUrl = doc.data().url;
        }
      } catch (err) {
        console.error(`Error checking Firestore for shortCode ${shortCode}:`, err);
      }
    }
    
    if (!existingUrl) {
      return res.status(404).json({
        error: 'URL mapping not found'
      });
    }
    
    // Delete from in-memory cache
    if (urlMappings[shortCode]) {
      delete urlMappings[shortCode];
      console.log(`Deleted shortCode ${shortCode} from in-memory cache`);
    }
    
    // Delete from Firestore
    try {
      await urlMappingsCollection.doc(shortCode).delete();
      console.log(`Deleted shortCode ${shortCode} from Firestore`);
    } catch (err) {
      console.error(`Error deleting from Firestore for shortCode ${shortCode}:`, err);
      // Continue even if Firestore delete fails
    }
    
    // Delete related click data from Firestore
    try {
      // Find all click documents for this shortCode
      const clickQuery = await clicksCollection.where('shortCode', '==', shortCode).get();
      
      if (!clickQuery.empty) {
        const batch = db.batch();
        clickQuery.forEach(doc => {
          batch.delete(doc.ref);
        });
        
        await batch.commit();
        console.log(`Deleted ${clickQuery.size} click records for shortCode ${shortCode} from Firestore`);
      }
    } catch (err) {
      console.error(`Error deleting click data from Firestore for shortCode ${shortCode}:`, err);
      // Continue even if click data delete fails
    }
    
    // Delete summary document if it exists
    try {
      const summaryDoc = await clicksCollection.doc(`summary_${shortCode}`).get();
      if (summaryDoc.exists) {
        await clicksCollection.doc(`summary_${shortCode}`).delete();
        console.log(`Deleted summary document for shortCode ${shortCode}`);
      }
    } catch (err) {
      console.error(`Error deleting summary document for shortCode ${shortCode}:`, err);
      // Continue even if summary delete fails
    }
    
    // Delete from Realtime Database
    try {
      await clicksRef.child(shortCode).remove();
      console.log(`Deleted click data for shortCode ${shortCode} from RTDB`);
    } catch (err) {
      console.error(`Error deleting from RTDB for shortCode ${shortCode}:`, err);
      // Continue even if RTDB delete fails
    }
    
    // Return success response
    res.json({
      success: true,
      message: `URL mapping and associated data for "${shortCode}" has been deleted successfully`
    });
    
  } catch (error) {
    console.error('Error in delete URL endpoint:', error);
    res.status(500).json({
      error: 'Failed to delete URL mapping',
      message: error.message
    });
  }
});
```

## Step 2: Create style.css file

Create a new file `functions/public/style.css` with the following content:

```css
/* Additional styles for delete button and sorting */

.delete-btn {
  background-color: #f44336;
  padding: 5px 10px;
  font-size: 0.8em;
}

.delete-btn:hover {
  background-color: #d32f2f;
}

/* Sort indicator styles */
.sort-indicator {
  margin-left: 5px;
  display: inline-block;
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
}

.sort-asc {
  border-bottom: 5px solid #333;
}

.sort-desc {
  border-top: 5px solid #333;
}

/* Improved filter section */
.filter-section {
  background-color: #f5f5f5;
  padding: 15px;
  border-radius: 4px;
  margin-bottom: 20px;
}

.filter-section h3 {
  margin-top: 0;
  color: #333;
}

/* Stats count */
#stats-count {
  font-style: italic;
  margin-bottom: 10px;
}

/* Click to sort indicator on table headers */
th.sortable {
  cursor: pointer;
}

th.sortable:hover {
  background-color: #e0e0e0;
}

/* Improve spacing in table */
#stats-table td, #stats-table th {
  padding: 12px 10px;
}

/* Make buttons in table more compact */
#stats-table .action-buttons {
  display: flex;
  gap: 5px;
}

/* Success and error messages with animation */
.message {
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 10px;
  animation: fadeIn 0.3s ease;
}

.message.success {
  background-color: #e8f5e9;
  color: #2e7d32;
  border-left: 4px solid #2e7d32;
}

.message.error {
  background-color: #ffebee;
  color: #c62828;
  border-left: 4px solid #c62828;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}
```

## Step 3: Add the following functions to app.js

Add these functions to `functions/public/app.js`:

```javascript
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
```

## Step 4: Replace the renderStatsTable function in app.js

Replace the existing `renderStatsTable` function with this improved version that includes better sorting and the delete button:

```javascript
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
        '<div class="action-buttons">' +
          '<button class="copy-btn" onclick="copyText(\'' + shortUrl + '\')">Copy</button>' +
          '<button class="details-btn" onclick="showClickDetails(\'' + stat.shortCode + '\')">Details</button>' +
          '<button class="delete-btn" onclick="deleteUrlMapping(\'' + stat.shortCode + '\')">Delete</button>' +
        '</div>' +
      '</td>';
    
    statsBody.appendChild(row);
  }
}
```

## Step 5: Update the initializeFilters function in app.js

Replace the existing `initializeFilters` function with this improved version that includes more sort options:

```javascript
function initializeFilters() {
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
```

## Step 6: Update index.html to include the style.css file

Add the following line to the `<head>` section of `functions/public/index.html`:

```html
<link rel="stylesheet" href="/style.css">
```

## Step 7: Deploy the Changes

Deploy the updated functions:

```bash
npx firebase deploy --only functions,hosting
```

## Testing

1. Go to the Statistics page
2. Verify that you can sort by different columns
3. Verify that you can delete URLs by clicking the Delete button
4. Confirm that deleted URLs are removed from the statistics page 