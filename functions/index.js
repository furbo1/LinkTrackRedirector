/**
 * URL Shortener and Click Tracking API
 * 
 * Firebase cleanup policies:
 * - Container images cleanup: 300 days
 * - Function data retention: 300 days
 * - Click data retention: 300 days
 */

const functions = require('firebase-functions');
const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const admin = require('firebase-admin');
const crypto = require('crypto');
const diagnosePage = require('./diagnosePage');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args)); // Polyfill fetch
const { v4: uuidv4 } = require('uuid');
const { URL } = require('url');
const axios = require('axios');
const { JSDOM } = require('jsdom');

// Initialize Firebase Admin SDK
admin.initializeApp();

// Initialize Realtime Database for click tracking
const clicksRef = admin.database().ref('clicks');
console.log('Initialized Realtime Database for clicks');

// Create our own simple Express app just for Firebase Functions
const app = express();

// Configure Express middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// Set up CORS with appropriate options
app.use(cors({
  origin: '*',  // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Add CORS headers to all responses as a fallback
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(204).send();
  }
  
  next();
});

// Set default content type for all responses
app.use((req, res, next) => {
  res.contentType('application/json');
  next();
});

// Simple in-memory session store (this would be a database in production)
// IMPORTANT: This is NOT suitable for production use as it resets when the function instance is recycled
// In a real app, use Firestore, Firebase RTDB, or another persistent database for sessions
let sessions = {};
console.log('Initializing session store');

// Initialize Firestore for persistent session storage
const db = admin.firestore();
const sessionsCollection = db.collection('sessions');
console.log('Initialized Firestore for persistent sessions');

// Set data retention period to 300 days (in milliseconds)
const DATA_RETENTION_PERIOD = 300 * 24 * 60 * 60 * 1000; // 300 days in milliseconds
const DATA_RETENTION_DAYS = 300;

// URL shortening utilities
// Create an in-memory store for URL mappings
let urlMappings = {};

// Create a Firestore collection for URL mappings
const urlMappingsCollection = db.collection('urlMappings');

// Initialize click tracking collection in Firestore
const clicksCollection = db.collection('clicks');

// Initialize global in-memory click storage
if (!global.inMemoryClicks) global.inMemoryClicks = [];
console.log('Initialized in-memory click storage');

// Load existing URL mappings from Firestore
async function loadUrlMappingsFromFirestore() {
  try {
    console.log('Loading URL mappings from Firestore...');
    const snapshot = await urlMappingsCollection.get();
    
    if (snapshot.empty) {
      console.log('No URL mappings found in Firestore, initializing with defaults');
      return {};
    }
    
    const mappings = {};
    snapshot.forEach(doc => {
      const data = doc.data();
      mappings[doc.id] = data.url;
    });
    
    console.log(`Loaded ${Object.keys(mappings).length} URL mappings from Firestore`);
    return mappings;
  } catch (error) {
    console.error('Error loading URL mappings from Firestore:', error);
    return {};
  }
}

// Call this function at server startup
loadUrlMappingsFromFirestore();

// Define the site domain
const SITE_DOMAIN = 'dls.sale';

// Function to create a short code for a URL
async function createShortCode(url) {
  // First check if we already have a code for this URL
  for (const [code, storedUrl] of Object.entries(urlMappings)) {
    if (storedUrl === url) {
      return code;
    }
  }
  
  // If not, create a new short code
  // Use the first 6 characters of the MD5 hash for uniqueness
  const hash = crypto.createHash('md5').update(url).digest('hex');
  const shortCode = hash.substring(0, 6);
  
  // Store the mapping
  urlMappings[shortCode] = url;
  
  const now = new Date();
  const expiresAt = new Date(now.getTime() + DATA_RETENTION_PERIOD);
  
  // Store the mapping in both memory and Firestore
  urlMappings[shortCode] = url;
  
  try {
    // Also store in Firestore with expiration date
    await urlMappingsCollection.doc(shortCode).set({
      url: url,
      createdAt: now,
      expiresAt: expiresAt
    });
    console.log(`Stored URL mapping in Firestore: ${shortCode} -> ${url}`);
  } catch (error) {
    console.error('Error storing URL mapping in Firestore:', error);
  }
  
  console.log(`Created new short code ${shortCode} for ${url}`);
  
  // Create the short URL with the new domain
  const shortUrl = `https://${SITE_DOMAIN}/r/${shortCode}`;
  
  return shortCode;
}

// Function to retrieve a URL from a short code
async function getUrlFromShortCode(code) {
  // First check in-memory cache
  if (urlMappings[code]) {
    return urlMappings[code];
  }
  
  // If not found, check Firestore
  try {
    const doc = await urlMappingsCollection.doc(code).get();
    if (doc.exists) {
      const mapping = doc.data();
      // Add to in-memory cache
      urlMappings[code] = mapping.url;
      return mapping.url;
    }
  } catch (error) {
    console.error('Error fetching URL mapping from Firestore:', error);
  }
  
  return null;
}

// Replace the trackClick function with this improved version
async function trackClick(shortCode, decodedUrl, userAgent, referrer, ip, cfCountry) {
  try {
    console.log(`Starting click tracking for shortcode: ${shortCode}, target: ${decodedUrl}`);
    
    // Ensure shortCode is valid before proceeding
    if (!shortCode) {
      console.error('Invalid shortCode provided to trackClick');
      return { success: false, error: 'Invalid shortCode' };
    }
    
    const now = new Date();
    const day = now.toISOString().split('T')[0]; // YYYY-MM-DD format
    const expiresAt = new Date(now.getTime() + DATA_RETENTION_PERIOD);
    
    // Generate a unique ID for this click
    const clickId = Date.now().toString() + Math.random().toString(36).substring(2, 10);
    
    // Use country from Cloudflare if available, otherwise 'Unknown'
    let country = cfCountry || 'Unknown';
    console.log(`Country for click: ${country}, IP: ${ip}`);
    
    // Create the click data
    const clickData = {
      type: 'click',
      shortCode,
      targetUrl: decodedUrl,
      userAgent: userAgent || null,
      referrer: referrer || null,
      ip: ip || null,
      country,
      timestamp: now,
      day,
      processed: true,
      createdAt: now,
      expiresAt: expiresAt
    };
    
    // First try to write to Realtime Database
    let rtdbSuccess = false;
    
    try {
      console.log('Attempting to write click to Realtime Database');
      // Check if RTDB is accessible with a quick test
      try {
        await clicksRef.child('_test_').set({ 
          timestamp: now.toISOString(),
          test: true
        });
        console.log('✅ RTDB connection test passed');
        
        // Now try to write the click
        await clicksRef.child(clickId).set(clickData);
        
        rtdbSuccess = true;
        console.log(`Click successfully stored in RTDB with ID ${clickId}`);
        
        // Also update summary for this shortCode
        try {
          const summaryRef = clicksRef.child(`summary_${shortCode}`);
          // Get current total clicks
          const summarySnapshot = await summaryRef.once('value');
          const summaryData = summarySnapshot.val() || { totalClicks: 0 };
          
          // Update summary
          await summaryRef.update({
            shortCode,
            targetUrl: decodedUrl,
            totalClicks: (summaryData.totalClicks || 0) + 1,
            lastClickAt: now.toISOString(),
            lastUpdated: now.toISOString(),
            expiresAt: expiresAt.toISOString()
          });
          console.log(`Updated summary for ${shortCode}`);
        } catch (summaryError) {
          console.error('Error updating summary:', summaryError.message);
        }
      } catch (testError) {
        console.error('RTDB connection test failed:', testError.message);
        // Continue to in-memory storage
      }
    } catch (rtdbError) {
      console.error('Error writing to RTDB:', rtdbError.message);
      // Continue to in-memory storage
    }
    
    // If RTDB failed, store in memory
    if (!rtdbSuccess) {
      console.log('Storing click in memory as fallback');
      
      if (!global.inMemoryClicks) {
        global.inMemoryClicks = [];
      }
      
      // Store the click in memory
      global.inMemoryClicks.push({
        id: clickId,
        ...clickData
      });
      
      console.log(`Click stored in memory. Total in-memory clicks: ${global.inMemoryClicks.length}`);
    }
    
    // Return success regardless of storage method
    return { 
      success: true, 
      clickId,
      rtdbSuccess,
      inMemory: !rtdbSuccess,
      inMemoryClicksCount: global.inMemoryClicks ? global.inMemoryClicks.length : 0
    };
  } catch (error) {
    console.error('Unhandled error in trackClick:', error);
    
    // Last resort: still try to store in memory even if another error occurred
    try {
      if (!global.inMemoryClicks) global.inMemoryClicks = [];
      
      global.inMemoryClicks.push({
        id: crypto.randomBytes(8).toString('hex'),
        shortCode,
        targetUrl: decodedUrl,
        country: cfCountry || 'Unknown',
        timestamp: now.toISOString(),
        day: day,
        error: error.message,
        emergency: true,
        expiresAt: expiresAt.toISOString()
      });
      
      console.log(`Click stored in memory as emergency fallback. Total: ${global.inMemoryClicks.length}`);
      
      return { 
        success: true, 
        emergency: true,
        inMemory: true,
        inMemoryClicksCount: global.inMemoryClicks.length
      };
    } catch (emergencyError) {
      console.error('Even emergency in-memory tracking failed:', emergencyError);
    }
    
    return { success: false, error: error.message };
  }
}

// Helper functions for session management
async function createSession(email, uid) {
  const sessionToken = Math.random().toString(36).substring(2, 15);
  const sessionData = {
    email,
    uid,
    loggedIn: true,
    createdAt: new Date().toISOString()
  };
  
  // Store in Firestore
  await sessionsCollection.doc(sessionToken).set(sessionData);
  console.log('Created persistent session:', sessionToken);
  
  // Also keep in memory for faster access
  sessions[sessionToken] = sessionData;
  
  return sessionToken;
}

