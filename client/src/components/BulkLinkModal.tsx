import { useState, useContext } from "react";
import { useMutation } from "@tanstack/react-query";
import { AppContext } from "@/App";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

// Types for bulk link processing
type BulkLinkResult = {
  destination: string;
  platform: string;
  name: string;
  trackingId: string;
  success: boolean;
  error?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogPrice?: string;
};

export default function BulkLinkModal() {
  const { showBulkLinkModal, setShowBulkLinkModal } = useContext(AppContext);
  const { toast } = useToast();

  const [urls, setUrls] = useState("");
  const [results, setResults] = useState<BulkLinkResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Helper function to detect platform from URL
  const detectPlatform = (url: string): string => {
    try {
      const urlObj = new URL(url);
      if (urlObj.hostname.includes('amazon') || urlObj.hostname.includes('amzn')) {
        return 'amazon';
      } else if (urlObj.hostname.includes('temu')) {
        return 'temu';
      }
      return 'other';
    } catch (e) {
      return 'other';
    }
  };

  // Helper function to generate a name from URL
  const generateNameFromUrl = (url: string, platform: string): string => {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname;
      
      if (platform === 'amazon') {
        return `Amazon Product ${path.split('/').filter(Boolean)[0] || new Date().toISOString()}`;
      } else if (platform === 'temu') {
        return `Temu Product ${path.split('/').filter(Boolean)[0] || new Date().toISOString()}`;
      }
      
      return `Product Link ${new Date().toISOString()}`;
    } catch (e) {
      return `Product Link ${new Date().toISOString()}`;
    }
  };

  // Mutation for creating a single link
  const createLinkMutation = useMutation({
    mutationFn: async (data: { name: string; destination: string; platform: string }) => {
      const response = await apiRequest('POST', '/api/links', data);
      return response.json();
    }
  });

  // Mutation for bulk link creation
  const bulkCreateLinksMutation = useMutation({
    mutationFn: async (urls: string[]) => {
      const response = await apiRequest('POST', '/api/links/bulk', { urls });
      return response.json();
    }
  });

  const handleProcessUrls = async () => {
    if (!urls.trim()) {
      toast({
        title: "No URLs provided",
        description: "Please enter at least one URL to convert",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setResults([]);
    
    // Split by newlines and remove empty lines
    const urlList = urls.split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0);
    
    try {
      // Process URLs in bulk using server endpoint
      const newResults = await bulkCreateLinksMutation.mutateAsync(urlList);
      
      setResults(newResults);
      
      // Invalidate and refetch links query
      queryClient.invalidateQueries({ queryKey: ['/api/links'] });
      
      if (newResults.some((r: BulkLinkResult) => r.success)) {
        toast({
          title: "Links processed",
          description: `Successfully created ${newResults.filter((r: BulkLinkResult) => r.success).length} of ${urlList.length} links`,
        });
      }
    } catch (error) {
      console.error("Error processing bulk links:", error);
      toast({
        title: "Error processing links",
        description: error instanceof Error ? error.message : "Failed to process links",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyResults = () => {
    const textToCopy = results
      .map(r => `${r.success ? '✅' : '❌'} ${r.destination} -> ${window.location.origin}/${r.trackingId}`)
      .join('\n');
    
    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        toast({
          title: "Copied to clipboard",
          description: "All results have been copied to your clipboard",
        });
      })
      .catch(() => {
        toast({
          title: "Copy failed",
          description: "Failed to copy results to clipboard",
          variant: "destructive",
        });
      });
  };

  // Add a debug log to verify modal state
  console.log("BulkLinkModal rendering, modal is:", showBulkLinkModal ? "open" : "closed");
  
  return (
    <Dialog open={showBulkLinkModal} onOpenChange={setShowBulkLinkModal}>
      <DialogContent className="sm:max-w-2xl bg-white border-2 border-primary-200">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-center text-2xl font-bold text-primary-700">Bulk Link Conversion</DialogTitle>
          <DialogDescription className="text-center">
            Convert multiple links at once. Enter one URL per line.
          </DialogDescription>
        </DialogHeader>
        
        <div className="mt-6 space-y-4">
          <div className="grid w-full gap-1.5">
            <Label htmlFor="bulk-urls">Enter URLs (one per line)</Label>
            <Textarea 
              id="bulk-urls" 
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
              placeholder="https://www.temu.com/product1.html
https://www.amazon.com/product2.html
https://www.temu.com/product3.html"
              className="h-[150px] font-mono"
            />
          </div>
          
          {results.length > 0 && (
            <div className="border rounded-lg p-4 mt-4 max-h-[200px] overflow-y-auto">
              <div className="text-sm font-medium mb-2">Results:</div>
              <div className="space-y-2">
                {results.map((result, index) => (
                  <div key={index} className={`text-sm p-2 rounded ${result.success ? 'bg-green-50' : 'bg-red-50'}`}>
                    <div className="flex justify-between items-center">
                      <div className="font-medium truncate max-w-[70%]">
                        {result.success ? '✅' : '❌'} {result.name || 'Unnamed'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {result.platform}
                      </div>
                    </div>
                    <div className="text-xs truncate">{result.destination}</div>
                    {result.success && (
                      <div className="mt-1 flex items-center gap-2">
                        <div className="bg-primary-100 text-primary-800 text-xs font-mono px-2 py-1 rounded">
                          {window.location.origin}/{result.trackingId}
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-6 px-2"
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/${result.trackingId}`);
                            toast({
                              title: "Copied!",
                              description: "Link copied to clipboard",
                            });
                          }}
                        >
                          Copy
                        </Button>
                      </div>
                    )}
                    {!result.success && (
                      <div className="text-xs text-red-600 mt-1">{result.error}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter className="mt-6 sm:grid-cols-2 flex-wrap gap-2">
          {results.length > 0 && (
            <Button 
              variant="outline" 
              onClick={handleCopyResults}
              className="w-full sm:w-auto"
            >
              Copy All Results
            </Button>
          )}
          <Button 
            variant="outline" 
            onClick={() => setShowBulkLinkModal(false)}
            className="w-full sm:w-auto order-last sm:order-none"
          >
            Close
          </Button>
          <Button 
            onClick={handleProcessUrls}
            disabled={isProcessing || !urls.trim()}
            className="bg-primary-600 text-white hover:bg-primary-700 font-semibold w-full sm:w-auto"
            size="lg"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Process URLs"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}