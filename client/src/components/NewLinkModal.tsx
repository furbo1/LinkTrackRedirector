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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-center">Create New Link</DialogTitle>
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
          </div>
        </div>
        
        <DialogFooter className="mt-6 sm:grid-cols-2">
          <Button variant="outline" onClick={() => setShowNewLinkModal(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateLink}
            disabled={createLinkMutation.isPending}
          >
            {createLinkMutation.isPending ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
