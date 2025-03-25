import React, { useContext } from "react";
import { AppContext } from "@/App";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function Header() {
  const { isNavOpen, setIsNavOpen, currentView, setCurrentView } = useContext(AppContext);

  return (
    <header className="bg-white shadow-sm">
      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <svg className="h-8 w-8 text-primary-800" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <span className="ml-2 text-xl font-bold text-gray-900">LinkTracker</span>
            </div>
          </div>
          
          <div className="hidden sm:ml-6 sm:flex sm:items-center">
            <div className="ml-3 relative">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="p-0 rounded-full">
                    <span className="sr-only">Open user menu</span>
                    <Avatar className="h-8 w-8 bg-primary-700 text-white">
                      <AvatarFallback>JD</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setCurrentView("settings")}>Settings</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          
          <div className="flex items-center sm:hidden">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsNavOpen(!isNavOpen)}
              aria-controls="mobile-menu" 
              aria-expanded={isNavOpen}
            >
              <span className="sr-only">Open main menu</span>
              {isNavOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isNavOpen && (
        <div className="sm:hidden" id="mobile-menu">
          <div className="pt-2 pb-3 space-y-1">
            <Button 
              variant={currentView === 'dashboard' ? "secondary" : "ghost"} 
              className="w-full justify-start" 
              onClick={() => { 
                setCurrentView('dashboard'); 
                setIsNavOpen(false);
              }}
            >
              Dashboard
            </Button>
            <Button 
              variant={currentView === 'links' ? "secondary" : "ghost"} 
              className="w-full justify-start"
              onClick={() => { 
                setCurrentView('links'); 
                setIsNavOpen(false);
              }}
            >
              My Links
            </Button>
            <Button 
              variant={currentView === 'settings' ? "secondary" : "ghost"} 
              className="w-full justify-start"
              onClick={() => { 
                setCurrentView('settings'); 
                setIsNavOpen(false);
              }}
            >
              Settings
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
