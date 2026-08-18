import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/hooks/use-onboarding";
import { HelpCircle } from "lucide-react";

interface OnboardingStartButtonProps {
  tourName: string;
  label?: string;
  className?: string;
}

export function OnboardingStartButton({ 
  tourName, 
  label = "Take a tour", 
  className = "" 
}: OnboardingStartButtonProps) {
  const { startOnboarding, setCurrentTour } = useOnboarding();

  const handleStartTour = () => {
    setCurrentTour(tourName);
    startOnboarding();
  };

  return (
    <Button 
      onClick={handleStartTour}
      className={`flex items-center gap-2 ${className}`}
    >
      <HelpCircle className="h-4 w-4" />
      {label}
    </Button>
  );
}