import { useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppContext } from "@/App";
import { LinkWithAnalytics } from "@shared/schema";
import { formatDate } from "@/utils/formatters";
import { PlatformIcon } from "@/utils/platforms";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { BarChart3, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const { setCurrentView, setSelectedLink, setShowNewLinkModal } = useContext(AppContext);
  const { toast } = useToast();
  
  const { data: links, isLoading } = useQuery<LinkWithAnalytics[]>({
    queryKey: ['/api/links'],
  });

  // Helper functions
  const getTotalClicks = () => {
    if (!links) return 0;
    return links.reduce((sum, link) => sum + link.clicks, 0);
  };

  const getPlatformClicks = (platform: string) => {
    if (!links) return 0;
    return links
      .filter(link => link.platform === platform)
      .reduce((sum, link) => sum + link.clicks, 0);
  };

  const getTopPerformingLink = () => {
    if (!links || links.length === 0) return null;
    return [...links].sort((a, b) => b.clicks - a.clicks)[0];
  };

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

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const topLink = getTopPerformingLink();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
      
      {/* Stats Cards */}
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {/* Total Clicks Card */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-primary-100 rounded-md p-3">
                <BarChart3 className="h-6 w-6 text-primary-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Clicks</dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900">{getTotalClicks()}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-4 py-4 sm:px-6">
            <div className="text-sm">
              <Button 
                variant="link" 
                className="font-medium text-primary-600 hover:text-primary-500 p-0"
                onClick={() => setCurrentView("links")}
              >
                View all links
                <span aria-hidden="true">&rarr;</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Temu Clicks Card */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-orange-100 rounded-md p-3">
                <PlatformIcon platform="temu" className="h-6 w-6 text-orange-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Temu Clicks</dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900">{getPlatformClicks('temu')}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-4 py-4 sm:px-6">
            <div className="text-sm">
              <Button 
                variant="link" 
                className="font-medium text-primary-600 hover:text-primary-500 p-0"
                onClick={() => setCurrentView("links")}
              >
                View Temu links
                <span aria-hidden="true">&rarr;</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Amazon Clicks Card */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-yellow-100 rounded-md p-3">
                <PlatformIcon platform="amazon" className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Amazon Clicks</dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900">{getPlatformClicks('amazon')}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-4 py-4 sm:px-6">
            <div className="text-sm">
              <Button 
                variant="link" 
                className="font-medium text-primary-600 hover:text-primary-500 p-0"
                onClick={() => setCurrentView("links")}
              >
                View Amazon links
                <span aria-hidden="true">&rarr;</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Quick Actions</h3>
        </div>
        <div className="px-4 py-5 sm:p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="border rounded-md p-4 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Create New Link</h3>
                <p className="mt-1 text-sm text-gray-500">Generate a new tracking link for your promotion</p>
              </div>
              <Button 
                onClick={() => setShowNewLinkModal(true)}
                className="bg-primary-600 text-white hover:bg-primary-700"
              >
                <span className="mr-1 text-lg font-bold">+</span> Create
              </Button>
            </div>
            
            <div className="border rounded-md p-4 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Export Data</h3>
                <p className="mt-1 text-sm text-gray-500">Download your link analytics as CSV</p>
              </div>
              <Button variant="outline">
                Export
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Links */}
      <div className="mt-8">
        <div className="sm:flex sm:items-center">
          <div className="sm:flex-auto">
            <h2 className="text-xl font-semibold text-gray-900">Recent Links</h2>
            <p className="mt-2 text-sm text-gray-700">A list of your most recently created tracking links.</p>
          </div>
          <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
            <Button 
              onClick={() => setShowNewLinkModal(true)}
              className="bg-primary-600 text-white hover:bg-primary-700"
            >
              <span className="mr-1 text-lg font-bold">+</span> Add Link
            </Button>
          </div>
        </div>
        <div className="mt-4 flex flex-col">
          <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Name</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Tracking URL</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Created</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Clicks</th>
                      <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {links && links.slice(0, 3).map((link) => (
                      <tr key={link.id}>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                          <div className="flex items-center">
                            <PlatformIcon platform={link.platform} size="small" />
                            <div className="ml-2">{link.name}</div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          <div className="flex items-center">
                            <span className="font-mono text-xs mr-2">{`https://trk.li/r/${link.trackingId}`}</span>
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
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{formatDate(link.created)}</td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{link.clicks}</td>
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
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4 text-sm">
          <Button 
            variant="link" 
            className="font-medium text-primary-600 hover:text-primary-500 p-0"
            onClick={() => setCurrentView("links")}
          >
            View all links
            <span aria-hidden="true">&rarr;</span>
          </Button>
        </div>
      </div>

      {/* Top Performing Link */}
      {topLink && (
        <div className="mt-8 bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Top Performing Link</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">Your best performing tracking link.</p>
          </div>
          <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Name</dt>
                <dd className="mt-1 text-sm text-gray-900">{topLink.name}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Platform</dt>
                <dd className="mt-1 text-sm text-gray-900 capitalize">{topLink.platform}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Total Clicks</dt>
                <dd className="mt-1 text-sm text-gray-900">{topLink.clicks}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Created</dt>
                <dd className="mt-1 text-sm text-gray-900">{formatDate(topLink.created)}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-gray-500">Tracking URL</dt>
                <dd className="mt-1 text-sm text-gray-900 font-mono flex items-center">
                  <span>{`${window.location.origin}/r/${topLink.trackingId}`}</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="ml-2 h-6 text-primary-600 hover:text-primary-900 text-xs"
                    onClick={() => copyToClipboard(`${window.location.origin}/r/${topLink.trackingId}`)}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </Button>
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-gray-500">Destination URL</dt>
                <dd className="mt-1 text-sm text-gray-900 font-mono truncate">
                  <span>{topLink.destination}</span>
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-gray-500">Performance Trend (Last 9 days)</dt>
                <dd className="mt-1">
                  <div className="h-16 flex items-end space-x-1">
                    {topLink.dailyClicks.map((value, index) => {
                      const maxValue = Math.max(...topLink.dailyClicks);
                      const height = maxValue > 0 ? (value / maxValue * 100) : 0;
                      return (
                        <div 
                          key={index} 
                          className="w-8 bg-primary-200 rounded-t" 
                          style={{ height: `${height}%` }}
                        ></div>
                      );
                    })}
                  </div>
                </dd>
              </div>
            </dl>
          </div>
          <div className="border-t border-gray-200 px-4 py-3 sm:px-6 bg-gray-50">
            <div className="text-sm">
              <Button 
                variant="link" 
                className="font-medium text-primary-600 hover:text-primary-500 p-0"
                onClick={() => viewLinkDetails(topLink)}
              >
                View detailed analytics
                <span aria-hidden="true">&rarr;</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
      
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Skeleton className="h-12 w-12 rounded-md" />
                <div className="ml-5 w-full">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-6 w-16" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <div className="mt-8">
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
      
      <div className="mt-8">
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    </div>
  );
}
