import { useState, useContext } from "react";
import { useMutation } from "@tanstack/react-query";
import { AppContext } from "@/App";
import { InsertLink } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function NewLinkModal() {
  const { showNewLinkModal, setShowNewLinkModal } = useContext(AppContext);
  const { toast } = useToast();

  const [linkData, setLinkData] = useState({
    name: '',
    destination: '',
    platform: 'temu'
  });
  
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setLinkData(prev => ({ ...prev, [name]: value }));
  };

  const handlePlatformChange = (value: string) => {
    setLinkData(prev => ({ ...prev, platform: value }));
  };

  const createLinkMutation = useMutation({
    mutationFn: async (data: Omit<InsertLink, 'trackingId'>) => {
      const response = await apiRequest('POST', '/api/links', data);
      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch links query
      queryClient.invalidateQueries({ queryKey: ['/api/links'] });
      setShowNewLinkModal(false);
      setLinkData({
        name: '',
        destination: '',
        platform: 'temu'
      });
      toast({
        title: "Link created",
        description: "Your tracking link has been created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create link",
        variant: "destructive",
      });
    }
  });

  const handleCreateLink = () => {
    if (!linkData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Link name is required",
        variant: "destructive",
      });
      return;
    }

    if (!linkData.destination.trim()) {
      toast({
        title: "Validation Error",
        description: "Destination URL is required",
        variant: "destructive",
      });
      return;
    }

    try {
      // Simple URL validation
      new URL(linkData.destination);
      
      setIsLoading(true);
      toast({
        title: "Processing",
        description: "Fetching product information and creating your link...",
      });
      
      createLinkMutation.mutate(linkData, {
        onSettled: () => {
          setIsLoading(false);
        }
      });
    } catch (e) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid destination URL",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={showNewLinkModal} onOpenChange={setShowNewLinkModal}>
      <DialogContent className="sm:max-w-lg bg-white border-2 border-primary-200">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-center text-2xl font-bold text-primary-700">Create New Link</DialogTitle>
          <DialogDescription className="text-center">
            Create a new tracking link for your promotion. This will generate a unique URL that you can share.
          </DialogDescription>
        </DialogHeader>
        
        <div className="mt-6 space-y-4">
          <div className="grid w-full gap-1.5">
            <Label htmlFor="link-name">Link Name</Label>
            <Input 
              type="text" 
              id="link-name" 
              name="name" 
              value={linkData.name}
              onChange={handleInputChange}
              placeholder="Black Friday Camera Deal"
            />
          </div>
          
          <div className="grid w-full gap-1.5">
            <Label htmlFor="destination-url">Destination URL</Label>
            <Input 
              type="url" 
              id="destination-url" 
              name="destination"
              value={linkData.destination}
              onChange={handleInputChange}
              placeholder="https://temu.to/k/your-link"
            />
          </div>
          
          <div className="grid w-full gap-1.5">
            <Label htmlFor="platform">Platform</Label>
            <Select value={linkData.platform} onValueChange={handlePlatformChange}>
              <SelectTrigger id="platform">
                <SelectValue placeholder="Select a platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="temu">Temu</SelectItem>
                <SelectItem value="amazon">Amazon</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 mt-1">
              The platform selection determines the first character of your tracking ID 
              (<span className="text-blue-600 font-mono">t</span> for Temu, 
              <span className="text-blue-600 font-mono"> a</span> for Amazon, 
              <span className="text-blue-600 font-mono"> o</span> for other).
            </p>
          </div>
          
          {/* URL Format Preview */}
          <div className="mt-4 p-3 bg-gray-50 rounded-md border border-gray-200">
            <div className="text-sm text-gray-700 font-medium mb-2">URL Format Preview</div>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex-1 px-2 py-1 bg-gray-100 rounded truncate font-mono text-xs">
                {linkData.destination ? `${linkData.destination.substring(0, 25)}...` : 'https://example.com/product...'}
              </div>
              <div className="flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
                  <path d="M5 12h14"></path>
                  <path d="m12 5 7 7-7 7"></path>
                </svg>
              </div>
              <div className="flex-shrink-0 px-2 py-1 bg-blue-100 text-blue-800 font-bold rounded text-xs">
                {window.location.origin}/<span className="underline text-blue-600">{linkData.platform.charAt(0)}</span><span className="text-green-600">xxx</span>
              </div>
            </div>
            
            {/* Tracking ID explanation */}
            <div className="text-xs text-gray-500 pl-2 border-l-2 border-blue-200">
              <span className="font-medium">Format:</span> 
              <span className="ml-1 text-blue-600 font-mono">{linkData.platform.charAt(0)}</span>
              <span className="text-gray-400 mx-1">=</span>
              <span>platform,</span>
              <span className="ml-1 text-green-600 font-mono">xxx</span>
              <span className="text-gray-400 mx-1">=</span>
              <span>unique ID</span>
            </div>
          </div>
        </div>
        
        <DialogFooter className="mt-6 sm:grid-cols-2">
          <Button variant="outline" onClick={() => setShowNewLinkModal(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateLink}
            disabled={createLinkMutation.isPending}
            className="bg-primary-600 text-white hover:bg-primary-700 font-semibold"
            size="lg"
          >
            {createLinkMutation.isPending ? "Creating..." : "Create Link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
