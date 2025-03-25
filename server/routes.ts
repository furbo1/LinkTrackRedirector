import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertLinkSchema, insertClickSchema } from "@shared/schema";
import { ZodError } from "zod";
import fetch from "node-fetch";
import * as cheerio from "cheerio";
import path from "path";
import fs from "fs";

// Function to fetch Open Graph data from a URL
async function fetchOpenGraphData(url: string) {
  try {
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const ogData = {
      title: $('meta[property="og:title"]').attr('content') || 
             $('meta[name="twitter:title"]').attr('content') || 
             $('title').text() || '',
      description: $('meta[property="og:description"]').attr('content') || 
                  $('meta[name="twitter:description"]').attr('content') || 
                  $('meta[name="description"]').attr('content') || '',
      image: $('meta[property="og:image"]').attr('content') || 
             $('meta[property="og:image:url"]').attr('content') || 
             $('meta[name="twitter:image"]').attr('content') || '',
      price: $('meta[property="og:price:amount"]').attr('content') || 
             $('meta[property="product:price:amount"]').attr('content') || '',
    };
    
    return ogData;
  } catch (error) {
    console.error("Error fetching Open Graph data:", error);
    return {
      title: '',
      description: '',
      image: '',
      price: ''
    };
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Redirect endpoint with preview page - /r/:trackingId
  app.get("/r/:trackingId", async (req: Request, res: Response) => {
    try {
      const { trackingId } = req.params;
      const link = await storage.getLinkByTrackingId(trackingId);
      
      if (!link) {
        return res.status(404).json({ message: "Link not found" });
      }
      
      // Is this a bot/crawler requesting the page? (e.g., social media preview)
      const userAgent = req.headers["user-agent"] || "";
      const isBot = /bot|crawl|facebook|twitter|linkedin|pinterest|slack|discord|telegram/i.test(userAgent);
      
      // Record the click (not for bots/crawlers)
      if (!isBot) {
        await storage.recordClick({
          linkId: link.id,
          ip: req.ip,
          userAgent: userAgent || null,
          referrer: req.headers.referer || null,
          location: null, // Would require a geo-IP service
          metadata: {
            headers: req.headers,
            query: req.query
          }
        });
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

  // API Endpoints
  // Get all links with analytics
  app.get("/api/links", async (_req: Request, res: Response) => {
    try {
      const links = await storage.getLinksWithAnalytics();
      return res.json(links);
    } catch (error) {
      console.error("Error getting links:", error);
      return res.status(500).json({ message: "Failed to get links" });
    }
  });

  // Get a single link with analytics
  app.get("/api/links/:id", async (req: Request, res: Response) => {
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
  app.post("/api/links", async (req: Request, res: Response) => {
    try {
      // Parse and validate the request body
      const data = insertLinkSchema.omit({ trackingId: true, ogTitle: true, ogDescription: true, ogImage: true, ogPrice: true }).parse(req.body);
      
      // Fetch Open Graph data from the destination URL
      const ogData = await fetchOpenGraphData(data.destination);
      
      const linkData = {
        ...data,
        ogTitle: ogData.title,
        ogDescription: ogData.description,
        ogImage: ogData.image,
        ogPrice: ogData.price
      };
      
      // Create the link
      const link = await storage.createLink(linkData);
      
      return res.status(201).json(link);
    } catch (error) {
      console.error("Error creating link:", error);
      
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          message: "Invalid link data", 
          errors: error.errors 
        });
      }
      
      return res.status(500).json({ message: "Failed to create link" });
    }
  });
  
  // Get clicks for a specific link
  app.get("/api/links/:id/clicks", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid link ID" });
      }
      
      const link = await storage.getLinkById(id);
      if (!link) {
        return res.status(404).json({ message: "Link not found" });
      }
      
      const clicks = await storage.getClicksByLinkId(id);
      return res.json(clicks);
    } catch (error) {
      console.error("Error getting clicks:", error);
      return res.status(500).json({ message: "Failed to get clicks" });
    }
  });

  // Get platform statistics
  app.get("/api/stats/platforms", async (_req: Request, res: Response) => {
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
  
  return httpServer;
}
