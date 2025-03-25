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
      className="bg-primary-600 text-white hover:bg-primary-700 flex items-center gap-2"
    >
      <FileUp className="h-4 w-4" />
      <span>Bulk Convert</span>
    </Button>
  );
}