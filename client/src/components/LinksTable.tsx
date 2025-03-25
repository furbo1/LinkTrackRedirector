import { useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppContext } from "@/App";
import { LinkWithAnalytics } from "@shared/schema";
import { formatDate } from "@/utils/formatters";
import { PlatformIcon } from "@/utils/platforms";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

export default function LinksTable() {
  const { setCurrentView, setSelectedLink, setShowNewLinkModal } = useContext(AppContext);
  const { toast } = useToast();
  
  const { data: links, isLoading } = useQuery<LinkWithAnalytics[]>({
    queryKey: ['/api/links'],
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "Copied to clipboard",
        description: "Link has been copied to your clipboard",
        duration: 2000,
      });
    });
  };

  const viewLinkDetails = (link: LinkWithAnalytics) => {
    setSelectedLink(link);
    setCurrentView("linkDetails");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">My Links</h1>
          <p className="mt-2 text-sm text-gray-700">A list of all your tracking links including their destinations and performance metrics.</p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <Button onClick={() => setShowNewLinkModal(true)}>
            Add link
          </Button>
        </div>
      </div>
      <div className="mt-8 flex flex-col">
        <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              {isLoading ? (
                <div className="bg-white p-6">
                  <Skeleton className="h-8 w-full mb-4" />
                  <Skeleton className="h-8 w-full mb-4" />
                  <Skeleton className="h-8 w-full mb-4" />
                  <Skeleton className="h-8 w-full mb-4" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Name</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Tracking URL</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Destination</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Created</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Clicks</th>
                      <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {links && links.map((link) => (
                      <tr key={link.id}>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                          <div className="flex items-center">
                            <PlatformIcon platform={link.platform} size="small" />
                            <div className="ml-2">{link.name}</div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          <div className="flex items-center">
                            <span className="font-mono text-xs mr-2">{`${window.location.origin}/r/${link.trackingId}`}</span>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 text-primary-600 hover:text-primary-900 text-xs p-0"
                              onClick={() => copyToClipboard(`${window.location.origin}/r/${link.trackingId}`)}
                            >
                              Copy
                            </Button>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 font-mono truncate max-w-xs">
                          {link.destination}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {formatDate(link.created)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {link.clicks}
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          <Button 
                            variant="link" 
                            onClick={() => viewLinkDetails(link)} 
                            className="text-primary-600 hover:text-primary-900"
                          >
                            View<span className="sr-only">, link</span>
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {links && links.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-6 text-gray-500">
                          No links created yet. Click "Add link" to create your first tracking link.
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
    </div>
  );
}
