import React, { useState } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import Home from "@/pages/home";
import NotFound from "@/pages/not-found";
import { LinkWithAnalytics } from "@shared/schema";
import DirectLinkModal from "@/components/DirectLinkModal";
import DashboardDirectButton from "@/components/DashboardDirectButton";
import NewLinkModal from "@/components/NewLinkModal";
import BulkLinkModal from "@/components/BulkLinkModal";

export type ActiveView = "dashboard" | "links" | "linkDetails" | "settings";

export type AppContextType = {
  currentView: ActiveView;
  setCurrentView: (view: ActiveView) => void;
  selectedLink: LinkWithAnalytics | null;
  setSelectedLink: (link: LinkWithAnalytics | null) => void;
  isNavOpen: boolean;
  setIsNavOpen: (isOpen: boolean) => void;
  showNewLinkModal: boolean;
  setShowNewLinkModal: (show: boolean) => void;
  showBulkLinkModal: boolean;
  setShowBulkLinkModal: (show: boolean) => void;
};

export const createInitialContext = (): AppContextType => ({
  currentView: "dashboard",
  setCurrentView: () => {},
  selectedLink: null,
  setSelectedLink: () => {},
  isNavOpen: false,
  setIsNavOpen: () => {},
  showNewLinkModal: false,
  setShowNewLinkModal: () => {},
  showBulkLinkModal: false,
  setShowBulkLinkModal: () => {},
});

// This is a global state that we'll pass down to components
export const AppContext = React.createContext<AppContextType>(createInitialContext());

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [location] = useLocation();
  const [currentView, setCurrentView] = useState<ActiveView>("dashboard");
  const [selectedLink, setSelectedLink] = useState<LinkWithAnalytics | null>(null);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [showNewLinkModal, setShowNewLinkModal] = useState(false);
  const [showBulkLinkModal, setShowBulkLinkModal] = useState(false);
  
  // Initialize the modal closed
  const openNewLinkModal = () => {
    setShowNewLinkModal(true);
  };
  
  const contextValue: AppContextType = {
    currentView,
    setCurrentView,
    selectedLink,
    setSelectedLink,
    isNavOpen,
    setIsNavOpen,
    showNewLinkModal,
    setShowNewLinkModal,
    showBulkLinkModal,
    setShowBulkLinkModal,
  };

  return (
    <QueryClientProvider client={queryClient}>
      <AppContext.Provider value={contextValue}>
        <div className="min-h-screen flex flex-col">
          <Router />
          <Toaster />
          <DirectLinkModal />
          <DashboardDirectButton />
          <NewLinkModal />
          <BulkLinkModal />
        </div>
      </AppContext.Provider>
    </QueryClientProvider>
  );
}

export default App;
