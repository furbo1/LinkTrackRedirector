import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertLinkSchema, insertClickSchema } from "@shared/schema";
import { ZodError } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Redirect endpoint - /r/:trackingId
  app.get("/r/:trackingId", async (req: Request, res: Response) => {
    try {
      const { trackingId } = req.params;
      const link = await storage.getLinkByTrackingId(trackingId);
      
      if (!link) {
        return res.status(404).json({ message: "Link not found" });
      }
      
      // Record the click
      await storage.recordClick({
        linkId: link.id,
        ip: req.ip,
        userAgent: req.headers["user-agent"] || null,
        referrer: req.headers.referer || null,
        location: null, // Would require a geo-IP service
        metadata: {
          headers: req.headers,
          query: req.query
        }
      });
      
      // Redirect to the destination URL
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
      const linkData = insertLinkSchema.omit({ trackingId: true }).parse(req.body);
      
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
