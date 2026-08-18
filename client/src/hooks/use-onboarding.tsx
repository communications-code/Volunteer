import { 
  createContext, 
  ReactNode, 
  useContext, 
  useState, 
  useEffect 
} from "react";
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride';

// Define the state interface for our onboarding context
interface OnboardingState {
  isOnboardingActive: boolean;
  startOnboarding: () => void;
  skipOnboarding: () => void;
  markStepComplete: (stepName: string) => void;
  hasCompletedStep: (stepName: string) => boolean;
  currentTour: string;
  setCurrentTour: (tourName: string) => void;
}

// Create the context with a default value
const OnboardingContext = createContext<OnboardingState | undefined>(undefined);

// Local storage keys
const ONBOARDING_COMPLETED_KEY = 'vfw-onboarding-completed';
const ONBOARDING_STEPS_COMPLETED_KEY = 'vfw-onboarding-steps-completed';

// Tour steps for different areas of the application
export const homeTourSteps: Step[] = [
  {
    target: '.onboarding-hero',
    content: 'Welcome to the VFW Post 7570 Serving Network. This platform connects community needs with willing volunteers.',
    disableBeacon: true,
    placement: 'bottom',
  },
  {
    target: '.onboarding-needs-tabs',
    content: 'Browse different categories of needs using these tabs. You can see highlighted needs, or filter by category.',
    placement: 'bottom',
  },
  {
    target: '.onboarding-need-card',
    content: 'Each card represents a community need. Click on any card to see more details and learn how you can help.',
    placement: 'right',
  },
  {
    target: '.onboarding-share-button',
    content: 'You can share any need with others using this share button. It provides a direct link to the specific need.',
    placement: 'left',
  },
  {
    target: '.onboarding-pledge-button',
    content: 'Click "Pledge to Help" when you want to commit to fulfilling a need in our community.',
    placement: 'top',
  },
  {
    target: '.onboarding-subscribe',
    content: 'Subscribe to our mailing list to stay updated about new opportunities to serve.',
    placement: 'top',
  },
  {
    target: '.onboarding-subscribe-form',
    content: 'Fill out this form to join our serving network and receive notifications about new needs.',
    placement: 'right',
  },
];

export const needDetailTourSteps: Step[] = [
  {
    target: '.onboarding-need-detail',
    content: 'Here you can see all the details about this specific need, including description, timeline, and other important information.',
    disableBeacon: true,
  },
  {
    target: '.onboarding-need-detail-share',
    content: 'Share this need with others via email, social media, or by copying the direct link. Help spread the word and get more support!',
    placement: 'bottom',
  },
  {
    target: '.onboarding-detail-pledge-button',
    content: 'Click here to pledge your help for this need. You\'ll be asked to provide your contact information so the organization can coordinate with you.',
    placement: 'top',
  },
];

export const adminTourSteps: Step[] = [
  {
    target: '.onboarding-admin-dashboard',
    content: 'Welcome to the admin dashboard where you can manage all community needs and user accounts.',
    disableBeacon: true,
  },
  {
    target: '.onboarding-admin-create',
    content: 'Create new needs for the community here. You can save as drafts or publish immediately.',
    placement: 'bottom',
  },
  {
    target: '.onboarding-admin-table',
    content: 'View and manage all needs. You can edit details, change status, duplicate, or delete needs as needed.',
    placement: 'top',
  },
  {
    target: '.onboarding-admin-highlight',
    content: 'Star important needs to highlight them on the homepage. Highlighted needs appear at the top of the main page for greater visibility.',
    placement: 'left',
  },
  {
    target: '.dropdown-menu-content',
    content: 'Use the dropdown menu to access additional actions for each need, including editing, status changes, and duplication.',
    placement: 'right',
  },
];

// Map of tour names to their respective steps
export const tourStepsMap = {
  home: homeTourSteps,
  needDetail: needDetailTourSteps,
  admin: adminTourSteps,
};

export const OnboardingProvider = ({ children }: { children: ReactNode }) => {
  const [isOnboardingActive, setIsOnboardingActive] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<string[]>(() => {
    const savedSteps = localStorage.getItem(ONBOARDING_STEPS_COMPLETED_KEY);
    return savedSteps ? JSON.parse(savedSteps) : [];
  });
  const [currentTour, setCurrentTour] = useState<string>('home');

  // Check if the user has completed the onboarding
  useEffect(() => {
    const hasCompletedOnboarding = localStorage.getItem(ONBOARDING_COMPLETED_KEY) === 'true';
    if (!hasCompletedOnboarding) {
      // Don't automatically start - we'll let components trigger this
      // setIsOnboardingActive(true);
    }
  }, []);

  // Save completed steps to localStorage
  useEffect(() => {
    localStorage.setItem(ONBOARDING_STEPS_COMPLETED_KEY, JSON.stringify(completedSteps));
  }, [completedSteps]);

  const startOnboarding = () => {
    setIsOnboardingActive(true);
  };

  const skipOnboarding = () => {
    setIsOnboardingActive(false);
    localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
  };

  const markStepComplete = (stepName: string) => {
    if (!completedSteps.includes(stepName)) {
      setCompletedSteps([...completedSteps, stepName]);
    }
  };

  const hasCompletedStep = (stepName: string) => {
    return completedSteps.includes(stepName);
  };

  // Handle Joyride callbacks
  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, type } = data;

    // Check if tour is finished or skipped
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      // Tour was completed or skipped
      setIsOnboardingActive(false);
      markStepComplete(currentTour);
    }
  };

  const getTourSteps = () => {
    return tourStepsMap[currentTour as keyof typeof tourStepsMap] || [];
  };

  const value = {
    isOnboardingActive,
    startOnboarding,
    skipOnboarding,
    markStepComplete,
    hasCompletedStep,
    currentTour,
    setCurrentTour,
  };

  return (
    <OnboardingContext.Provider value={value}>
      {children}
      <Joyride
        steps={getTourSteps()}
        run={isOnboardingActive}
        continuous
        showProgress
        showSkipButton
        styles={{
          options: {
            primaryColor: '#d14633',
            zIndex: 10000,
          },
        }}
        callback={handleJoyrideCallback}
        locale={{
          last: 'Finish',
          skip: 'Skip tour',
        }}
      />
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
};