async function getSession(sessionToken) {
  if (!sessionToken) return null;
  
  // First try memory cache
  if (sessions[sessionToken]) {
    return sessions[sessionToken];
  }
  
  // If not in memory, try Firestore
  try {
    const sessionDoc = await sessionsCollection.doc(sessionToken).get();
    if (sessionDoc.exists) {
      const sessionData = sessionDoc.data();
      // Cache in memory
      sessions[sessionToken] = sessionData;
      return sessionData;
    }
  } catch (error) {
    console.error('Error fetching session:', error);
  }
  
  return null;
}

async function deleteSession(sessionToken) {
  if (!sessionToken) return;
  
  // Delete from Firestore
  try {
    await sessionsCollection.doc(sessionToken).delete();
    // Also remove from memory cache
    delete sessions[sessionToken];
  } catch (error) {
    console.error('Error deleting session:', error);
  }
}

// Add an API endpoint for URL shortening
app.post('/api/shorten', async (req, res) => {
  try {
    const url = req.body.url;
    
    // Validate URL
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    try {
      // Make sure it's a valid URL
      new URL(url);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }
    
    // Create a short code
    const shortCode = await createShortCode(url);
    
    // Create the full short URL - use the custom domain
    const shortUrl = `https://${SITE_DOMAIN}/r/${shortCode}`;
    
    // Return the short URL
    res.json({
      originalUrl: url,
      shortCode,
      shortUrl
    });
  } catch (error) {
    console.error('Error shortening URL:', error);
    res.status(500).json({ error: 'Error shortening URL' });
  }
});

