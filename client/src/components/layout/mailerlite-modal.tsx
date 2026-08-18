import { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface MailerLiteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MailerLiteModal({ open, onOpenChange }: MailerLiteModalProps) {
  useEffect(() => {
    // Ensure MailerLite is initialized
    if (open && window.ml_account) {
      window.ml_account('webforms', '5663017', 'PfRU7v', 'show');
    }
  }, [open]);

  // Initialize MailerLite embedded form when the modal opens
  useEffect(() => {
    if (open && window.ml) {
      // Make sure the embedded form is loaded
      setTimeout(() => {
        if (window.ml_webform_success_24600160) {
          window.ml_webform_success_24600160 = 0;
        }

        const mlInputs = document.querySelectorAll('.ml-form-embedSubmit button');
        if (mlInputs.length > 0) {
          // Reset any previous form state
          const form = document.querySelector('.ml-block-form') as HTMLFormElement;
          if (form) form.reset();

          // Re-show the form if it was previously hidden with success message
          const formBody = document.querySelector('.ml-form-embedBody');
          const successBody = document.querySelector('.ml-form-successBody');

          if (formBody && successBody) {
            formBody.setAttribute('style', 'display: block');
            successBody.setAttribute('style', 'display: none');
          }
        }
      }, 100);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] p-4 bg-white onboarding-subscribe-form">
        <DialogHeader className="pb-0">
          <DialogTitle className="sr-only">
            Join the Serving Network
          </DialogTitle>
        </DialogHeader>
        <div className="mailerlite-form">
          <div className="ml-embedded" data-form="PfRU7v"></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Add TypeScript global declaration for ML script
declare global {
  interface Window {
    ml: any;
    ml_account?: any;
    ml_webform_success_24600160?: number;
  }
}

export default MailerLiteModal;