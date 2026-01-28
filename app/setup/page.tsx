"use client"

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
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

  // Load saved config data for current step
  useEffect(() => {
    if (currentStep > 0 && currentStep < 9) {
      fetch(`/api/setup/load-config?step=${currentStep}`)
        .then(res => res.json())
        .then(data => {
          if (!data.error) {
            setSetupData(prev => ({ ...prev, ...data }));
          }
        })
        .catch(console.error);
    }
  }, [currentStep]);

  const handleNext = (data: Record<string, any>) => {
    setSetupData(prev => ({ ...prev, ...data }));
    setCurrentStep(prev => prev + 1);
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(0, prev - 1));
  };

  const totalSteps = 9;

  const getVideoInfo = (step: number) => {
    const videos = {
      0: { url: '/videos/welcome.mp4', summary: 'Welcome to pAIperless setup. This wizard will guide you through the configuration.' },
      1: { url: '/videos/paperless.mp4', summary: 'Connect to your Paperless-NGX instance by providing the URL and API token.' },
      2: { url: '/videos/gemini.mp4', summary: 'Configure Google Gemini AI for intelligent document tagging and analysis.' },
      3: { url: '/videos/documentai.mp4', summary: 'Set up Google Cloud Document AI for OCR processing of your documents.' },
      4: { url: '/videos/oauth.mp4', summary: 'Connect Google Calendar and Tasks for action reminders and task management.' },
      5: { url: '/videos/email.mp4', summary: 'Optional: Configure email notifications for important events.' },
      6: { url: '/videos/integration.mp4', summary: 'Configure Paperless tags and custom fields for AI integration.' },
      7: { url: '/videos/advanced.mp4', summary: 'Fine-tune polling intervals and advanced settings.' },
      8: { url: '/videos/ftp.mp4', summary: 'Optional: Enable FTP server for document uploads.' },
      9: { url: '/videos/complete.mp4', summary: 'Setup complete! Your system is ready to process documents.' },
    };
    return videos[step as keyof typeof videos] || videos[0];
  };

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

  const videoInfo = getVideoInfo(currentStep);

  return (
    <div className={currentStep === 0 ? "w-full max-w-2xl" : "w-full max-w-6xl"}>
      <div className="flex gap-0 h-[calc(100vh-8rem)] max-h-[900px]">
        {/* Left Column - Setup Form */}
        <div className={currentStep === 0 ? "w-full" : "flex-1 lg:w-1/2"}>
          <div className="bg-white shadow-lg h-full flex flex-col">
            {/* Header with Logo - only for steps > 0 */}
            {currentStep > 0 && (
              <div className="bg-white border-b px-6 py-4 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <Image
                    src="/logo_complete.png"
                    alt="pAIperless"
                    width={300}
                    height={75}
                    className="h-16 w-auto"
                    priority
                  />
                  {currentStep < totalSteps && (
                    <span className="text-sm text-gray-500">
                      Step {currentStep} / {totalSteps - 1}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Progress Bar */}
            {currentStep > 0 && (
              <div className="h-1 bg-gray-200 flex-shrink-0">
                <div
                  className="h-full bg-accent transition-all duration-300"
                  style={{ width: `${(currentStep / totalSteps) * 100}%` }}
                />
              </div>
            )}

            {/* Step Content - Scrollable */}
            <div className="p-6 overflow-y-auto flex-1">
              {renderStep()}
            </div>
          </div>
        </div>

        {/* Right Column - Video & Info */}
        {currentStep > 0 && (
          <div className="hidden lg:block lg:w-1/2">
            <div className="h-full flex flex-col bg-gradient-to-br from-gray-50 to-accent/5 shadow-lg">
              {/* Video Player */}
              <div className="aspect-video bg-gray-900 flex items-center justify-center flex-shrink-0">
                <div className="text-white text-center p-4">
                  <svg className="w-16 h-16 mx-auto mb-2 opacity-50" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                  </svg>
                  <p className="text-sm">Tutorial Video</p>
                  <p className="text-xs opacity-75 mt-1">Coming Soon</p>
                </div>
              </div>

              {/* Step Summary - fills remaining space */}
              <div className="flex-1 border-t p-4">
                <h3 className="font-semibold text-gray-900 mb-2">What to do:</h3>
                <p className="text-sm text-gray-600">
                  {videoInfo.summary}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
