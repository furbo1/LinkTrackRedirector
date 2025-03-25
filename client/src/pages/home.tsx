import { useContext } from "react";
import { AppContext } from "@/App";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import Dashboard from "@/components/Dashboard";
import LinksTable from "@/components/LinksTable";
import LinkDetails from "@/components/LinkDetails";
import Settings from "@/components/Settings";
import NewLinkModal from "@/components/NewLinkModal";

export default function Home() {
  const { currentView } = useContext(AppContext);

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
    </>
  );
}
