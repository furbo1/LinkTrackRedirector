import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { InsertLink } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function DirectLinkModal() {
  const [isOpen, setIsOpen] = useState(false);
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
      setIsOpen(false);
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
    <div>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-10 right-10 z-50 h-16 w-16 rounded-full bg-primary-600 hover:bg-primary-700 shadow-lg pulse-effect flex items-center justify-center"
      >
        <span className="text-3xl text-white font-bold">+</span>
      </button>
      
      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
            <div className="flex justify-between items-center border-b pb-4 mb-4">
              <h2 className="text-xl font-bold text-primary-700">Create New Link</h2>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                &times;
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="direct-link-name">Link Name</Label>
                <Input 
                  type="text" 
                  id="direct-link-name" 
                  name="name" 
                  value={linkData.name}
                  onChange={handleInputChange}
                  placeholder="Black Friday Camera Deal"
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="direct-destination-url">Destination URL</Label>
                <Input 
                  type="url" 
                  id="direct-destination-url" 
                  name="destination"
                  value={linkData.destination}
                  onChange={handleInputChange}
                  placeholder="https://temu.to/k/your-link"
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="direct-platform">Platform</Label>
                <Select 
                  value={linkData.platform} 
                  onValueChange={handlePlatformChange}
                >
                  <SelectTrigger id="direct-platform" className="mt-1">
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
            
            <div className="flex justify-end gap-2 mt-6">
              <Button 
                variant="outline" 
                onClick={() => setIsOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleCreateLink}
                disabled={isLoading}
                className="bg-primary-600 text-white hover:bg-primary-700 font-semibold"
              >
                {isLoading ? "Creating..." : "Create Link"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}