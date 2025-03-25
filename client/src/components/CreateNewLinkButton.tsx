import React from 'react';
import { useContext } from 'react';
import { AppContext } from '@/App';
import { Button } from '@/components/ui/button';

export default function CreateNewLinkButton() {
  const { setShowNewLinkModal } = useContext(AppContext);

  return (
    <div className="fixed bottom-10 right-10 z-50">
      <Button
        onClick={() => {
          console.log('Opening modal...');
          setShowNewLinkModal(true);
        }}
        className="h-16 w-16 rounded-full bg-primary-600 hover:bg-primary-700 shadow-lg pulse-effect"
        size="lg"
      >
        <span className="text-3xl text-white font-bold">+</span>
      </Button>
    </div>
  );
}