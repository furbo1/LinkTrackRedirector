import { useContext, useEffect } from "react";
import { AppContext } from "@/App";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import Dashboard from "@/components/Dashboard";
import LinksTable from "@/components/LinksTable";
import LinkDetails from "@/components/LinkDetails";
import Settings from "@/components/Settings";
import NewLinkModal from "@/components/NewLinkModal";
import { Button } from "@/components/ui/button";

export default function Home() {
  const { currentView, setShowNewLinkModal } = useContext(AppContext);

  const renderContent = () => {
    switch (currentView) {
      case "dashboard":
        return <Dashboard />;
      case "links":
        return <LinksTable />;
      case "linkDetails":
        return <LinkDetails />;
      case "settings":
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <>
      <Header />
      <main className="flex-1 flex">
        <Sidebar />
        <div className="flex-1 overflow-auto focus:outline-none">
          <div className="py-6">
            {renderContent()}
          </div>
        </div>
      </main>
      <NewLinkModal />
      
      {/* Floating Action Button */}
      <div className="fixed bottom-8 right-8 z-50">
        <Button
          onClick={() => setShowNewLinkModal(true)}
          className="h-16 w-16 rounded-full bg-primary-600 hover:bg-primary-700 shadow-lg pulse-effect"
        >
          <span className="text-3xl text-white font-bold">+</span>
        </Button>
      </div>
    </>
  );
}
