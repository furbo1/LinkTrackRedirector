import React, { useContext } from "react";
import { AppContext, ActiveView } from "@/App";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Link2, Settings } from "lucide-react";

interface NavItemProps {
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
}

function NavItem({ label, icon, isActive, onClick }: NavItemProps) {
  return (
    <Button
      variant={isActive ? "secondary" : "ghost"}
      className={`w-full justify-start ${isActive ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
      onClick={onClick}
    >
      {icon}
      <span className="ml-3">{label}</span>
    </Button>
  );
}

export default function Sidebar() {
  const { currentView, setCurrentView } = useContext(AppContext);

  const handleNavChange = (view: ActiveView) => {
    setCurrentView(view);
  };

  return (
    <div className="hidden md:flex md:flex-shrink-0">
      <div className="flex flex-col w-64">
        <div className="flex-1 flex flex-col min-h-0 border-r border-gray-200 bg-white">
          <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
            <div className="flex-1 px-3 bg-white space-y-1">
              <NavItem
                label="Dashboard"
                icon={<LayoutDashboard className="h-5 w-5" />}
                isActive={currentView === 'dashboard'}
                onClick={() => handleNavChange('dashboard')}
              />
              <NavItem
                label="My Links"
                icon={<Link2 className="h-5 w-5" />}
                isActive={currentView === 'links' || currentView === 'linkDetails'}
                onClick={() => handleNavChange('links')}
              />
              <NavItem
                label="Settings"
                icon={<Settings className="h-5 w-5" />}
                isActive={currentView === 'settings'}
                onClick={() => handleNavChange('settings')}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
