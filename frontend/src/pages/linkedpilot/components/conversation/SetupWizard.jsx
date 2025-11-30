import React from 'react';
import { motion } from 'framer-motion';
import { Check, Lock, Loader2, Linkedin, Globe, Sparkles, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const SetupWizard = ({ 
  currentStep, 
  completedSteps, 
  onStepClick,
  linkedinConnected,
  brandDiscovered,
  campaignsGenerated,
  campaignsApproved,
}) => {
  const steps = [
    {
      id: 'linkedin',
      title: 'Connect LinkedIn',
      description: 'Link your LinkedIn account to get started',
      icon: Linkedin,
      status: linkedinConnected ? 'completed' : currentStep === 'linkedin' ? 'active' : 'locked',
    },
    {
      id: 'brand',
      title: 'Discover Brand',
      description: 'Provide your website URL for brand analysis',
      icon: Globe,
      status: brandDiscovered ? 'completed' : currentStep === 'brand' ? 'active' : linkedinConnected ? 'pending' : 'locked',
    },
    {
      id: 'campaigns',
      title: 'Generate Campaigns',
      description: 'AI will create 3 campaign concepts for you',
      icon: Sparkles,
      status: campaignsGenerated ? 'completed' : currentStep === 'campaigns' ? 'active' : brandDiscovered ? 'pending' : 'locked',
    },
    {
      id: 'approve',
      title: 'Approve Campaign',
      description: 'Review and approve your preferred campaign',
      icon: CheckCircle2,
      status: campaignsApproved ? 'completed' : currentStep === 'approve' ? 'active' : campaignsGenerated ? 'pending' : 'locked',
    },
  ];

  const getStepIcon = (step) => {
    const Icon = step.icon;
    if (step.status === 'completed') {
      return <Check className="h-5 w-5 text-white" />;
    }
    if (step.status === 'active') {
      return <Loader2 className="h-5 w-5 text-white animate-spin" />;
    }
    if (step.status === 'locked') {
      return <Lock className="h-5 w-5 text-white/40" />;
    }
    return <Icon className="h-5 w-5 text-white/70" />;
  };

  const getStepStyles = (step) => {
    if (step.status === 'completed') {
      return {
        background: 'rgba(34, 197, 94, 0.15)',
        borderColor: 'rgba(34, 197, 94, 0.3)',
        color: 'white',
      };
    }
    if (step.status === 'active') {
      return {
        background: 'rgba(59, 130, 246, 0.15)',
        borderColor: 'rgba(59, 130, 246, 0.5)',
        color: 'white',
        boxShadow: '0 0 20px rgba(59, 130, 246, 0.3)',
      };
    }
    if (step.status === 'locked') {
      return {
        background: 'rgba(255, 255, 255, 0.05)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        color: 'rgba(255, 255, 255, 0.4)',
      };
    }
    return {
      background: 'rgba(255, 255, 255, 0.08)',
      borderColor: 'rgba(255, 255, 255, 0.15)',
      color: 'rgba(255, 255, 255, 0.7)',
    };
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6">
      <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-white mb-2">Setup Your Account</h2>
          <p className="text-sm text-white/60">Complete each step to unlock the full experience</p>
        </div>

        <div className="space-y-4">
          {steps.map((step, index) => {
            const stepStyles = getStepStyles(step);
            const isClickable = step.status === 'active' || step.status === 'pending';
            const isCompleted = step.status === 'completed';

            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={cn(
                  'relative flex items-start gap-4 p-4 rounded-xl border transition-all',
                  isClickable && 'cursor-pointer hover:scale-[1.02]',
                  !isClickable && 'cursor-not-allowed'
                )}
                style={stepStyles}
                onClick={() => isClickable && onStepClick && onStepClick(step.id)}
              >
                {/* Step Number & Icon */}
                <div className="flex-shrink-0">
                  <div
                    className={cn(
                      'h-12 w-12 rounded-xl flex items-center justify-center border-2 transition-all',
                      isCompleted && 'bg-green-500/20 border-green-500/40',
                      step.status === 'active' && 'bg-blue-500/20 border-blue-500/40',
                      step.status === 'locked' && 'bg-white/5 border-white/10',
                      step.status === 'pending' && 'bg-white/10 border-white/20'
                    )}
                  >
                    {getStepIcon(step)}
                  </div>
                </div>

                {/* Step Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className={cn(
                      'text-base font-semibold',
                      step.status === 'locked' && 'text-white/40',
                      step.status === 'pending' && 'text-white/70',
                      (step.status === 'active' || step.status === 'completed') && 'text-white'
                    )}>
                      {step.title}
                    </h3>
                    {isCompleted && (
                      <span className="text-xs text-green-400 font-medium">Completed</span>
                    )}
                    {step.status === 'active' && (
                      <span className="text-xs text-blue-400 font-medium">In Progress</span>
                    )}
                    {step.status === 'pending' && (
                      <span className="text-xs text-white/50 font-medium">Ready</span>
                    )}
                    {step.status === 'locked' && (
                      <span className="text-xs text-white/30 font-medium">Locked</span>
                    )}
                  </div>
                  <p className={cn(
                    'text-sm',
                    step.status === 'locked' && 'text-white/30',
                    step.status === 'pending' && 'text-white/50',
                    (step.status === 'active' || step.status === 'completed') && 'text-white/60'
                  )}>
                    {step.description}
                  </p>
                </div>

                {/* Progress Connector */}
                {index < steps.length - 1 && (
                  <div className="absolute left-6 top-16 w-0.5 h-12">
                    <motion.div
                      className={cn(
                        'w-full transition-all',
                        isCompleted ? 'bg-green-500/40' : 'bg-white/10'
                      )}
                      initial={{ height: 0 }}
                      animate={{ height: isCompleted ? '100%' : '0%' }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Progress Bar */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-white/50">Overall Progress</span>
            <span className="text-xs text-white/70 font-medium">
              {completedSteps.length} of {steps.length} steps completed
            </span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(completedSteps.length / steps.length) * 100}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetupWizard;

