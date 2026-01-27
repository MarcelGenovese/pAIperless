"use client"

import { Button } from '@/components/ui/button';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faArrowRight, faEye, faEyeSlash, faCheckCircle, faTimesCircle, faCopy, faKey, faSpinner, faUpload, faFileText, faExternalLinkAlt, faCalendar, faListUl, faEnvelope, faServer, faCog } from '@fortawesome/free-solid-svg-icons';

interface StepProps {
  onNext: (data: Record<string, any>) => void;
  onBack: () => void;
  data: Record<string, any>;
}

export default function StepPlaceholder({ onNext, onBack }: StepProps) {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-primary mb-2">
            Step Coming Soon
          </h2>
          <p className="text-muted-foreground">
            This step is under development
          </p>
        </div>

        <div className="flex justify-between pt-6">
          <Button onClick={onBack} variant="outline">
            <FontAwesomeIcon icon={faArrowLeft} className="mr-2" />
            Back
          </Button>
          <Button onClick={() => onNext({})}>
            Next
            <FontAwesomeIcon icon={faArrowRight} className="ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
