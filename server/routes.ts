import express, { type Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage, MemStorage } from "./storage";
import fetch from "node-fetch";
import * as cheerio from "cheerio";

// Function to fetch Open Graph data from a URL
async function fetchOpenGraphData(url: string): Promise<{
  title: string | null;
  description: string | null;
  image: string | null;
  price: string | null | undefined;
}> {
  try {
    console.log(`Beginning detailed fetch for ${url}`);
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5"
      }
    });
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // First try to get the actual product title and specific product data
    // This might be different from the page title or OG title which often contains site name
    let productTitle = null;
    let productDesc = null;
    
    // Special handling for Temu
    if (url.toLowerCase().includes('temu')) {
      console.log(`Using Temu specific selectors for ${url}`);
      
      // Try to find product name in common Temu selectors
      const temuProductNameSelectors = [
        '.pdp-info-box .title', 
        '.pdp-name',
        '.ProductName',
        '.product-title',
        '.goods-name',
        'h1.name',
        '.pdp-title',
        '[data-testid="product-name"]'
      ];
      
      for (const selector of temuProductNameSelectors) {
        const nameText = $(selector).first().text().trim();
        if (nameText && nameText.length > 5) {
          productTitle = nameText;
          console.log(`Found Temu product name: ${productTitle}`);
          break;
        }
      }
      
      // Try to find product description in common Temu selectors
      const temuDescSelectors = [
        '.product-description',
        '.pdp-description',
        '.goods-desc',
        '.pdp-detail',
        '.product-details'
      ];
      
      for (const selector of temuDescSelectors) {
        const descText = $(selector).first().text().trim();
        if (descText && descText.length > 10) {
          productDesc = descText;
          console.log(`Found Temu product description`);
          break;
        }
      }
    }
    
    // Special handling for Amazon
    else if (url.toLowerCase().includes('amazon') || url.toLowerCase().includes('amzn')) {
      console.log(`Using Amazon specific selectors for ${url}`);
      
      // Try Amazon specific product title selectors
      const amazonTitleSelectors = [
        '#productTitle',
        '.product-title',
        '.a-size-large.product-title-word-break',
        '[data-feature-name="title"]',
        'h1.a-size-large'
      ];
      
      for (const selector of amazonTitleSelectors) {
        const titleText = $(selector).first().text().trim();
        if (titleText && titleText.length > 5) {
          productTitle = titleText;
          console.log(`Found Amazon product title: ${productTitle}`);
          break;
        }
      }
      
      // Try Amazon specific description selectors
      const amazonDescSelectors = [
        '#productDescription p',
        '.a-expander-content p',
        '#feature-bullets .a-list-item',
        '.a-spacing-small.a-spacing-top-small div',
        '[data-feature-name="featurebullets"] li'
      ];
      
      // For Amazon, combine bullet points as description if available
      let bulletPoints = '';
      $('#feature-bullets .a-list-item').each((i, el) => {
        bulletPoints += '• ' + $(el).text().trim() + ' ';
      });
      
      if (bulletPoints.length > 10) {
        productDesc = bulletPoints.substring(0, 300) + (bulletPoints.length > 300 ? '...' : '');
        console.log(`Found Amazon bullet points for description`);
      } else {
        for (const selector of amazonDescSelectors) {
          const descText = $(selector).first().text().trim();
          if (descText && descText.length > 10) {
            productDesc = descText;
            console.log(`Found Amazon product description`);
            break;
          }
        }
      }
    }
    
    // Fallback to Open Graph/meta data if we didn't find specific product data
    const ogTitle = productTitle || 
                    $('meta[property="og:title"]').attr('content') || 
                    $('meta[name="twitter:title"]').attr('content') ||
                    $('title').text() || 
                    $('meta[name="title"]').attr('content') ||
                    $('h1').first().text();
    
    console.log(`Final title: ${ogTitle}`);
                    
    // Enhanced description extraction
    let ogDescription = productDesc ||
                        $('meta[property="og:description"]').attr('content') || 
                        $('meta[name="twitter:description"]').attr('content') ||
                        $('meta[name="description"]').attr('content');
    
    // If no description found, try to extract from generic product description elements
    if (!ogDescription) {
      // Common product description elements
      const possibleDescriptionSelectors = [
        '.product-description', '#product-description', '.description',
        '[data-testid="product-description"]', '.product-details', '.product-info',
        '.details', '#description', 'p.description', '.item-description',
        '.prod-desc', '.product-desc', '.prod-description'
      ];
      
      for (const selector of possibleDescriptionSelectors) {
        const descText = $(selector).first().text().trim();
        if (descText && descText.length > 10) {
          ogDescription = descText;
          break;
        }
      }
      
      // If still no description, look for the first significant paragraph
      if (!ogDescription) {
        $('p').each((i, el) => {
          const text = $(el).text().trim();
          if (text && text.length > 30 && text.length < 500 && !ogDescription) {
            ogDescription = text;
            return false; // break the each loop
          }
        });
      }
    }
    
    // Try to truncate long descriptions
    if (ogDescription && ogDescription.length > 300) {
      ogDescription = ogDescription.substring(0, 297) + '...';
    }
    
    console.log(`Final description: ${ogDescription?.substring(0, 50)}...`);
                          
    // Get image URL
    const ogImage = $('meta[property="og:image"]').attr('content') || 
                    $('meta[property="og:image:url"]').attr('content') ||
                    $('meta[name="twitter:image"]').attr('content') ||
                    $('link[rel="image_src"]').attr('href');
                    
    // Enhanced price extraction - try platform specific selectors first
    let ogPrice = null;
    
    if (url.toLowerCase().includes('temu')) {
      // Temu specific price selectors
      const temuPriceSelectors = [
        '.pdp-price',
        '.price-current',
        '.product-price',
        '.current-price',
        '[data-testid="price"]'
      ];
      
      for (const selector of temuPriceSelectors) {
        const priceText = $(selector).first().text().trim();
        if (priceText && /\$?\d+(\.\d{2})?/.test(priceText)) {
          ogPrice = priceText.match(/\$?\d+(\.\d{2})?/)?.[0] || null;
          console.log(`Found Temu price: ${ogPrice}`);
          break;
        }
      }
    } else if (url.toLowerCase().includes('amazon') || url.toLowerCase().includes('amzn')) {
      // Amazon specific price selectors
      const amazonPriceSelectors = [
        '.a-price .a-offscreen',
        '#priceblock_ourprice',
        '#priceblock_dealprice',
        '.a-color-price',
        '[data-a-color="price"] .a-offscreen'
      ];
      
      for (const selector of amazonPriceSelectors) {
        const priceText = $(selector).first().text().trim();
        if (priceText && /\$?\d+(\.\d{2})?/.test(priceText)) {
          ogPrice = priceText.match(/\$?\d+(\.\d{2})?/)?.[0] || null;
          console.log(`Found Amazon price: ${ogPrice}`);
          break;
        }
      }
    }
    
    // Fallback to meta tags if we didn't find platform-specific prices
    if (!ogPrice) {
      ogPrice = $('meta[property="og:price:amount"]').attr('content') || 
                $('meta[property="product:price:amount"]').attr('content');
    }
    
    // If still no price, use generic selectors
    if (!ogPrice) {
      const priceSelectors = [
        '.price', '#price', '.product-price', '.prod-price', 
        '[data-testid="price"]', '.sale-price', '.current-price',
        '.offer-price', '.special-price', '.discount-price'
      ];
      
      for (const selector of priceSelectors) {
        const priceText = $(selector).first().text().trim();
        if (priceText && /\$?\d+(\.\d{2})?/.test(priceText)) {
          ogPrice = priceText.match(/\$?\d+(\.\d{2})?/)?.[0] || null;
          break;
        }
      }
    }
    
    console.log(`Final price: ${ogPrice}`);
    
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
      let ogData: {
        title: string | null;
        description: string | null;
        image: string | null;
        price: string | null | undefined;
      } = {
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
          
          // Fetch Open Graph data synchronously - for better user experience
          // Wait for OG data to be fetched first
          console.log(`Fetching OG data for ${url}...`);
          let ogData: {
            title: string | null;
            description: string | null;
            image: string | null;
            price: string | null | undefined;
          } = {
            title: null,
            description: null,
            image: null,
            price: null
          };
          
          try {
            ogData = await fetchOpenGraphData(url);
            console.log(`Fetched OG data: ${JSON.stringify(ogData)}`);
            
            // Use title as name if available and current name is generic
            if (ogData.title && name.includes("Product")) {
              name = ogData.title.substring(0, 50); // Limit to 50 chars
            }
          } catch (e) {
            console.error(`Error fetching OG data for ${url}:`, e);
          }
          
          // Create link with all data
          const linkData = {
            name,
            destination: url,
            platform,
            ogTitle: ogData.title,
            ogDescription: ogData.description,
            ogImage: ogData.image,
            ogPrice: ogData.price
          };
          
          const link = await storage.createLink(linkData);
          
          // Return success with OG data
          results.push({
            destination: url,
            platform,
            name,
            trackingId: link.trackingId,
            success: true,
            ogTitle: ogData.title,
            ogDescription: ogData.description,
            ogImage: ogData.image,
            ogPrice: ogData.price
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
