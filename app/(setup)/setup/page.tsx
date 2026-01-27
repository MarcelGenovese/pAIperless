"use client"

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import WelcomeScreen from '@/components/setup/WelcomeScreen';
import Step1Paperless from '@/components/setup/Step1Paperless';
import Step2Gemini from '@/components/setup/Step2Gemini';
import Step3DocumentAI from '@/components/setup/Step3DocumentAI';
import Step4GoogleOAuth from '@/components/setup/Step4GoogleOAuth';
import Step5Email from '@/components/setup/Step5Email';
import Step6PaperlessIntegration from '@/components/setup/Step6PaperlessIntegration';
import Step7Advanced from '@/components/setup/Step7Advanced';
import Step8FTP from '@/components/setup/Step8FTP';
import Step9Complete from '@/components/setup/Step9Complete';

export default function SetupPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [setupData, setSetupData] = useState<Record<string, any>>({});
  const router = useRouter();
  const t = useTranslations('setup');

  // Check if setup is already complete
  useEffect(() => {
    fetch('/api/setup/status')
      .then(res => res.json())
      .then(data => {
        if (data.setupComplete) {
          router.push('/dashboard');
        }
      })
      .catch(console.error);
  }, [router]);

  const handleNext = (data: Record<string, any>) => {
    setSetupData(prev => ({ ...prev, ...data }));
    setCurrentStep(prev => prev + 1);
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(0, prev - 1));
  };

  const totalSteps = 9;

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <WelcomeScreen onNext={handleNext} />;
      case 1:
        return <Step1Paperless onNext={handleNext} onBack={handleBack} data={setupData} />;
      case 2:
        return <Step2Gemini onNext={handleNext} onBack={handleBack} data={setupData} />;
      case 3:
        return <Step3DocumentAI onNext={handleNext} onBack={handleBack} data={setupData} />;
      case 4:
        return <Step4GoogleOAuth onNext={handleNext} onBack={handleBack} data={setupData} />;
      case 5:
        return <Step5Email onNext={handleNext} onBack={handleBack} data={setupData} />;
      case 6:
        return <Step6PaperlessIntegration onNext={handleNext} onBack={handleBack} data={setupData} />;
      case 7:
        return <Step7Advanced onNext={handleNext} onBack={handleBack} data={setupData} />;
      case 8:
        return <Step8FTP onNext={handleNext} onBack={handleBack} data={setupData} />;
      case 9:
        return <Step9Complete data={setupData} />;
      default:
        return <WelcomeScreen onNext={handleNext} />;
    }
  };

  return (
    <div className="relative">
      {/* Progress Bar */}
      {currentStep > 0 && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gray-200">
          <div
            className="h-full bg-accent transition-all duration-300"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />
        </div>
      )}

      {/* Step Indicator */}
      {currentStep > 0 && currentStep < totalSteps && (
        <div className="px-6 pt-6 pb-2 border-b">
          <p className="text-sm text-muted-foreground">
            {t('step', { step: currentStep, total: totalSteps - 1 })}
          </p>
        </div>
      )}

      {/* Step Content */}
      <div className="p-6 md:p-8">
        {renderStep()}
      </div>
    </div>
  );
}
