import { Link } from "wouter";
import { useState } from "react";
import { ContactForm } from "./contact-form";
import { Button } from "@/components/ui/button";

const Hero = () => {
  const [contactFormOpen, setContactFormOpen] = useState(false);
  // Function to open popup window with MailerLite form
  const openMailerLitePopup = () => {
    const url = "https://dashboard.mailerlite.com/forms/794766/151120795521778805/share";
    const title = "Join the Serving Network";
    const w = 500;
    const h = 700;
    
    // Calculate position for center of screen
    const left = window.screen.width / 2 - w / 2;
    const top = window.screen.height / 2 - h / 2;
    
    // Open the popup window
    window.open(
      url,
      title,
      `toolbar=no, location=no, directories=no, status=no, menubar=no, scrollbars=yes, resizable=no, copyhistory=no, width=${w}, height=${h}, top=${top}, left=${left}`
    );
    
    return false;
  };
  
  return (
    <div className="bg-gradient-to-b from-white to-[#164C83]/10 py-6 onboarding-hero">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col items-center md:items-start text-center md:text-left mb-6 md:mb-0 max-w-3xl">
            <h1 className="text-2xl font-bold text-[#231F20] sm:text-3xl">
              Serving Network
            </h1>
            <p className="mt-1 text-sm text-gray-600 sm:text-base max-w-md">
              Browse current needs in our community or pledge to help
            </p>
            
            <div className="mt-3 text-sm text-gray-700 sm:text-base">
              <p className="mb-2">
                The Serving Network connects community members with meaningful ways to make a difference. 
                Here you can find current needs, volunteer opportunities, and service projects coordinated by VFW Post 7570.
              </p>
            </div>
            
            <div className="mt-4 flex flex-col sm:flex-row gap-4">
              <Button
                onClick={openMailerLitePopup}
                className="bg-[#164C83] hover:bg-[#164C83]/90 onboarding-subscribe"
              >
                Sign up to join the serving network
              </Button>
              
              <Link href="#needs">
                <Button className="bg-[#991A1E] hover:bg-[#991A1E]/90">
                  View Current Needs
                </Button>
              </Link>
              
              <Button asChild>
                <a 
                  href="https://www.vfwharrisonoh.org/service-project-request/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-[#164C83] hover:bg-[#164C83]/90"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Request a Service Project
                </a>
              </Button>
              
              <Button
                onClick={() => setContactFormOpen(true)}
                className="bg-[#991A1E] hover:bg-[#991A1E]/90"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Contact Us
              </Button>
            </div>
            
            {/* Contact Form Dialog */}
            <ContactForm open={contactFormOpen} onOpenChange={setContactFormOpen} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hero;