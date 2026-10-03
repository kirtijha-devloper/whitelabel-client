import { Check } from 'lucide-react';

export default function StepIndicator({ currentStep, steps }) {
  return (
    <div className="flex items-center justify-center mb-8">
      {steps.map((step, index) => (
        <div key={step} className="flex items-center">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 
            ${index + 1 <= currentStep 
              ? 'bg-primary border-primary text-white' 
              : 'border-gray-300 text-gray-300'}`}>
            {index + 1 < currentStep ? (
              <Check size={16} />
            ) : (
              <span>{index + 1}</span>
            )}
          </div>
          {index < steps.length - 1 && (
            <div className={`w-20 h-1 mx-2 
              ${index + 1 < currentStep ? 'bg-primary' : 'bg-gray-300'}`} />
          )}
        </div>
      ))}
    </div>
  );
}