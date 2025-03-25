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
      size="lg"
      className="bg-primary-600 text-white hover:bg-primary-700 flex items-center gap-2 font-semibold px-6 py-2"
    >
      <FileUp className="h-5 w-5 mr-1" />
      <span>Bulk Convert</span>
    </Button>
  );
}