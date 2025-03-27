import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileUp, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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

export default function BulkLinkButton() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [urls, setUrls] = useState("");
  const [results, setResults] = useState<BulkLinkResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  // Open modal when button is clicked
  const openModal = () => {
    console.log("Opening bulk modal");
    setIsModalOpen(true);
  };

  // Close modal
  const closeModal = () => {
    setIsModalOpen(false);
  };

  // Mutation for bulk link creation
  const bulkCreateLinksMutation = useMutation({
    mutationFn: async (urls: string[]) => {
      const response = await apiRequest('POST', '/api/links/bulk', { urls });
      return response.json();
    }
  });

  // Process URLs handler
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

  // Handle copy all results
  const handleCopyResults = () => {
    const textToCopy = results
      .map(r => {
        // Format product description text with product details for successful links
        let productDetails = '';
        if (r.success) {
          if (r.ogTitle) productDetails += `\n   Title: ${r.ogTitle}`;
          if (r.ogDescription) productDetails += `\n   Description: ${r.ogDescription}`;
          if (r.ogPrice) productDetails += `\n   Price: ${r.ogPrice}`;
          
          // Add tracking link
          productDetails += `\n   Track link: ${window.location.origin}/${r.trackingId}`;
        }
        
        return `${r.success ? '✅' : '❌'} ${r.platform} - ${r.name}${productDetails}`;
      })
      .join('\n\n');
    
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

  return (
    <>
      {/* Button */}
      <Button 
        onClick={openModal}
        variant="default"
        size="lg"
        className="bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2 font-bold px-8 py-3 text-lg shadow-lg border-2 border-white rounded-lg transition-all hover:scale-105"
      >
        <FileUp className="h-6 w-6 mr-2" />
        <span>BULK CONVERT</span>
      </Button>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white border-2 border-primary-200 rounded-lg shadow-xl">
            <div className="relative p-6">
              {/* Close button */}
              <button 
                onClick={closeModal} 
                className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 focus:outline-none"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </button>
              
              {/* Header */}
              <div className="pb-4 text-center">
                <h2 className="text-2xl font-bold text-primary-700">Bulk Link Conversion</h2>
                <p className="text-gray-500">
                  Convert multiple links at once. Enter one URL per line.
                </p>
              </div>
              
              {/* Content */}
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
                            <div className="text-xs font-semibold px-2 py-1 rounded bg-blue-100 text-blue-800">
                              {result.platform}
                            </div>
                          </div>
                          <div className="text-xs truncate">{result.destination}</div>
                          
                          {/* Product Details Box - Always displayed for successful links */}
                          {result.success && (
                            <div className="mt-2 p-2 bg-white border border-gray-200 rounded shadow-sm">
                              <div className="font-medium text-sm text-blue-800 mb-1">Product Details:</div>
                              
                              {/* Product Title */}
                              {result.ogTitle && (
                                <div className="text-sm font-semibold">
                                  {result.ogTitle}
                                </div>
                              )}
                              
                              {/* Product Description */}
                              {result.ogDescription && (
                                <div className="mt-1 text-xs text-gray-700">
                                  {result.ogDescription}
                                </div>
                              )}
                              
                              {/* If no title or description, show a message */}
                              {!result.ogTitle && !result.ogDescription && (
                                <div className="text-xs text-gray-500 italic">
                                  No product details available yet. Details will be updated automatically.
                                </div>
                              )}
                              
                              {/* Product Price if available */}
                              {result.ogPrice && (
                                <div className="mt-1 text-sm font-bold text-green-700">
                                  Price: {result.ogPrice}
                                </div>
                              )}
                            </div>
                          )}
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
              
              {/* Footer */}
              <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2">
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
                  onClick={closeModal}
                  className="w-full sm:w-auto order-last sm:order-none"
                >
                  Close
                </Button>
                <Button 
                  onClick={handleProcessUrls}
                  disabled={isProcessing || !urls.trim()}
                  className="bg-blue-600 text-white hover:bg-blue-700 font-semibold w-full sm:w-auto shadow-md border-2 border-blue-500"
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
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}