// API endpoint to get click statistics
app.get('/api/click-stats', async (req, res) => {
  try {
    console.log('API Request: Getting click statistics');
    
    // Get query parameters for filtering
    const shortCodeFilter = req.query.shortCode;
    const dateFilter = req.query.date;
    const countryFilter = req.query.country;
    const sortBy = req.query.sortBy || 'clicks'; // Default sort by clicks
    const sortOrder = req.query.sortOrder || 'desc'; // Default descending
    
    console.log(`Filters applied: shortCode=${shortCodeFilter || 'none'}, date=${dateFilter || 'none'}, country=${countryFilter || 'none'}, sortBy=${sortBy}, sortOrder=${sortOrder}`);
    
    // Initialize stats array
    let stats = [];
    let firestoreAvailable = false;
    let firestoreError = null;
    let rtdbAvailable = false;
    let rtdbError = null;
    
    // First try Realtime Database for the most up-to-date click information
    try {
      console.log('Checking if RTDB is available...');
      
      // Get all click summaries from RTDB
      const summariesSnapshot = await clicksRef.orderByChild('shortCode').once('value');
      const summariesData = summariesSnapshot.val();
      
      if (summariesData) {
        rtdbAvailable = true;
        console.log('✅ RTDB connection successful, processing data...');
        
        // Process RTDB summaries
        for (const [key, summary] of Object.entries(summariesData)) {
          // Only process summary entries
          if (key.startsWith('summary_')) {
            const shortCode = summary.shortCode;
            
            // Skip if it doesn't match shortCode filter
            if (shortCodeFilter && shortCode !== shortCodeFilter) {
              continue;
            }
            
            // Format the data for the API response
            const statEntry = {
              shortCode,
              targetUrl: summary.targetUrl,
              totalClicks: summary.totalClicks || 0,
              lastClickAt: summary.lastClickAt ? new Date(summary.lastClickAt) : null,
              avgClicksPerDay: 0, // Will calculate this later if we have daily data
              countryData: {},
              dailyClickData: {},
              source: 'rtdb'
            };
            
            // Get detailed click data for this shortCode
            const clicksSnapshot = await clicksRef.orderByChild('shortCode').equalTo(shortCode).once('value');
            const clicksData = clicksSnapshot.val();
            
            if (clicksData) {
              const clicksArray = [];
              const dailyClicksMap = {};
              const countryClicksMap = {};
              
              for (const [clickId, click] of Object.entries(clicksData)) {
                // Skip summary entries
                if (clickId.startsWith('summary_') || clickId === '_test_') continue;
                
                // Apply date filter if present
                if (dateFilter && (!click.day || click.day !== dateFilter)) {
                  continue;
                }
                
                // Apply country filter if present
                if (countryFilter && (!click.country || click.country !== countryFilter)) {
                  continue;
                }
                
                // Count by day
                if (click.day) {
                  dailyClicksMap[click.day] = (dailyClicksMap[click.day] || 0) + 1;
                }
                
                // Count by country
                if (click.country) {
                  countryClicksMap[click.country] = (countryClicksMap[click.country] || 0) + 1;
                }
                
                // Add to clicks array for history
                clicksArray.push({
                  timestamp: click.timestamp ? new Date(click.timestamp) : new Date(),
                  country: click.country || 'Unknown',
                  referrer: click.referrer || 'Direct',
                  day: click.day
                });
              }
              
              // Sort clicks by timestamp (newest first)
              clicksArray.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
              
              // Calculate average clicks per day
              const daysWithClicks = Object.keys(dailyClicksMap).length;
              if (daysWithClicks > 0) {
                const totalDailyClicks = Object.values(dailyClicksMap).reduce((sum, count) => sum + count, 0);
                statEntry.avgClicksPerDay = totalDailyClicks / daysWithClicks;
              }
              
              // Add the detailed data to our stat entry
              statEntry.countryData = countryClicksMap;
              statEntry.dailyClickData = dailyClicksMap;
              statEntry.recentClicks = clicksArray.slice(0, 50); // Limit to last 50 clicks
            }
            
            stats.push(statEntry);
          }
        }
        
        console.log(`Processed ${stats.length} stats from RTDB summaries`);
      } else {
        console.log('No RTDB summaries found.');
      }
    } catch (rtdbErr) {
      console.error('Error accessing RTDB:', rtdbErr);
      rtdbError = rtdbErr.message;
    }
    
    // If no RTDB data, fall back to Firestore
    if (stats.length === 0) {
      try {
        console.log('Checking if Firestore is available...');
        
        // Quick test to see if Firestore is accessible
        try {
          await db.collection('_test_').doc('_connection_test_').set({ timestamp: admin.firestore.FieldValue.serverTimestamp() });
          firestoreAvailable = true;
          console.log('✅ Firestore connection test passed');
        } catch (testError) {
          console.error('Firestore connection test failed:', testError.message);
          firestoreError = testError.message;
          
          if (testError.message.includes('NOT_FOUND') || testError.message.includes('does not exist')) {
            console.error('Firestore database does not exist yet. Cannot retrieve stats from Firestore.');
          } else if (testError.message.includes('PERMISSION_DENIED')) {
            console.error('Permission denied accessing Firestore. Check service account permissions.');
          }
        }
        
        // Only try to get stats from Firestore if available
        if (firestoreAvailable) {
          console.log('Fetching documents from clicks collection');
          
          // Build query with filters
          let query = clicksCollection.where('type', '==', 'summary');
          
          if (shortCodeFilter) {
            query = query.where('shortCode', '==', shortCodeFilter);
          }
          
          const summarySnapshot = await query.get();
          console.log(`Found ${summarySnapshot.size} summary documents`);
          
          if (!summarySnapshot.empty) {
            summarySnapshot.forEach(doc => {
              const data = doc.data();
              console.log(`Processing summary doc ${doc.id}`);
              processStatData(data, stats);
            });
            console.log(`Processed ${stats.length} summary documents into stats`);
          }
          
          // If no summary docs, fetch individual click documents
          if (stats.length === 0) {
            console.log('No summary documents found, fetching individual click documents');
            
            // Build query with filters
            let clickQuery = clicksCollection.where('type', '==', 'click');
            
            if (shortCodeFilter) {
              clickQuery = clickQuery.where('shortCode', '==', shortCodeFilter);
            }
            
            if (dateFilter) {
              clickQuery = clickQuery.where('day', '==', dateFilter);
            }
            
            if (countryFilter) {
              clickQuery = clickQuery.where('country', '==', countryFilter);
            }
            
            const clickSnapshot = await clickQuery.get();
            console.log(`Found ${clickSnapshot.size} individual click documents`);
            
            if (!clickSnapshot.empty) {
              // Process click documents into stats
              processClickDocumentsIntoStats(clickSnapshot, stats);
              console.log(`Processed ${stats.length} stats from individual click documents`);
            }
          }
        }
      } catch (error) {
        console.error('Error accessing Firestore:', error);
        firestoreError = error.message;
      }
    }
    
    // Check for in-memory clicks if no data was found
    if (stats.length === 0 && global.inMemoryClicks && global.inMemoryClicks.length > 0) {
      console.log(`Processing ${global.inMemoryClicks.length} in-memory clicks`);
      
      // Group in-memory clicks by shortCode
      const clicksByShortCode = {};
      
      global.inMemoryClicks.forEach(click => {
        // Apply filters
        if (shortCodeFilter && click.shortCode !== shortCodeFilter) return;
        if (dateFilter && click.day !== dateFilter) return;
        if (countryFilter && click.country !== countryFilter) return;
      
        if (!clicksByShortCode[click.shortCode]) {
          clicksByShortCode[click.shortCode] = [];
        }
        
        clicksByShortCode[click.shortCode].push({
          timestamp: new Date(click.timestamp),
          targetUrl: click.targetUrl,
          country: click.country || 'Unknown',
          day: click.day,
          referrer: click.referrer,
          userAgent: click.userAgent
        });
      });
      
      // Generate stats from in-memory clicks
      for (const [shortCode, clicks] of Object.entries(clicksByShortCode)) {
        const targetUrl = clicks[0].targetUrl;
        
        // Count clicks by day and country
        const dayClicks = {};
        const countryClicks = {};
        
        clicks.forEach(click => {
          dayClicks[click.day] = (dayClicks[click.day] || 0) + 1;
          countryClicks[click.country] = (countryClicks[click.country] || 0) + 1;
        });
        
        // Sort clicks by timestamp (newest first)
        clicks.sort((a, b) => b.timestamp - a.timestamp);
        
        stats.push({
          shortCode,
          targetUrl,
          totalClicks: clicks.length,
          lastClickAt: clicks[0].timestamp,
          avgClicksPerDay: Object.keys(dayClicks).length > 0 
            ? clicks.length / Object.keys(dayClicks).length 
            : clicks.length,
          countryData: countryClicks,
          dailyClickData: dayClicks,
          recentClicks: clicks.slice(0, 50),
          source: 'memory' // Mark these as coming from memory
        });
      }
      
      console.log(`Added ${stats.length} stat entries from in-memory clicks`);
    }
    
    // If still no stats, get at least URL mappings
    if (stats.length === 0) {
      // Fall back to URL mappings
      try {
        let query = urlMappingsCollection;
        
        if (shortCodeFilter) {
          query = query.doc(shortCodeFilter);
          const doc = await query.get();
          
          if (doc.exists) {
            const shortCode = doc.id;
            const mapping = doc.data();
            
            stats.push({
              shortCode,
              targetUrl: mapping.url,
              totalClicks: 0,
              lastClickAt: null,
              avgClicksPerDay: 0,
              countryData: {},
              dailyClickData: {},
              source: 'mappings_only'
            });
          }
        } else {
          const mappingsSnapshot = await query.get();
          console.log(`No click data found. Falling back to URL mappings, found ${mappingsSnapshot.size} mappings`);
          
          mappingsSnapshot.forEach(doc => {
            const shortCode = doc.id;
            const url = doc.data().url;
            
            if (shortCode && url) {
              stats.push({
                shortCode,
                targetUrl: url,
                totalClicks: 0,
                lastClickAt: null,
                avgClicksPerDay: 0,
                countryData: {},
                dailyClickData: {},
                source: 'mappings_only'
              });
            }
          });
        }
      } catch (mappingError) {
        console.error('Error fetching URL mappings:', mappingError);
        
        // Last resort: use in-memory URL mappings
        if (Object.keys(urlMappings).length > 0) {
          console.log(`Falling back to in-memory URL mappings, found ${Object.keys(urlMappings).length} mappings`);
          
          for (const [shortCode, url] of Object.entries(urlMappings)) {
            // Apply short code filter if present
            if (shortCodeFilter && shortCode !== shortCodeFilter) continue;
            
            stats.push({
              shortCode,
              targetUrl: url,
              totalClicks: 0,
              lastClickAt: null,
              avgClicksPerDay: 0,
              countryData: {},
              dailyClickData: {},
              source: 'in_memory_mappings'
            });
          }
        }
      }
    }
    
    // Apply sorting
    if (sortBy === 'clicks' || sortBy === 'totalClicks') {
      stats.sort((a, b) => sortOrder === 'desc' ? b.totalClicks - a.totalClicks : a.totalClicks - b.totalClicks);
    } else if (sortBy === 'date' || sortBy === 'lastClickAt') {
      stats.sort((a, b) => {
        // Handle null values
        if (!a.lastClickAt) return sortOrder === 'desc' ? 1 : -1;
        if (!b.lastClickAt) return sortOrder === 'desc' ? -1 : 1;
        
        return sortOrder === 'desc' 
          ? new Date(b.lastClickAt) - new Date(a.lastClickAt) 
          : new Date(a.lastClickAt) - new Date(b.lastClickAt);
      });
    } else if (sortBy === 'code' || sortBy === 'shortCode') {
      stats.sort((a, b) => sortOrder === 'desc' 
        ? b.shortCode.localeCompare(a.shortCode) 
        : a.shortCode.localeCompare(b.shortCode));
    } else if (sortBy === 'url' || sortBy === 'targetUrl') {
      stats.sort((a, b) => sortOrder === 'desc' 
        ? b.targetUrl.localeCompare(a.targetUrl) 
        : a.targetUrl.localeCompare(b.targetUrl));
    }
    
    console.log(`Found ${stats.length} statistics entries in total after filtering and sorting`);
    
    // Enhance the response with diagnostic info
    const response = { 
      stats,
      meta: {
        totalStats: stats.length,
        firestoreAvailable,
        firestoreError,
        rtdbAvailable,
        rtdbError,
        inMemoryStatsUsed: stats.some(s => s.source === 'memory'),
        memoryClicksAvailable: global.inMemoryClicks && global.inMemoryClicks.length > 0,
        memoryClicksCount: global.inMemoryClicks ? global.inMemoryClicks.length : 0,
        timestamp: new Date().toISOString(),
        filters: {
          shortCode: shortCodeFilter || null,
          date: dateFilter || null,
          country: countryFilter || null,
          sortBy,
          sortOrder
        }
      }
    };
    
    // Set cache control headers to ensure fresh data
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');
    
    res.json(response);
  } catch (error) {
    console.error('Error fetching click stats:', error);
    res.status(500).json({ 
      error: 'Error fetching click statistics',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Helper function to process stat data
function processStatData(data, stats) {
  if (!data.shortCode) return;
  
  // Calculate daily average
  let totalDailyClicks = 0;
  let daysWithClicks = 0;
  let dailyClickData = {};
  
  // Look for daily click data (fields starting with "clicks_")
  Object.keys(data).forEach(key => {
    if (key.startsWith('clicks_')) {
      const day = key.replace('clicks_', '');
      const clicks = data[key];
      
      dailyClickData[day] = clicks;
      totalDailyClicks += clicks;
      daysWithClicks++;
    }
  });
  
  const avgClicksPerDay = daysWithClicks > 0
    ? (totalDailyClicks / daysWithClicks).toFixed(1)
    : 0;
  
  // Extract country data
  const countryData = {};
  Object.keys(data).forEach(key => {
    if (key.startsWith('country_')) {
      const country = key.replace('country_', '');
      countryData[country] = data[key];
    }
  });
  
  stats.push({
    shortCode: data.shortCode,
    targetUrl: data.targetUrl,
    totalClicks: data.totalClicks || 0,
    lastClickAt: data.lastClickAt ? data.lastClickAt.toDate() : null,
    avgClicksPerDay: Number(avgClicksPerDay),
    countryData,
    dailyClickData
  });
}

// Helper function to process click documents into stats
function processClickDocumentsIntoStats(clickSnapshot, stats) {
  // Group clicks by shortCode
  const clicksByShortCode = {};
  
  clickSnapshot.forEach(doc => {
    const clickData = doc.data();
    if (!clickData.shortCode) {
      console.log(`Click document ${doc.id} missing shortCode, skipping`);
      return;
    }
    
    if (!clicksByShortCode[clickData.shortCode]) {
      clicksByShortCode[clickData.shortCode] = [];
    }
    
    clicksByShortCode[clickData.shortCode].push({
      timestamp: clickData.timestamp ? 
        (typeof clickData.timestamp.toDate === 'function' ? clickData.timestamp.toDate() : new Date(clickData.timestamp)) 
        : new Date(),
      targetUrl: clickData.targetUrl,
      userAgent: clickData.userAgent || '',
      referrer: clickData.referrer || '',
      country: clickData.country || 'Unknown',
      day: clickData.day || new Date().toISOString().split('T')[0]
    });
  });
  
  console.log(`Grouped clicks by shortCode, found ${Object.keys(clicksByShortCode).length} unique shortcodes`);
  
  // Generate stats from grouped clicks
  for (const [shortCode, clicks] of Object.entries(clicksByShortCode)) {
    // Get the target URL from clicks
    let targetUrl = clicks.length > 0 && clicks[0].targetUrl 
      ? clicks[0].targetUrl 
      : null;
      
    if (!targetUrl) {
      // Try to get URL from mappings
      targetUrl = urlMappings[shortCode] || 'Unknown URL';
    }
    
    // Count clicks by day and country
    const dayClicks = {};
    const countryClicks = {};
    
    clicks.forEach(click => {
      // Count by day
      const day = click.day;
      dayClicks[day] = (dayClicks[day] || 0) + 1;
      
      // Count by country
      const country = click.country || 'Unknown';
      countryClicks[country] = (countryClicks[country] || 0) + 1;
    });
    
    // Sort clicks by timestamp (newest first)
    clicks.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Create a stat record
    stats.push({
      shortCode,
      targetUrl,
      totalClicks: clicks.length,
      lastClickAt: clicks.length > 0 ? clicks[0].timestamp : null,
      avgClicksPerDay: Object.keys(dayClicks).length > 0 
        ? clicks.length / Object.keys(dayClicks).length 
        : clicks.length,
      countryData: countryClicks,
      dailyClickData: dayClicks,
      recentClicks: clicks.slice(0, 50), // Limit to last 50 clicks
      source: 'firestore_clicks'
    });
  }
}

// Handle redirect links - this is a special case for affiliate link tracking
// Format: /r/SHORT_CODE to track and redirect
app.get('/r/:targetUrl', async (req, res) => {
  console.log(`==== REDIRECT REQUEST STARTED ====`);
  try {
    const encodedUrl = req.params.targetUrl;
    let decodedUrl;
    let shortCode = encodedUrl; // Use the encoded URL as the short code
    
    console.log(`Redirect request for code: ${shortCode}`);
    
    // Check if this is a short code in our mappings
    const storedUrl = await getUrlFromShortCode(encodedUrl);
    if (storedUrl) {
      decodedUrl = storedUrl;
      console.log(`Found URL mapping for code ${encodedUrl}: ${decodedUrl}`);
    } else {
      // If no mapping exists, redirect to home page
      console.log(`No URL mapping found for code ${encodedUrl}`);
      res.redirect('/');
      return;
    }
    
    // Extract and log headers for tracking
    const headers = req.headers;
    console.log('Request headers:', JSON.stringify({
      'user-agent': headers['user-agent'],
      'referer': headers['referer'] || headers['referrer'],
      'x-forwarded-for': headers['x-forwarded-for'],
      'cf-ipcountry': headers['cf-ipcountry'] // Cloudflare provides this if used
    }));
    
    // Capture relevant information for tracking
    const userAgent = req.headers['user-agent'] || '';
    const referrer = req.headers['referer'] || req.headers['referrer'] || '';
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '';
    const cfCountry = req.headers['cf-ipcountry'] || 'Unknown';
    
    // Track the click and ensure it completes before redirecting
    let trackingSucceeded = false;
    let clickId = null;
    
    console.log(`Attempting to track click for shortcode: ${shortCode}`);
    
    try {
      // Check if Firestore is accessible before attempting to track
      try {
        const testDoc = await clicksCollection.doc('test-connectivity').get();
        console.log(`Firestore connectivity test: ${testDoc.exists ? 'Success' : 'Document does not exist but connection works'}`);
      } catch (connectError) {
        console.error(`Firestore connectivity test failed: ${connectError}`);
      }
      
      // Use Promise.race to either get the tracking result or timeout
      const result = await Promise.race([
        trackClick(shortCode, decodedUrl, userAgent, referrer, ip, cfCountry),
        new Promise((resolve) => {
          setTimeout(() => {
            console.log(`Click tracking timed out for ${shortCode}, proceeding with redirect`);
            resolve({ success: false, error: 'Tracking timeout' });
          }, 2000); // Increased timeout to 2 seconds to ensure tracking completes
        })
      ]);
      
      if (result && result.success) {
        trackingSucceeded = true;
        clickId = result.clickId;
        console.log(`Click tracked successfully with ID: ${result.clickId}`);
      } else {
        console.error(`Click tracking had issues: ${result ? result.error : 'unknown error'}`);
        
        // Try direct document creation as a fallback
        try {
          console.log('Attempting direct document creation for click tracking');
          // Generate a unique ID for this click
          const directClickId = crypto.randomBytes(16).toString('hex');
          
          const clickDocRef = clicksCollection.doc(directClickId);
          await clickDocRef.set({
            type: 'click',
            shortCode,
            targetUrl: decodedUrl,
            userAgent: userAgent || null,
            referrer: referrer || null,
            ip: ip || null,
            country: cfCountry || 'Unknown',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            day: new Date().toISOString().split('T')[0],
            directCreated: true // Mark this as being created directly
          });
          
          const clickDoc = await clickDocRef.get();
          console.log(`Direct document creation result: ${clickDoc.exists ? 'Success' : 'Failed'}, data:`, 
            clickDoc.exists ? JSON.stringify(clickDoc.data()) : 'No data');
          
          trackingSucceeded = true;
          clickId = directClickId;
        } catch (directError) {
          console.error(`Direct document creation failed: ${directError}`);
          
          // Directly write to Firestore as a final fallback
          try {
            console.log('Attempting emergency click tracking with minimal data');
            const emergencyClickRef = await clicksCollection.add({
              type: 'click',
              shortCode,
              targetUrl: decodedUrl,
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
              day: new Date().toISOString().split('T')[0],
              country: cfCountry || 'Unknown',
              emergency: true
            });
            
            console.log(`Emergency click tracking succeeded with ID: ${emergencyClickRef.id}`);
            
            // Also update the summary document
            const summaryRef = clicksCollection.doc(`summary_${shortCode}`);
            await summaryRef.set({
              type: 'summary',
              shortCode,
              targetUrl: decodedUrl,
              totalClicks: admin.firestore.FieldValue.increment(1),
              lastClickAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            
            console.log(`Emergency summary update completed for ${shortCode}`);
            trackingSucceeded = true;
          } catch (err) {
            console.error('Emergency click tracking also failed:', err);
          }
        }
      }
    } catch (err) {
      console.error('Error in click tracking process:', err);
      // Continue with the redirect even if tracking fails
    }
    
    // Verify if the document was created
    if (clickId) {
      try {
        const verifyDoc = await clicksCollection.doc(clickId).get();
        console.log(`Verification of click document: ${verifyDoc.exists ? 'Exists' : 'Does not exist'}`);
        if (verifyDoc.exists) {
          console.log('Document data:', JSON.stringify(verifyDoc.data()));
        }
      } catch (verifyError) {
        console.error(`Error verifying click document: ${verifyError}`);
      }
    }
    
    // Log the redirect
    console.log('Redirecting to:', {
      timestamp: new Date().toISOString(),
      shortCode,
      cfCountry,
      decodedUrl,
      trackingSucceeded,
      clickId
    });
    
    console.log(`==== REDIRECT REQUEST COMPLETED ====`);
    
    // Redirect to the target URL
    res.redirect(decodedUrl);
  } catch (error) {
    console.error('Error processing redirect:', error);
    res.status(500).send('Error processing redirect');
  }
});

// Add a default route to show a dashboard for URL shortening
app.use('*', (req, res) => {
  res.status(200).send(`
    <html>
      <head>
        <title>URL Shortener Dashboard</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 20px;
            background-color: #f7f9fc;
            color: #333;
          }
          .container {
            max-width: 1000px; /* Increased width for more data */
            margin: 0 auto;
            background-color: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          h1, h2, h3 {
            color: #4a3f9f;
          }
          .card {
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            padding: 20px;
            margin-bottom: 20px;
          }
          input, textarea {
            width: 100%;
            padding: 10px;
            margin-bottom: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            box-sizing: border-box;
          }
          button {
            background-color: #4a3f9f;
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
          }
          button:hover {
            background-color: #3a2f8f;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          th, td {
            padding: 10px;
            border-bottom: 1px solid #ddd;
            text-align: left;
          }
          th {
            background-color: #f2f2f2;
            font-weight: bold;
          }
          .copy-btn {
            background-color: #4CAF50;
            padding: 5px 10px;
            font-size: 0.8em;
          }
          .result {
            margin-top: 20px;
            padding: 15px;
            background-color: #f5f5f5;
            border-radius: 4px;
            word-break: break-all;
          }
          .tabs {
            display: flex;
            margin-bottom: 20px;
          }
          .tab {
            padding: 10px 20px;
            background-color: #e9f0fd;
            cursor: pointer;
            border-radius: 4px 4px 0 0;
            margin-right: 5px;
          }
          .tab.active {
            background-color: #4a3f9f;
            color: white;
          }
          .tab-content {
            display: none;
          }
          .tab-content.active {
            display: block;
          }
          .error {
            color: #D8000C;
            background-color: #FFBABA;
            padding: 10px;
            border-radius: 4px;
            margin-bottom: 10px;
            display: none;
          }
          .chart-container {
            height: 200px;
            position: relative;
            margin-top: 20px;
            margin-bottom: 20px;
          }
          .bar {
            position: absolute;
            bottom: 0;
            background-color: #4a3f9f;
            border-radius: 4px 4px 0 0;
            transition: height 0.3s;
            min-width: 30px;
            max-width: 60px;
          }
          .bar:hover::after {
            content: attr(data-value);
            position: absolute;
            top: -25px;
            left: 0;
            background: #333;
            color: white;
            padding: 3px 6px;
            border-radius: 3px;
            font-size: 12px;
          }
          .chart-label {
            position: absolute;
            bottom: -25px;
            text-align: center;
            font-size: 12px;
            transform: rotate(-45deg);
            transform-origin: top left;
            width: 40px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .detailed-history {
            margin-top: 20px;
            border-top: 1px solid #ddd;
            padding-top: 20px;
          }
          .daily-clicks {
            margin-top: 15px;
          }
          .highlight-row {
            background-color: #f9f9f9;
          }
          .details-btn {
            background-color: #2196F3;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>URL Shortener Dashboard</h1>
          
          <div class="tabs">
            <div class="tab active" onclick="switchTab('single')">Single URL</div>
            <div class="tab" onclick="switchTab('bulk')">Bulk URLs</div>
            <div class="tab" onclick="switchTab('stats')">Statistics</div>
          </div>
          
          <div id="error-message" class="error"></div>
          
          <!-- Single URL Shortening -->
          <div id="single" class="tab-content active">
            <div class="card">
              <h2>Shorten URL</h2>
              <input type="url" id="url-input" placeholder="Enter URL to shorten (e.g. https://example.com)" />
              <button onclick="shortenUrl()">Shorten URL</button>
              
              <div id="result" class="result" style="display: none;">
                <p>Original URL: <a id="original-url-link" href="#" target="_blank"></a></p>
                <p>Shortened URL: <a id="short-url-link" href="#" target="_blank"></a></p>
                <button class="copy-btn" onclick="copyToClipboard('short-url-link')">Copy Link</button>
              </div>
            </div>
          </div>
          
          <!-- Bulk URL Shortening -->
          <div id="bulk" class="tab-content">
            <div class="card">
              <h2>Bulk URL Conversion</h2>
              <textarea id="bulk-urls" rows="5" placeholder="Enter multiple URLs, one per line"></textarea>
              <button onclick="bulkShortenUrls()">Convert All URLs</button>
              
              <div id="bulk-results" style="display: none;">
                <h3>Conversion Results</h3>
                <table id="results-table">
                  <thead>
                    <tr>
                      <th>Original URL</th>
                      <th>Shortened URL</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody id="results-body"></tbody>
                </table>
                <button class="copy-btn" style="margin-top: 10px;" onclick="copyAllLinks()">Copy All Links</button>
              </div>
            </div>
          </div>
          
          <!-- Click Statistics -->
          <div id="stats" class="tab-content">
            <div class="card">
              <h2>Click Statistics</h2>
              <button id="refreshStatsBtn" onclick="loadClickStatistics()">Refresh Statistics</button>
              
              <div id="stats-container">
                <table id="stats-table">
                  <thead>
                    <tr>
                      <th>Short Code</th>
                      <th>Short URL</th>
                      <th>Target URL</th>
                      <th>Total Clicks</th>
                      <th>Last Click</th>
                      <th>Top Countries</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody id="stats-body">
                    <tr>
                      <td colspan="7">Loading statistics...</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              <div id="detailed-stats" style="margin-top: 30px; display: none;">
                <h3 id="detailed-stats-title">Click History</h3>
                
                <div id="daily-clicks-chart" class="chart-container">
                  <!-- Bars will be added here dynamically -->
                </div>
                
                <div id="detailed-stats-content">
                  <h4>Click History</h4>
                  <table id="click-history-table">
                    <thead>
                      <tr>
                        <th>Date & Time</th>
                        <th>Country</th>
                        <th>Referrer</th>
                      </tr>
                    </thead>
                    <tbody id="click-history-body"></tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <script>
          // Tab switching logic
          function switchTab(tabId) {
            document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            
            document.querySelector('.tab[onclick="switchTab(\\''+tabId+'\\')"]').classList.add('active');
            document.getElementById(tabId).classList.add('active');
            
            if (tabId === 'stats') {
              loadClickStatistics();
            }
          }
          
          // Display error message
          function showError(message) {
            const errorElement = document.getElementById('error-message');
            errorElement.textContent = message;
            errorElement.style.display = 'block';
            
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
            
            const urls = bulkUrls.split('\\n');
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
                  row.innerHTML = '<td><a href="' + data.originalUrl + '" target="_blank">' + data.originalUrl + '</a></td><td><a href="' + data.shortUrl + '" target="_blank">' + data.shortUrl + '</a></td><td><button class="copy-btn" onclick="copyText(\\'' + data.shortUrl + '\\')">Copy</button></td>';
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
          }
          
          // Copy functions
          function copyToClipboard(elementId) {
            const element = document.getElementById(elementId);
            copyText(element.textContent);
          }
          
          function copyText(text) {
            navigator.clipboard.writeText(text).then(() => {
              showError('Copied to clipboard!');
            }).catch(err => {
              showError('Failed to copy: ' + err);
            });
          }
          
          function copyAllLinks() {
            if (!window.validLinks || window.validLinks.length === 0) {
              showError('No valid links to copy');
              return;
            }
            
            const links = window.validLinks.join('\\n');
            navigator.clipboard.writeText(links).then(() => {
              showError('All links copied to clipboard!');
            }).catch(err => {
              showError('Failed to copy: ' + err);
            });
          }
          
          // Click statistics
          async function loadClickStatistics() {
            try {
              document.getElementById('refreshStatsBtn').disabled = true;
              document.getElementById('refreshStatsBtn').textContent = 'Loading...';
              
              const response = await fetch('/api/click-stats');
              const data = await response.json();
              
              const statsBody = document.getElementById('stats-body');
              statsBody.innerHTML = '';
              
              // Hide detailed stats section initially
              document.getElementById('detailed-stats').style.display = 'none';
              
              if (!data.stats || data.stats.length === 0) {
                const row = document.createElement('tr');
                row.innerHTML = '<td colspan="7">No click data available yet. Click some links to generate statistics.</td>';
                statsBody.appendChild(row);
                
                document.getElementById('refreshStatsBtn').disabled = false;
                document.getElementById('refreshStatsBtn').textContent = 'Refresh Statistics';
                return;
              }
              
              // Store stats data for later use when displaying details
              window.statsData = data.stats;
              
              let rowCounter = 0;
              for (const stat of data.stats) {
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
                    '<button class="copy-btn" onclick="copyText(\\'' + shortUrl + '\\')">Copy</button>' +
                    '<button class="details-btn" style="margin-left: 5px;" onclick="showClickDetails(\\'' + stat.shortCode + '\\')">Details</button>' +
                  '</td>';
                
                statsBody.appendChild(row);
              }
              
              document.getElementById('refreshStatsBtn').disabled = false;
              document.getElementById('refreshStatsBtn').textContent = 'Refresh Statistics';
            } catch (error) {
              console.error('Error loading statistics:', error);
              showError('Error loading statistics: ' + error.message);
              
              const statsBody = document.getElementById('stats-body');
              statsBody.innerHTML = '<tr><td colspan="7">Error loading statistics. Please try again.</td></tr>';
              
              document.getElementById('refreshStatsBtn').disabled = false;
              document.getElementById('refreshStatsBtn').textContent = 'Refresh Statistics';
            }
          }
          
          // Show click details for a specific short code
          function showClickDetails(shortCode) {
            const stat = window.statsData.find(s => s.shortCode === shortCode);
            if (!stat) return;
            
            const detailedStats = document.getElementById('detailed-stats');
            const detailedStatsTitle = document.getElementById('detailed-stats-title');
            const clickHistoryBody = document.getElementById('click-history-body');
            const dailyClicksChart = document.getElementById('daily-clicks-chart');
            
            detailedStatsTitle.textContent = 'Statistics for ' + shortCode;
            clickHistoryBody.innerHTML = '';
            dailyClicksChart.innerHTML = '';
            
            // Generate daily clicks chart if we have data
            if (stat.dailyClickData && Object.keys(stat.dailyClickData).length > 0) {
              const days = Object.keys(stat.dailyClickData).sort();
              
              // Find the maximum clicks for scaling
              const maxClicks = Math.max(...Object.values(stat.dailyClickData));
              
              // Calculate the width per bar
              const chartWidth = dailyClicksChart.offsetWidth;
              const barWidth = Math.min(60, Math.max(30, chartWidth / days.length - 10));
              
              // Generate bars
              days.forEach((day, index) => {
                const clicks = stat.dailyClickData[day];
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
                
                dailyClicksChart.appendChild(bar);
                dailyClicksChart.appendChild(label);
              });
            } else {
              dailyClicksChart.innerHTML = '<p>No daily click data available</p>';
            }
            
            // Show click history
            if (!stat.recentClicks || stat.recentClicks.length === 0) {
              clickHistoryBody.innerHTML = '<tr><td colspan="3">No detailed click data available</td></tr>';
            } else {
              stat.recentClicks.forEach(click => {
                const row = document.createElement('tr');
                const timestamp = click.timestamp instanceof Date ? 
                  click.timestamp.toLocaleString() : 
                  new Date(click.timestamp).toLocaleString();
                
                row.innerHTML = 
                  '<td>' + timestamp + '</td>' +
                  '<td>' + (click.country || 'Unknown') + '</td>' +
                  '<td>' + (click.referrer || 'Direct') + '</td>';
                
                clickHistoryBody.appendChild(row);
              });
            }
            
            detailedStats.style.display = 'block';
            
            // Scroll to the detailed stats
            detailedStats.scrollIntoView({ behavior: 'smooth' });
          }
          
          // Load stats on page load if stats tab is active
          document.addEventListener('DOMContentLoaded', function() {
            if (document.querySelector('#stats').classList.contains('active')) {
              loadClickStatistics();
            }
          });
        </script>
      </body>
    </html>
  `);
});

// Add this with other API endpoints, before exporting the Cloud Function
app.get('/api/diagnose', diagnosePage.diagnoseHandler);

// Add a new endpoint to check in-memory clicks (last resort tracking)
app.get('/api/memory-clicks', (req, res) => {
  try {
    // Return the in-memory clicks if any
    if (!global.inMemoryClicks) global.inMemoryClicks = [];
    
    // Add function instance metadata
    const info = {
      functionInstance: crypto.randomBytes(4).toString('hex'),
      startupTime: global.serverStartTime || new Date().toISOString(),
      memoryClicks: global.inMemoryClicks,
      totalCount: global.inMemoryClicks.length,
      message: global.inMemoryClicks.length > 0 
        ? 'In-memory clicks found! This means Firestore tracking failed.' 
        : 'No in-memory clicks found. Either no clicks occurred or Firestore tracking worked.'
    };
    
    res.json(info);
  } catch (error) {
    console.error('Error serving memory clicks:', error);
    res.status(500).json({ error: 'Failed to retrieve memory clicks' });
  }
});

// Add this right after so we can capture server start time
global.serverStartTime = new Date().toISOString();

// Export the Cloud Function with dynamic import handling

// Add a diagnostic endpoint 
app.get('/api/diagnose-rtdb', async (req, res) => {
  try {
    console.log('Starting RTDB diagnostic check');
    const diagnosticId = 'diag-' + Date.now().toString();
    const timestamp = new Date().toISOString();
    const db = admin.database();
    
    // Test database connection
    const testResult = {
      timestamp,
      diagnosticId
    };
    
    try {
      // Test if we can write to the database
      const diagRef = db.ref('diagnostics');
      await diagRef.child(diagnosticId).set({
        timestamp,
        test: 'RTDB connection test'
      });
      testResult.dbWriteSuccess = true;
      
      // Test if clicks reference exists
      testResult.clicksRefExists = !!clicksRef;
      
      // Get RTDB connection info
      const projectId = process.env.GCLOUD_PROJECT || admin.app().options.projectId;
      const databaseURL = admin.app().options.databaseURL;
      testResult.projectInfo = { projectId, databaseURL };
      
      // Check for in-memory clicks
      testResult.memoryClicksCount = global.inMemoryClicks ? global.inMemoryClicks.length : 0;
      
      res.json({
        status: 'success',
        message: 'RTDB is working correctly',
        ...testResult
      });
    } catch (error) {
      console.error('RTDB diagnostic error:', error);
      res.json({
        status: 'error',
        message: 'RTDB test failed',
        error: error.message,
        stack: error.stack,
        ...testResult
      });
    }
  } catch (error) {
    console.error('Unhandled error in RTDB diagnostic:', error);
    res.status(500).json({
      error: 'Unhandled error in RTDB diagnostic',
      message: error.message,
      stack: error.stack
    });
  }
});

// Add authentication routes
app.post('/api/auth/check', async (req, res) => {
  try {
    const { email, uid } = req.body;
    
    // Set your authorized Google email here
    const AUTHORIZED_EMAIL = 'alexcocan@gmail.com'; // Update this to your email!
    
    // Check if the user's email is authorized
    const authorized = email === AUTHORIZED_EMAIL;
    
    if (authorized) {
      console.log(`Authorized login from ${email}`);
      res.json({ authorized: true });
    } else {
      console.warn(`Unauthorized login attempt from ${email}`);
      res.json({ authorized: false, message: 'You are not authorized to access this application.' });
    }
  } catch (error) {
    console.error('Error checking authorization:', error);
    res.status(500).json({ authorized: false, error: error.message });
  }
});

app.get('/api/auth/status', async (req, res) => {
  try {
    // Get the ID token from the Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.json({ authenticated: false });
    }
    
    const idToken = authHeader.split('Bearer ')[1];
    
    // Verify the ID token
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      
      // Set your authorized email here (same as above)
      const AUTHORIZED_EMAIL = 'alexcocan@gmail.com'; // Update this to your email!
      
      // Check if the user is authorized
      const authorized = decodedToken.email === AUTHORIZED_EMAIL;
      
      if (authorized) {
        return res.json({ 
          authenticated: true, 
          user: {
            uid: decodedToken.uid,
            email: decodedToken.email,
            displayName: decodedToken.name
          }
        });
      } else {
        return res.json({ authenticated: false });
      }
    } catch (error) {
      console.error('Error verifying ID token:', error);
      return res.json({ authenticated: false });
    }
  } catch (error) {
    console.error('Error checking authentication status:', error);
    res.status(500).json({ authenticated: false, error: error.message });
  }
});

app.post('/api/auth/logout', (req, res) => {
  // Just respond with success - actual logout happens on the client
  res.json({ success: true });
});

// Add middleware to protect API routes
const requireAuth = async (req, res, next) => {
  try {
    // Get the ID token from the Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const idToken = authHeader.split('Bearer ')[1];
    
    // Verify the ID token
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      
      // Set your authorized email here (same as above)
      const AUTHORIZED_EMAIL = 'alexcocan@gmail.com'; // Update this to your email!
      
      // Check if the user is authorized
      const authorized = decodedToken.email === AUTHORIZED_EMAIL;
      
      if (authorized) {
        // Add user info to the request object
        req.user = {
          uid: decodedToken.uid,
          email: decodedToken.email,
          displayName: decodedToken.name
        };
        
        // Continue to the route handler
        return next();
      } else {
        return res.status(403).json({ error: 'Forbidden' });
      }
    } catch (error) {
      console.error('Error verifying ID token:', error);
      return res.status(401).json({ error: 'Invalid token' });
    }
  } catch (error) {
    console.error('Error in auth middleware:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Apply authentication middleware to sensitive routes
// Uncomment these lines to require authentication for these endpoints
// app.post('/api/shorten', requireAuth);
// app.get('/api/click-stats', requireAuth);

// Modify the static file serving to handle SPA routing
// Place this at the end of your routes
app.use(express.static(__dirname + '/public'));
app.get('*', (req, res) => {
  // For SPA routing - if the route doesn't match any API endpoints,
  // serve the index.html file to let the client-side handle routing
  if (!req.path.startsWith('/api/') && !req.path.startsWith('/r/')) {
    res.sendFile(__dirname + '/public/index.html');
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

// Add this to the other API endpoints before the Cloud Function export
app.get('/api/data-retention', (req, res) => {
  try {
    res.json({
      retentionPeriod: {
        days: 300,
        milliseconds: DATA_RETENTION_PERIOD
      },
      currentSettings: {
        urlMappings: {
          collection: 'urlMappings',
          ttlField: 'expiresAt',
          description: 'URL mappings are stored for 300 days from creation'
        },
        clickData: {
          collection: 'clicks',
          rtdbPath: 'clicks',
          ttlField: 'expiresAt',
          description: 'Click data is stored for 300 days from creation'
        }
      },
      serverTime: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in data retention endpoint:', error);
    res.status(500).json({ error: 'Failed to retrieve data retention settings' });
  }
});

// Cleanup expired data (runs once per day)
// Note: This function doesn't actually delete anything yet, just logs what would be deleted
// Functions deployed here have a cleanup policy of 300 days
async function cleanupExpiredData() {
  console.log('Running cleanup for expired data');
  const now = new Date();
  
  try {
    // Check for expired URL mappings
    const urlMappingsCollection = db.collection('urlMappings');
    const expiredMappingsSnapshot = await urlMappingsCollection
      .where('expiresAt', '<', now)
      .get();
    
    if (!expiredMappingsSnapshot.empty) {
      console.log(`Found ${expiredMappingsSnapshot.size} expired URL mappings`);
      
      // For now, just extend their expiration date instead of deleting
      const batch = db.batch();
      expiredMappingsSnapshot.forEach(doc => {
        const newExpiresAt = new Date(now.getTime() + DATA_RETENTION_PERIOD);
        console.log(`Would delete mapping ${doc.id}, but extending expiration to ${newExpiresAt}`);
        batch.update(doc.ref, { expiresAt: newExpiresAt });
      });
      
      await batch.commit();
      console.log('Extended expiration for all expired mappings');
    } else {
      console.log('No expired URL mappings found');
    }
    
    // TODO: Add cleanup for expired clicks in RTDB
    // This would involve querying clicks with expiresAt < now
    
    console.log('Cleanup completed');
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

// Run cleanup once on server start
cleanupExpiredData();

// Add this right after so we can capture server start time
global.serverStartTime = new Date().toISOString();

exports.api = functions.https.onRequest(async (req, res) => {
  try {
    // Log all incoming requests in detail
    console.log('REQUEST:', {
      path: req.path,
      method: req.method,
      cookies: req.cookies ? Object.keys(req.cookies) : 'none',
      host: req.headers.host,
      origin: req.headers.origin,
      referer: req.headers.referer
    });
    
    // Forward all requests to our Express app
    return app(req, res);
  } catch (error) {
    console.error('Unhandled error in function:', error);
    res.status(500).send('Server error: ' + error.message);
  }
});

// Initialize the server when the module is loaded
(async () => {
  console.log('Server initialization complete');
})();

// Add a DELETE endpoint for URL mappings
app.delete('/api/delete-url/:shortCode', async (req, res) => {
  try {
    const shortCode = req.params.shortCode;
    
    // Log all request details for debugging
    console.log('\n--------- DELETE REQUEST ---------');
    console.log(`Delete request for shortCode: ${shortCode}`);
    console.log('- Headers:', JSON.stringify(req.headers, null, 2));
    console.log('- Params:', JSON.stringify(req.params, null, 2));
    console.log('- Query:', JSON.stringify(req.query, null, 2));
    console.log('- Body:', JSON.stringify(req.body, null, 2));
    console.log('- Origin:', req.get('origin'));
    console.log('- Referrer:', req.get('referrer'));
    console.log('- Method:', req.method);
    console.log('- IP:', req.ip);
    console.log('- Path:', req.path);
    console.log('---------------------------------\n');
    
    // Set appropriate CORS headers for DELETE requests
    const allowedOrigins = [
      'https://dls.sale', 
      'http://dls.sale',
      'https://dlzz-pro-b1c80.web.app', 
      'http://dlzz-pro-b1c80.web.app',
      'http://localhost:5000'
    ];
    
    const origin = req.get('origin');
    if (allowedOrigins.includes(origin)) {
      res.set('Access-Control-Allow-Origin', origin);
    } else {
      res.set('Access-Control-Allow-Origin', '*');
    }
    
    res.set('Access-Control-Allow-Methods', 'DELETE, OPTIONS, GET, POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.set('Content-Type', 'application/json');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      console.log('Responding to OPTIONS preflight request');
      return res.status(204).send();
    }
    
    if (!shortCode) {
      console.log('Error: No shortCode provided in request');
      return res.status(400).json({
        error: 'Short code is required'
      });
    }
    
    console.log(`Attempting to delete URL mapping for shortCode: ${shortCode}`);
    
    // First check if the URL mapping exists
    let existingUrl = urlMappings[shortCode];
    console.log(`URL in memory cache: ${existingUrl ? 'found' : 'not found'}`);
    
    if (!existingUrl) {
      try {
        // Check in Firestore
        const doc = await urlMappingsCollection.doc(shortCode).get();
        if (doc.exists) {
          existingUrl = doc.data().url;
          console.log(`URL found in Firestore: ${existingUrl}`);
        } else {
          console.log(`URL not found in Firestore`);
        }
      } catch (err) {
        console.error(`Error checking Firestore for shortCode ${shortCode}:`, err);
      }
    }
    
    if (!existingUrl) {
      console.log(`URL mapping not found for ${shortCode}, sending 404 response`);
      return res.status(404).json({
        error: 'URL mapping not found'
      });
    }
    
    // Wrap all deletion operations in a try/catch to ensure robust handling
    try {
      // Delete from in-memory cache
      if (urlMappings[shortCode]) {
        delete urlMappings[shortCode];
        console.log(`Deleted shortCode ${shortCode} from in-memory cache`);
      }
      
      // Track successful operations
      const operations = [];
      
      // Delete from Firestore
      try {
        await urlMappingsCollection.doc(shortCode).delete();
        console.log(`Deleted shortCode ${shortCode} from Firestore`);
        operations.push('url mapping from Firestore');
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
          operations.push(`${clickQuery.size} click records from Firestore`);
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
          operations.push('summary document');
        }
      } catch (err) {
        console.error(`Error deleting summary document for shortCode ${shortCode}:`, err);
        // Continue even if summary delete fails
      }
      
      // Delete from Realtime Database
      try {
        await clicksRef.child(shortCode).remove();
        console.log(`Deleted click data for shortCode ${shortCode} from RTDB`);
        operations.push('click data from Realtime Database');
      } catch (err) {
        console.error(`Error deleting from RTDB for shortCode ${shortCode}:`, err);
        // Continue even if RTDB delete fails
      }
      
      // Return success response
      const operationSummary = operations.length > 0 
          ? `Deleted: ${operations.join(', ')}` 
          : 'Deletion partially successful';
      
      console.log(`Successfully deleted URL mapping for ${shortCode}, sending success response`);
      console.log('Operations summary:', operationSummary);
      
      // Ensure content type is set correctly
      res.set('Content-Type', 'application/json');
      
      // Send the successful response
      return res.status(200).json({
        success: true,
        message: `URL mapping and associated data for "${shortCode}" has been deleted successfully`,
        operations: operationSummary
      });
      
    } catch (deleteError) {
      console.error('Error during deletion process:', deleteError);
      return res.status(500).json({
        error: 'Error during deletion process',
        message: deleteError.message
      });
    }
    
  } catch (error) {
    console.error('Error in delete URL endpoint:', error);
    return res.status(500).json({
      error: 'Failed to delete URL mapping',
      message: error.message
    });
  }
});

// Add a GET endpoint to fetch URL info for a short code (for testing)
app.get('/api/get-url/:shortCode', async (req, res) => {
  try {
    const shortCode = req.params.shortCode;
    
    if (!shortCode) {
      return res.status(400).json({
        error: 'Short code is required'
      });
    }
    
    console.log(`Looking up URL info for shortCode: ${shortCode}`);
    
    // Check in-memory cache first
    let targetUrl = urlMappings[shortCode];
    let source = 'memory cache';
    
    // If not found in memory, check Firestore
    if (!targetUrl) {
      try {
        const doc = await urlMappingsCollection.doc(shortCode).get();
        if (doc.exists) {
          targetUrl = doc.data().url;
          source = 'Firestore';
        }
      } catch (err) {
        console.error(`Error checking Firestore for shortCode ${shortCode}:`, err);
      }
    }
    
    // If URL not found in either location
    if (!targetUrl) {
      return res.status(404).json({
        error: 'URL mapping not found'
      });
    }
    
    // Return the URL info
    return res.status(200).json({
      shortCode: shortCode,
      url: targetUrl,
      shortUrl: `https://${SITE_DOMAIN}/r/${shortCode}`,
      source: source
    });
    
  } catch (error) {
    console.error('Error in get URL endpoint:', error);
    return res.status(500).json({
      error: 'Failed to get URL information',
      message: error.message
    });
  }
});

// Special route specifically for direct URL deletion that bypasses Firebase hosting routing
app.delete('/delete-url-direct/:shortCode', async (req, res) => {
  try {
    const shortCode = req.params.shortCode;
    
    // Log all request details for debugging
    console.log('\n--------- DIRECT DELETE REQUEST ---------');
    console.log(`Direct delete request for shortCode: ${shortCode}`);
    console.log('- Headers:', JSON.stringify(req.headers, null, 2));
    console.log('- Origin:', req.get('origin'));
    console.log('- Referrer:', req.get('referrer'));
    console.log('- Method:', req.method);
    console.log('- IP:', req.ip);
    console.log('---------------------------------\n');
    
    // Enable CORS for all origins
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Delete-Token');
    res.set('Content-Type', 'application/json');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      console.log('Responding to OPTIONS preflight request');
      return res.status(204).send();
    }
    
    if (!shortCode) {
      console.log('Error: No shortCode provided in request');
      return res.status(400).json({
        error: 'Short code is required'
      });
    }
    
    console.log(`Attempting to delete URL mapping for shortCode: ${shortCode}`);
    
    // First check if the URL mapping exists
    let existingUrl = urlMappings[shortCode];
    console.log(`URL in memory cache: ${existingUrl ? 'found' : 'not found'}`);
    
    if (!existingUrl) {
      try {
        // Check in Firestore
        const doc = await urlMappingsCollection.doc(shortCode).get();
        if (doc.exists) {
          existingUrl = doc.data().url;
          console.log(`URL found in Firestore: ${existingUrl}`);
        } else {
          console.log(`URL not found in Firestore`);
        }
      } catch (err) {
        console.error(`Error checking Firestore for shortCode ${shortCode}:`, err);
      }
    }
    
    if (!existingUrl) {
      console.log(`URL mapping not found for ${shortCode}, sending 404 response`);
      return res.status(404).json({
        error: 'URL mapping not found'
      });
    }
    
    // Wrap all deletion operations in a try/catch to ensure robust handling
    try {
      // Delete from in-memory cache
      if (urlMappings[shortCode]) {
        delete urlMappings[shortCode];
        console.log(`Deleted shortCode ${shortCode} from in-memory cache`);
      }
      
      // Track successful operations
      const operations = [];
      
      // Delete from Firestore
      try {
        await urlMappingsCollection.doc(shortCode).delete();
        console.log(`Deleted shortCode ${shortCode} from Firestore`);
        operations.push('url mapping from Firestore');
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
          operations.push(`${clickQuery.size} click records from Firestore`);
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
          operations.push('summary document');
        }
      } catch (err) {
        console.error(`Error deleting summary document for shortCode ${shortCode}:`, err);
        // Continue even if summary delete fails
      }
      
      // Delete from Realtime Database
      try {
        await clicksRef.child(shortCode).remove();
        console.log(`Deleted click data for shortCode ${shortCode} from RTDB`);
        operations.push('click data from Realtime Database');
      } catch (err) {
        console.error(`Error deleting from RTDB for shortCode ${shortCode}:`, err);
        // Continue even if RTDB delete fails
      }
      
      // Return success response
      const operationSummary = operations.length > 0 
          ? `Deleted: ${operations.join(', ')}` 
          : 'Deletion partially successful';
      
      console.log(`Successfully deleted URL mapping for ${shortCode}, sending success response`);
      console.log('Operations summary:', operationSummary);
      
      // Send the successful response
      return res.status(200).json({
        success: true,
        message: `URL mapping and associated data for "${shortCode}" has been deleted successfully`,
        operations: operationSummary,
        shortCode: shortCode
      });
      
    } catch (deleteError) {
      console.error('Error during deletion process:', deleteError);
      return res.status(500).json({
        error: 'Error during deletion process',
        message: deleteError.message,
        shortCode: shortCode
      });
    }
  } catch (error) {
    console.error('Delete endpoint error:', error);
    return res.status(500).json({
      error: 'Server error',
      message: error.message
    });
  }
});

// Add a POST endpoint for URL actions (including delete) to bypass Firebase hosting routing issues
app.post('/api/url-action', async (req, res) => {
  try {
    console.log('\n--------- URL ACTION REQUEST ---------');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('---------------------------------\n');
    
    // Set CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Delete-Token');
    res.set('Content-Type', 'application/json');
    
    // Handle preflight
    if (req.method === 'OPTIONS') {
      return res.status(204).send();
    }
    
    // Check if we have a valid request body
    if (!req.body) {
      return res.status(400).json({
        error: 'Missing request body'
      });
    }
    
    const { action, shortCode } = req.body;
    
    if (!action) {
      return res.status(400).json({
        error: 'Missing action parameter'
      });
    }
    
    if (!shortCode) {
      return res.status(400).json({
        error: 'Missing shortCode parameter'
      });
    }
    
    console.log(`Processing action '${action}' for shortCode: ${shortCode}`);
    
    // Handle different actions
    switch (action.toLowerCase()) {
      case 'delete':
        return await handleDeleteAction(shortCode, req, res);
      
      case 'info':
        return await handleInfoAction(shortCode, req, res);
        
      default:
        return res.status(400).json({
          error: `Unknown action: ${action}`
        });
    }
  } catch (error) {
    console.error('Error in URL action endpoint:', error);
    return res.status(500).json({
      error: 'Server error',
      message: error.message
    });
  }
});

// Handler for URL delete action
async function handleDeleteAction(shortCode, req, res) {
  console.log('Handling DELETE action for shortCode:', shortCode);
  
  // Validate shortCode
  if (!shortCode) {
    console.error('No short code provided for deletion');
    return res.status(400).json({ error: "No short code provided for deletion" });
  }
  
  console.log('Checking if URL mapping exists in cache');
  // Check if the URL exists in memory cache first
  let exists = urlMappings[shortCode] ? true : false;
  let urlExisted = exists;
  
  if (exists) {
    console.log('URL mapping found in cache, deleting from cache');
    // Delete from memory cache
    delete urlMappings[shortCode];
  }
  
  try {
    console.log('Checking if URL mapping exists in Firestore');
    // Check if exists in Firestore
    const urlDocRef = db.collection('urls').doc(shortCode);
    const urlDoc = await urlDocRef.get();
    
    if (urlDoc.exists) {
      console.log('URL mapping found in Firestore, deleting...');
      urlExisted = true;
      
      // Delete the URL mapping from Firestore
      await urlDocRef.delete();
      console.log('URL mapping deleted from Firestore');
      
      // Delete related click data
      try {
        console.log('Deleting click summary data...');
        const summaryDocRef = db.collection('click-summaries').doc(shortCode);
        await summaryDocRef.delete();
        console.log('Click summary deleted');
      } catch (summaryErr) {
        console.error('Error deleting click summary:', summaryErr);
        // Continue with other deletions even if this fails
      }
      
      try {
        console.log('Deleting detailed click data...');
        // Delete click data collection
        const clicksRef = db.collection('clicks').where('shortCode', '==', shortCode);
        const clickDocs = await clicksRef.get();
        
        // Batch delete all click documents
        const batch = db.batch();
        let batchCount = 0;
        
        clickDocs.forEach(doc => {
          batch.delete(doc.ref);
          batchCount++;
        });
        
        if (batchCount > 0) {
          await batch.commit();
          console.log(`Deleted ${batchCount} click records from Firestore`);
        } else {
          console.log('No click records found to delete');
        }
      } catch (clickErr) {
        console.error('Error deleting click data:', clickErr);
        // Continue even if this fails
      }
      
      try {
        console.log('Deleting real-time click data...');
        // Delete from realtime database
        const rtdbRef = admin.database().ref(`clicks/${shortCode}`);
        await rtdbRef.remove();
        console.log('Real-time click data deleted');
      } catch (rtdbErr) {
        console.error('Error deleting from realtime DB:', rtdbErr);
        // Continue even if this fails
      }
    } else {
      console.log('URL mapping not found in Firestore');
      if (!urlExisted) {
        console.error('URL mapping not found in cache or Firestore');
        return res.status(404).json({ error: `URL mapping with short code '${shortCode}' not found` });
      }
    }
    
    // Set Content-Type header explicitly
    res.set('Content-Type', 'application/json');
    
    // Return success response with simple JSON
    const responseData = { 
      success: true, 
      message: `URL mapping with short code '${shortCode}' has been deleted successfully`
    };
    
    console.log('Delete operation completed successfully, sending response:', responseData);
    return res.status(200).json(responseData);
  } catch (error) {
    console.error('Error in delete operation:', error);
    
    // Set Content-Type header explicitly
    res.set('Content-Type', 'application/json');
    
    return res.status(500).json({ error: `Error deleting URL mapping: ${error.message}` });
  }
}

// Handler for URL info action
async function handleInfoAction(shortCode, req, res) {
  try {
    console.log(`Looking up URL info for shortCode: ${shortCode}`);
    
    // Check in-memory cache first
    let targetUrl = urlMappings[shortCode];
    let source = 'memory cache';
    
    // If not found in memory, check Firestore
    if (!targetUrl) {
      try {
        const doc = await urlMappingsCollection.doc(shortCode).get();
        if (doc.exists) {
          targetUrl = doc.data().url;
          source = 'Firestore';
        }
      } catch (err) {
        console.error(`Error checking Firestore for shortCode ${shortCode}:`, err);
      }
    }
    
    // If URL not found in either location
    if (!targetUrl) {
      return res.status(404).json({
        error: 'URL mapping not found',
        shortCode: shortCode,
        action: 'info'
      });
    }
    
    // Return the URL info
    return res.status(200).json({
      shortCode: shortCode,
      url: targetUrl,
      shortUrl: `https://${SITE_DOMAIN}/r/${shortCode}`,
      source: source,
      action: 'info'
    });
    
  } catch (error) {
    console.error('Error in info action:', error);
    return res.status(500).json({
      error: 'Failed to get URL information',
      message: error.message,
      action: 'info'
    });
  }
}

// Add a direct delete endpoint for debugging and testing
// This bypasses regular middleware and allows direct access
app.get('/direct-delete/:shortCode', async (req, res) => {
  const shortCode = req.params.shortCode;
  console.log('==== DIRECT DELETE TEST ENDPOINT CALLED ====');
  console.log('Received delete request for shortCode:', shortCode);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  
  // Set CORS headers to handle browser requests
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Delete-Token');
  res.set('Content-Type', 'application/json');

  try {
    // Basic validation
    if (!shortCode) {
      console.log('No shortCode provided');
      return res.status(400).json({ error: 'No shortCode provided' });
    }
    
    // Check if exists in memory
    console.log('Checking if URL mapping exists in memory cache');
    let exists = urlMappings[shortCode] ? true : false;
    let urlExisted = exists;
    
    if (exists) {
      console.log('URL mapping found in memory, deleting');
      delete urlMappings[shortCode];
    }
    
    try {
      // Check if exists in Firestore
      console.log('Checking if URL mapping exists in Firestore');
      const urlDocRef = db.collection('urls').doc(shortCode);
      const urlDoc = await urlDocRef.get();
      
      if (urlDoc.exists) {
        console.log('URL mapping found in Firestore, deleting');
        urlExisted = true;
        
        // Delete the URL mapping from Firestore
        await urlDocRef.delete();
        console.log('URL mapping deleted from Firestore');
        
        // Delete click data and summaries
        try {
          console.log('Attempting to delete related click data');
          const summaryDocRef = db.collection('click-summaries').doc(shortCode);
          await summaryDocRef.delete();
          console.log('Click summary deleted');
        } catch (err) {
          console.error('Error deleting click summary:', err);
        }
        
        // Delete from realtime database
        try {
          console.log('Attempting to delete from realtime database');
          const rtdbRef = admin.database().ref(`clicks/${shortCode}`);
          await rtdbRef.remove();
          console.log('Deleted from realtime database');
        } catch (err) {
          console.error('Error deleting from realtime DB:', err);
        }
      } else {
        console.log('URL mapping not found in Firestore');
        if (!urlExisted) {
          console.log('URL mapping not found in memory or Firestore');
          return res.status(404).json({ error: `URL mapping with short code '${shortCode}' not found` });
        }
      }
      
      console.log('Delete operation successful');
      
      // Create a simple response object
      const responseData = { 
        success: true, 
        message: `URL mapping with short code '${shortCode}' has been deleted successfully`
      };
      
      console.log('Sending success response:', responseData);
      return res.status(200).json(responseData);
    } catch (error) {
      console.error('Error in Firestore operations:', error);
      return res.status(500).json({ error: `Error in Firestore operations: ${error.message}` });
    }
  } catch (error) {
    console.error('Unhandled error in direct delete endpoint:', error);
    return res.status(500).json({ error: `Unhandled error: ${error.message}` });
  }
});

// Add a new endpoint for fetching URL meta information
app.get('/api/url-info', async (req, res) => {
  const url = req.query.url;
  
  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }
  
  console.log(`[URL Info] Fetching meta info for: ${url}`);
  
  try {
    // Add CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    // Fetch the URL content
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LinkPreviewBot/1.0; +http://example.com)'
      },
      timeout: 5000
    });
    
    if (!response.ok) {
      console.warn(`[URL Info] Failed to fetch URL: ${url}, status: ${response.status}`);
      return res.status(200).json({ 
        error: `Failed to fetch URL (status ${response.status})`,
        title: null,
        description: null,
        image: null
      });
    }
    
    const contentType = response.headers.get('content-type') || '';
    
    // Only process HTML content
    if (!contentType.includes('text/html')) {
      console.log(`[URL Info] Not HTML content: ${contentType}`);
      return res.json({ 
        title: url.split('/').pop() || url,
        description: `Content type: ${contentType}`,
        image: null
      });
    }
    
    // Get HTML content
    const html = await response.text();
    
    // Extract metadata from HTML using regex
    // This is a simple approach, for production consider using a proper HTML parser
    const result = {
      title: extractMetaContent(html, 'title') || 
             extractMetaContent(html, 'og:title') || 
             extractMetaContent(html, 'twitter:title'),
      description: extractMetaContent(html, 'description') || 
                   extractMetaContent(html, 'og:description') || 
                   extractMetaContent(html, 'twitter:description'),
      image: extractMetaContent(html, 'og:image') || 
             extractMetaContent(html, 'twitter:image')
    };
    
    // If we didn't find an image through meta tags, try to find the first image
    if (!result.image) {
      const imgMatch = html.match(/<img[^>]+src="([^">]+)"/i);
      if (imgMatch && imgMatch[1]) {
        // Convert relative URL to absolute
        if (imgMatch[1].startsWith('/')) {
          try {
            const urlObj = new URL(url);
            result.image = `${urlObj.protocol}//${urlObj.host}${imgMatch[1]}`;
          } catch (e) {
            result.image = imgMatch[1];
          }
        } else if (!imgMatch[1].startsWith('http')) {
          // Handle relative URLs without leading slash
          try {
            const urlObj = new URL(url);
            const baseUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
            // Remove filename from path if any
            const basePath = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
            result.image = `${basePath}${imgMatch[1]}`;
          } catch (e) {
            result.image = imgMatch[1];
          }
        } else {
          result.image = imgMatch[1];
        }
      }
    }
    
    console.log(`[URL Info] Extracted meta info for ${url}:`, result);
    res.json(result);
  } catch (error) {
    console.error(`[URL Info] Error fetching URL info for ${url}:`, error);
    res.status(200).json({ 
      error: `Error fetching URL info: ${error.message}`,
      title: null,
      description: null,
      image: null
    });
  }
});

// Helper function to extract meta content from HTML
function extractMetaContent(html, name) {
  // Try meta name
  let match = html.match(new RegExp(`<meta\\s+name=["']${name}["']\\s+content=["']([^"']+)["']`, 'i'));
  if (match) return match[1];
  
  // Try meta property (for Open Graph)
  match = html.match(new RegExp(`<meta\\s+property=["']${name}["']\\s+content=["']([^"']+)["']`, 'i'));
  if (match) return match[1];
  
  // Try meta with content first (for some malformed HTML)
  match = html.match(new RegExp(`<meta\\s+content=["']([^"']+)["']\\s+name=["']${name}["']`, 'i'));
  if (match) return match[1];
  
  match = html.match(new RegExp(`<meta\\s+content=["']([^"']+)["']\\s+property=["']${name}["']`, 'i'));
  if (match) return match[1];
  
  // For title tag
  if (name === 'title') {
    match = html.match(/<title>([^<]+)<\/title>/i);
    if (match) return match[1];
  }
  
  return null;
}