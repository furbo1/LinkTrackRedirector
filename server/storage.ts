import { nanoid } from "nanoid";
import { links, type Link, type InsertLink, clicks, type Click, type InsertClick, type LinkWithAnalytics } from "@shared/schema";

export interface IStorage {
  // Link methods
  createLink(link: Omit<InsertLink, "trackingId">): Promise<Link>;
  getLinkById(id: number): Promise<Link | undefined>;
  getLinkByTrackingId(trackingId: string): Promise<Link | undefined>;
  getAllLinks(): Promise<Link[]>;
  getLinksWithAnalytics(): Promise<LinkWithAnalytics[]>;
  getLinkWithAnalytics(id: number): Promise<LinkWithAnalytics | undefined>;
  
  // Click methods
  recordClick(click: Omit<InsertClick, "timestamp">): Promise<Click>;
  getClicksByLinkId(linkId: number): Promise<Click[]>;
  getClicksCount(linkId: number): Promise<number>;
  getDailyClicksData(linkId: number, days: number): Promise<number[]>;
}

export class MemStorage implements IStorage {
  private linksData: Map<number, Link>;
  private clicksData: Map<number, Click>;
  private linkIdCounter: number;
  private clickIdCounter: number;

  constructor() {
    this.linksData = new Map();
    this.clicksData = new Map();
    this.linkIdCounter = 1;
    this.clickIdCounter = 1;
  }

  // Link methods
  async createLink(linkData: Omit<InsertLink, "trackingId">): Promise<Link> {
    const id = this.linkIdCounter++;
    
    // Generate a shorter tracking ID (just 3 characters) using a custom alphabet that excludes confusing characters
    const customAlphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz'; // Removed 0, O, o, 1, I, l
    const trackingId = Array.from({length: 3}, () => customAlphabet.charAt(Math.floor(Math.random() * customAlphabet.length))).join('');
    
    // Get platform hint character (first character of platform, or first character of destination)
    let platformHint = '';
    if (linkData.platform && linkData.platform.length > 0) {
      platformHint = linkData.platform.charAt(0).toLowerCase();
    } else {
      try {
        const url = new URL(linkData.destination);
        platformHint = url.hostname.charAt(0).toLowerCase();
      } catch (e) {
        platformHint = 'x'; // fallback
      }
    }
    
    // Final tracking ID: platform hint + 3 random chars (total: 4 chars)
    const finalTrackingId = platformHint + trackingId;
    const now = new Date();
    
    const link: Link = {
      id,
      trackingId: finalTrackingId,
      name: linkData.name,
      destination: linkData.destination,
      platform: linkData.platform,
      created: now,
      ogTitle: linkData.ogTitle || null,
      ogDescription: linkData.ogDescription || null,
      ogImage: linkData.ogImage || null,
      ogPrice: linkData.ogPrice || null
    };
    
    this.linksData.set(id, link);
    return link;
  }

  async getLinkById(id: number): Promise<Link | undefined> {
    return this.linksData.get(id);
  }

  async getLinkByTrackingId(trackingId: string): Promise<Link | undefined> {
    return Array.from(this.linksData.values()).find(
      (link) => link.trackingId === trackingId
    );
  }

  async getAllLinks(): Promise<Link[]> {
    return Array.from(this.linksData.values()).sort((a, b) => 
      // Sort by creation date (newest first)
      b.created.getTime() - a.created.getTime()
    );
  }

  async getLinksWithAnalytics(): Promise<LinkWithAnalytics[]> {
    const links = await this.getAllLinks();
    const result: LinkWithAnalytics[] = [];
    
    for (const link of links) {
      const clicksCount = await this.getClicksCount(link.id);
      const dailyClicks = await this.getDailyClicksData(link.id, 9); // Last 9 days
      
      result.push({
        ...link,
        clicks: clicksCount,
        dailyClicks
      });
    }
    
    return result;
  }

  async getLinkWithAnalytics(id: number): Promise<LinkWithAnalytics | undefined> {
    const link = await this.getLinkById(id);
    if (!link) return undefined;
    
    const clicksCount = await this.getClicksCount(link.id);
    const dailyClicks = await this.getDailyClicksData(link.id, 9); // Last 9 days
    
    return {
      ...link,
      clicks: clicksCount,
      dailyClicks
    };
  }

  // Click methods
  async recordClick(clickData: Omit<InsertClick, "timestamp">): Promise<Click> {
    const id = this.clickIdCounter++;
    const now = new Date();
    
    const click: Click = {
      id,
      linkId: clickData.linkId,
      timestamp: now,
      ip: clickData.ip || null,
      userAgent: clickData.userAgent || null,
      referrer: clickData.referrer || null,
      location: clickData.location || null,
      metadata: clickData.metadata || null,
    };
    
    this.clicksData.set(id, click);
    return click;
  }

  async getClicksByLinkId(linkId: number): Promise<Click[]> {
    return Array.from(this.clicksData.values())
      .filter(click => click.linkId === linkId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()); // Newest first
  }

  async getClicksCount(linkId: number): Promise<number> {
    return Array.from(this.clicksData.values()).filter(
      click => click.linkId === linkId
    ).length;
  }

  async getDailyClicksData(linkId: number, days: number): Promise<number[]> {
    const result: number[] = new Array(days).fill(0);
    const now = new Date();
    const clicks = Array.from(this.clicksData.values()).filter(
      click => click.linkId === linkId
    );
    
    // Count clicks for each of the last X days
    for (const click of clicks) {
      const daysDiff = Math.floor((now.getTime() - click.timestamp.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff < days) {
        result[days - 1 - daysDiff]++;
      }
    }
    
    return result;
  }
}

export const storage = new MemStorage();
