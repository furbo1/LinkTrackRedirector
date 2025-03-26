import { useContext } from "react";
import { AppContext } from "@/App";
import { Button } from "@/components/ui/button";
import { FileUp } from "lucide-react";

export default function BulkLinkButton() {
  const { setShowBulkLinkModal } = useContext(AppContext);

  return (
    <Button 
      onClick={() => setShowBulkLinkModal(true)}
      variant="default"
      size="xl"
      className="bg-gradient-to-r from-blue-500 to-primary-600 text-white hover:from-blue-600 hover:to-primary-700 flex items-center gap-2 font-bold px-8 py-3 text-lg shadow-lg border-2 border-blue-400 rounded-lg transition-all hover:scale-105"
    >
      <FileUp className="h-6 w-6 mr-2" />
      <span>BULK CONVERT</span>
    </Button>
  );
}