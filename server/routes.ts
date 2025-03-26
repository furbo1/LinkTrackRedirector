import express, { type Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage, MemStorage } from "./storage";
import fetch from "node-fetch";
import * as cheerio from "cheerio";

// Function to fetch Open Graph data from a URL
async function fetchOpenGraphData(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LinkTracker/1.0; +https://linktracker.example.com)"
      },
      timeout: 5000 // 5 second timeout to avoid long waits
    });
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Extract Open Graph data
    const ogTitle = $('meta[property="og:title"]').attr('content') || 
                    $('title').text() || 
                    $('meta[name="title"]').attr('content');
                    
    const ogDescription = $('meta[property="og:description"]').attr('content') || 
                          $('meta[name="description"]').attr('content');
                          
    const ogImage = $('meta[property="og:image"]').attr('content') || 
                    $('meta[property="og:image:url"]').attr('content');
                    
    // Try to extract price information
    const ogPrice = $('meta[property="og:price:amount"]').attr('content') || 
                    $('meta[property="product:price:amount"]').attr('content') || 
                    null;
    
    return {
      title: ogTitle || null,
      description: ogDescription || null,
      image: ogImage || null,
      price: ogPrice
    };
  } catch (error) {
    console.error("Error fetching Open Graph data:", error);
    return {
      title: null,
      description: null,
      image: null,
      price: null
    };
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Prefix for API routes to distinguish them from frontend routes
  const apiRouter = express.Router();
  app.use('/api', apiRouter);
  
  // Define a set of paths that should be handled by the frontend router
  const frontendPaths = ['/', '/dashboard', '/settings', '/links', '/link'];

  // Get all links with analytics
  apiRouter.get("/links", async (_req: Request, res: Response) => {
    try {
      const links = await storage.getLinksWithAnalytics();
      return res.json(links);
    } catch (error) {
      console.error("Error getting links:", error);
      return res.status(500).json({ message: "Failed to get links" });
    }
  });

  // Get a single link by ID
  apiRouter.get("/links/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid link ID" });
      }
      
      const link = await storage.getLinkWithAnalytics(id);
      if (!link) {
        return res.status(404).json({ message: "Link not found" });
      }
      
      return res.json(link);
    } catch (error) {
      console.error("Error getting link:", error);
      return res.status(500).json({ message: "Failed to get link" });
    }
  });

  // Create a new link
  apiRouter.post("/links", async (req: Request, res: Response) => {
    try {
      const { name, destination, platform } = req.body;
      
      if (!name || !destination) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      try {
        // Validate URL
        new URL(destination);
      } catch (error) {
        return res.status(400).json({ message: "Invalid destination URL" });
      }
      
      // Fetch Open Graph data
      let ogData = {
        title: null,
        description: null,
        image: null,
        price: null
      };
      
      try {
        ogData = await fetchOpenGraphData(destination);
      } catch (error) {
        console.error("Error fetching Open Graph data:", error);
        // Continue with null values
      }
      
      const link = await storage.createLink({
        name,
        destination,
        platform: platform || "other",
        ogTitle: ogData.title,
        ogDescription: ogData.description,
        ogImage: ogData.image,
        ogPrice: ogData.price
      });
      
      return res.status(201).json(link);
    } catch (error) {
      console.error("Error creating link:", error);
      return res.status(500).json({ message: "Failed to create link" });
    }
  });

  // Get clicks for a link
  apiRouter.get("/links/:id/clicks", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid link ID" });
      }
      
      const link = await storage.getLinkById(id);
      if (!link) {
        return res.status(404).json({ message: "Link not found" });
      }
      
      // Get click data - last 30 days by default
      const days = req.query.days ? parseInt(req.query.days as string) : 30;
      const dailyClicks = await storage.getDailyClicksData(id, days);
      const totalClicks = await storage.getClicksCount(id);
      
      return res.json({
        totalClicks,
        dailyClicks
      });
    } catch (error) {
      console.error("Error getting clicks:", error);
      return res.status(500).json({ message: "Failed to get clicks" });
    }
  });

  // Get platform statistics
  apiRouter.get("/stats/platforms", async (_req: Request, res: Response) => {
    try {
      const links = await storage.getLinksWithAnalytics();
      const platforms = new Map<string, number>();
      
      for (const link of links) {
        const platform = link.platform;
        const currentCount = platforms.get(platform) || 0;
        platforms.set(platform, currentCount + link.clicks);
      }
      
      const result = Array.from(platforms.entries()).map(([platform, clicks]) => ({
        platform,
        clicks
      }));
      
      return res.json(result);
    } catch (error) {
      console.error("Error getting platform stats:", error);
      return res.status(500).json({ message: "Failed to get platform statistics" });
    }
  });

  // Bulk create links
  apiRouter.post("/links/bulk", async (req: Request, res: Response) => {
    try {
      const bulkData: {urls: string[]} = req.body;
      
      if (!Array.isArray(bulkData.urls) || bulkData.urls.length === 0) {
        return res.status(400).json({ message: "Invalid bulk URLs data. Expected an array of URL strings." });
      }
      
      const results = [];
      
      for (const url of bulkData.urls) {
        try {
          // Validate URL
          new URL(url);
          
          // Detect platform
          let platform = 'other';
          try {
            const urlObj = new URL(url);
            if (urlObj.hostname.includes('amazon') || urlObj.hostname.includes('amzn')) {
              platform = 'amazon';
            } else if (urlObj.hostname.includes('temu')) {
              platform = 'temu';
            }
          } catch (e) {
            // Keep platform as 'other'
          }
          
          // Generate name
          let name = `Product Link ${new Date().toISOString()}`;
          try {
            const urlObj = new URL(url);
            const path = urlObj.pathname;
            
            if (platform === 'amazon') {
              name = `Amazon Product ${path.split('/').filter(Boolean)[0] || new Date().toISOString()}`;
            } else if (platform === 'temu') {
              name = `Temu Product ${path.split('/').filter(Boolean)[0] || new Date().toISOString()}`;
            }
          } catch (e) {
            // Use default name
          }
          
          // Create link with basic info first (faster than waiting for OG data)
          const linkData = {
            name,
            destination: url,
            platform
          };
          
          const link = await storage.createLink(linkData);
          
          // Return success immediately
          results.push({
            destination: url,
            platform,
            name,
            trackingId: link.trackingId,
            success: true,
            ogTitle: link.ogTitle,
            ogDescription: link.ogDescription,
            ogImage: link.ogImage,
            ogPrice: link.ogPrice
          });
          
          // Fetch Open Graph data in the background after response
          // This avoids timeouts but still populates the metadata eventually
          fetchOpenGraphData(url)
            .then(async (ogData) => {
              try {
                // Manually update the link with OG data
                // Since we don't have an updateLink method, we'll use the storage implementation directly
                // In a production app with a database, you'd do a proper update here
                const existingLink = await storage.getLinkById(link.id);
                if (existingLink) {
                  // For MemStorage, we can update directly
                  if (storage instanceof MemStorage) {
                    const linkData = storage.linksData.get(link.id);
                    if (linkData) {
                      linkData.ogTitle = ogData.title;
                      linkData.ogDescription = ogData.description;
                      linkData.ogImage = ogData.image;
                      linkData.ogPrice = ogData.price;
                    }
                  }
                }
              } catch (e) {
                console.error(`Failed to update link ${link.id} with OG data:`, e);
              }
            })
            .catch((err) => {
              console.error(`Failed to fetch OG data for ${url}:`, err);
            });
          
        } catch (error) {
          console.error(`Error processing URL ${url}:`, error);
          
          results.push({
            destination: url,
            platform: 'unknown',
            name: 'Error',
            trackingId: '',
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create link'
          });
        }
      }
      
      return res.status(201).json(results);
    } catch (error) {
      console.error("Error bulk creating links:", error);
      return res.status(500).json({ message: "Failed to process bulk links" });
    }
  });
  
  // Redirect endpoint with preview page - /:trackingId (shorter URLs without /r/ prefix)
  // This must come after all API routes to avoid conflicts
  app.get("/:trackingId", async (req: Request, res: Response, next: NextFunction) => {
    // Skip redirect and pass to next middleware (frontend routes) if the path is a known frontend route
    if (frontendPaths.includes(req.path)) {
      return next();
    }
    
    // Check if the trackingId looks like a valid tracking ID (alphanumeric string)
    // This helps distinguish from other frontend routes
    const { trackingId } = req.params;
    if (!trackingId || trackingId.length > 10 || !/^[a-zA-Z0-9]+$/.test(trackingId)) {
      return next();
    }
    
    try {
      const link = await storage.getLinkByTrackingId(trackingId);
      
      if (!link) {
        return res.status(404).json({ message: "Link not found" });
      }
      
      // Is this a bot/crawler requesting the page? (e.g., social media preview)
      const userAgent = req.headers["user-agent"] || "";
      
      // Enhanced bot detection
      const isBot = /bot|crawl|facebook|twitter|linkedin|pinterest|slack|discord|telegram|preview|fetch|curl|wget|headless|phantom|selenium|webdriver|chrome-lighthouse/i.test(userAgent);
      
      // Additional checks for automated requests
      const isAutomated = 
        req.query.notrack === "1" || 
        (req.headers["sec-fetch-mode"] === "navigate" && 
         req.headers["sec-fetch-dest"] === "document" && 
         req.headers.accept?.includes("text/html") && 
         !req.headers.referer);
      
      // Record the click but avoid double counting
      // 1. Don't count bots/crawlers
      // 2. Don't count likely automated or preview requests
      // 3. Use session cookie to prevent frequent double-clicking
      if (!isBot && !isAutomated) {
        // Check for click tracking cookie to prevent duplicates in quick succession
        const trackingKey = `clicked_${link.id}`;
        const alreadyClicked = req.cookies && req.cookies[trackingKey];
        
        if (!alreadyClicked) {
          // Set a cookie that expires in 30 seconds to prevent multiple counts
          res.cookie(trackingKey, "1", { 
            maxAge: 30000, // 30 seconds
            httpOnly: true,
            sameSite: "strict"
          });
          
          // Record the legitimate click
          await storage.recordClick({
            linkId: link.id,
            ip: req.ip || "",
            userAgent: userAgent || null,
            referrer: req.headers.referer || null,
            location: null, // Would require a geo-IP service
            metadata: {
              headers: req.headers,
              query: req.query
            }
          });
        }
      }
      
      // If it's a bot, send a preview page with meta tags
      if (isBot) {
        // Return HTML with Open Graph meta tags
        return res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>${link.ogTitle || link.name}</title>
            <meta property="og:title" content="${link.ogTitle || link.name}" />
            <meta property="og:description" content="${link.ogDescription || 'Check out this product!'}" />
            <meta property="og:image" content="${link.ogImage || ''}" />
            <meta property="og:url" content="${req.protocol}://${req.get('host')}${req.originalUrl}" />
            <meta property="og:type" content="product" />
            ${link.ogPrice ? `<meta property="og:price:amount" content="${link.ogPrice}" />` : ''}
            ${link.ogPrice ? `<meta property="product:price:amount" content="${link.ogPrice}" />` : ''}
            <meta property="og:price:currency" content="USD" />
            <meta name="twitter:card" content="summary_large_image" />
            <meta http-equiv="refresh" content="0;url=${link.destination}" />
          </head>
          <body>
            <p>Redirecting to ${link.destination}</p>
          </body>
          </html>
        `);
      }
      
      // For regular users, redirect immediately
      return res.redirect(302, link.destination);
    } catch (error) {
      console.error("Error in redirect:", error);
      return res.status(500).json({ message: "Server error" });
    }
  });
  
  return httpServer;
}
