import { useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppContext } from "@/App";
import { LinkWithAnalytics, Click } from "@shared/schema";
import { formatDate } from "@/utils/formatters";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { ChevronLeft, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function LinkDetails() {
  const { selectedLink, setCurrentView } = useContext(AppContext);
  const { toast } = useToast();

  // Fetch clicks for the selected link
  const { data: clicks, isLoading: isLoadingClicks } = useQuery<Click[]>({
    queryKey: ['/api/links', selectedLink?.id, 'clicks'],
    enabled: !!selectedLink,
  });

  if (!selectedLink) {
    return <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">Link not found</div>;
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "Copied to clipboard",
        description: "Link has been copied to your clipboard",
        duration: 2000,
      });
    });
  };

  const shortUrl = `${window.location.origin}/${selectedLink.trackingId}`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <div className="flex items-center">
            <Button 
              variant="ghost" 
              size="sm" 
              className="mr-2 text-gray-400 hover:text-gray-500"
              onClick={() => setCurrentView("links")}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-semibold text-gray-900">{selectedLink.name}</h1>
          </div>
          <p className="mt-2 text-sm text-gray-700">Detailed analytics for your tracking link.</p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <div className="flex space-x-3">
            <Button 
              variant="outline" 
              onClick={() => copyToClipboard(shortUrl)}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy URL
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  Actions
                  <svg className="ml-2 -mr-0.5 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>Edit link</DropdownMenuItem>
                <DropdownMenuItem>Export data</DropdownMenuItem>
                <DropdownMenuItem className="text-red-600">Delete link</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Link Information */}
      <div className="mt-6 bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Link Information</h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">Details about your tracking link.</p>
        </div>
        <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
          <dl className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2">
            <div className="sm:col-span-1">
              <dt className="text-sm font-medium text-gray-500">Name</dt>
              <dd className="mt-1 text-sm text-gray-900">{selectedLink.name}</dd>
            </div>
            <div className="sm:col-span-1">
              <dt className="text-sm font-medium text-gray-500">Platform</dt>
              <dd className="mt-1 text-sm text-gray-900 capitalize">{selectedLink.platform}</dd>
            </div>
            <div className="sm:col-span-1">
              <dt className="text-sm font-medium text-gray-500">Created</dt>
              <dd className="mt-1 text-sm text-gray-900">{formatDate(selectedLink.created)}</dd>
            </div>
            <div className="sm:col-span-1">
              <dt className="text-sm font-medium text-gray-500">Total Clicks</dt>
              <dd className="mt-1 text-sm text-gray-900">{selectedLink.clicks}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm font-medium text-gray-500">Tracking URL</dt>
              <dd className="mt-1 text-sm text-gray-900 font-mono break-all">
                <span>{shortUrl}</span>
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm font-medium text-gray-500">Destination URL</dt>
              <dd className="mt-1 text-sm text-gray-900 font-mono break-all">
                <span>{selectedLink.destination}</span>
              </dd>
            </div>
          </dl>
        </div>
      </div>
      
      {/* Social Media Preview */}
      {(selectedLink.ogTitle || selectedLink.ogImage || selectedLink.ogDescription) && (
        <div className="mt-6 bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Social Media Preview</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">How your link will appear when shared on social media.</p>
          </div>
          <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
            <div className="border border-gray-200 rounded-md overflow-hidden max-w-2xl">
              {/* Mockup of social media card */}
              <div className="p-4">
                {selectedLink.ogImage && (
                  <div className="mb-4 max-h-64 overflow-hidden rounded-md">
                    <img 
                      src={selectedLink.ogImage} 
                      alt={selectedLink.ogTitle || selectedLink.name} 
                      className="w-full object-cover"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  </div>
                )}
                <div className="mb-2 text-sm text-gray-500 uppercase truncate">{window.location.hostname}</div>
                <h3 className="text-lg font-semibold truncate mb-1">{selectedLink.ogTitle || selectedLink.name}</h3>
                {selectedLink.ogDescription && (
                  <p className="text-sm text-gray-600 line-clamp-3">{selectedLink.ogDescription}</p>
                )}
                {selectedLink.ogPrice && (
                  <div className="mt-2 text-sm font-medium text-green-600">${selectedLink.ogPrice} USD</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Performance Chart */}
      <div className="mt-6 bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Performance</h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">Click data for the last 9 days.</p>
        </div>
        <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
          <div className="h-64">
            <div className="h-full flex flex-col">
              <div className="flex-1 flex items-end space-x-2">
                {selectedLink.dailyClicks.map((value, index) => {
                  const maxValue = Math.max(...selectedLink.dailyClicks);
                  const barHeight = maxValue > 0 ? (value / maxValue * 100) : 0;
                  const fillHeight = value > 0 ? 100 : 0;

                  return (
                    <div key={index} className="flex flex-col items-center flex-1">
                      <div 
                        className="w-full bg-primary-200 rounded-t" 
                        style={{ height: `${barHeight}%` }}
                      >
                        <div 
                          className="w-full h-full bg-primary-600 opacity-80 rounded-t hover:opacity-100 transition-opacity cursor-pointer" 
                          style={{ height: `${fillHeight}%` }}
                        ></div>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{value}</div>
                    </div>
                  );
                })}
              </div>
              <div className="h-8 mt-2 flex justify-between">
                <div className="text-xs text-gray-500">9 days ago</div>
                <div className="text-xs text-gray-500">Today</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Click Data Table */}
      <div className="mt-6">
        <div className="sm:flex sm:items-center">
          <div className="sm:flex-auto">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Recent Clicks</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">Detailed information about recent clicks on this link.</p>
          </div>
          <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
            <Button variant="outline">
              Export data
            </Button>
          </div>
        </div>
        <div className="mt-4 flex flex-col">
          <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                {isLoadingClicks ? (
                  <div className="bg-white p-6">
                    <Skeleton className="h-8 w-full mb-4" />
                    <Skeleton className="h-8 w-full mb-4" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ) : (
                  <table className="min-w-full divide-y divide-gray-300">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Timestamp</th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Visitor IP</th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Device</th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Referrer</th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Location</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {clicks && clicks.length > 0 ? (
                        clicks.map((click) => (
                          <tr key={click.id}>
                            <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                              {new Date(click.timestamp).toLocaleString()}
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                              {click.ip || 'Unknown'}
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                              {click.userAgent ? click.userAgent.substring(0, 50) + '...' : 'Unknown'}
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                              {click.referrer || 'Direct'}
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                              {click.location || 'Unknown'}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="text-center py-6 text-gray-500">
                            No click data available for this link.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
        {clicks && clicks.length > 5 && (
          <div className="mt-4">
            <Button 
              variant="link" 
              className="text-sm font-medium text-primary-600 hover:text-primary-500 p-0"
            >
              View all click data
              <span aria-hidden="true">&rarr;</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
