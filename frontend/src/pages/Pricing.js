import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Zap, Check, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Pricing = () => {
  const navigate = useNavigate();

  const plans = [
    {
      name: 'Starter',
      price: '$19',
      period: '/month',
      description: 'Perfect for individuals and small creators',
      features: [
        'Up to 10 social accounts',
        '50 scheduled posts per month',
        'Basic analytics',
        'Email support',
        '1 team member'
      ],
      cta: 'Start Free Trial',
      highlighted: false
    },
    {
      name: 'Professional',
      price: '$49',
      period: '/month',
      description: 'For growing businesses and teams',
      features: [
        'Up to 25 social accounts',
        'Unlimited scheduled posts',
        'Advanced analytics & reporting',
        'Priority support',
        '5 team members',
        'AI content suggestions',
        'Custom branding'
      ],
      cta: 'Start Free Trial',
      highlighted: true
    },
    {
      name: 'Enterprise',
      price: '$149',
      period: '/month',
      description: 'For large organizations',
      features: [
        'Unlimited social accounts',
        'Unlimited scheduled posts',
        'Custom analytics & reporting',
        'Dedicated support manager',
        'Unlimited team members',
        'Advanced AI features',
        'White-label solution',
        'Custom integrations',
        'SLA guarantee'
      ],
      cta: 'Contact Sales',
      highlighted: false
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-gray-950/70 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center space-x-2">
              <Zap className="w-8 h-8 text-cyan-500" />
              <span className="text-2xl font-bold text-white">SocialFlow</span>
            </Link>
            <Button
              data-testid="pricing-back-btn"
              variant="ghost"
              onClick={() => navigate('/')}
              className="text-gray-300 hover:text-white hover:bg-gray-800"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </div>
        </div>
      </nav>

      {/* Pricing Content */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-5xl lg:text-6xl font-bold text-white mb-4">
              Simple, Transparent
              <span className="bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent"> Pricing</span>
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Choose the perfect plan for your needs. All plans include a 14-day free trial.
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((plan, index) => (
              <div
                key={index}
                data-testid={`pricing-plan-${index}`}
                className={`relative bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 border ${
                  plan.highlighted
                    ? 'border-cyan-500 shadow-2xl shadow-cyan-500/20 transform scale-105'
                    : 'border-gray-700'
                } transition-all hover:-translate-y-2`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-cyan-500 to-teal-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                  <p className="text-gray-400 text-sm">{plan.description}</p>
                </div>

                <div className="mb-6">
                  <span className="text-5xl font-bold text-white">{plan.price}</span>
                  <span className="text-gray-400">{plan.period}</span>
                </div>

                <Button
                  data-testid={`pricing-cta-btn-${index}`}
                  onClick={() => navigate('/signup')}
                  className={`w-full mb-8 py-6 font-semibold ${
                    plan.highlighted
                      ? 'bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white shadow-lg shadow-cyan-500/30'
                      : 'bg-gray-800 hover:bg-gray-700 text-white border border-gray-700'
                  }`}
                >
                  {plan.cta}
                </Button>

                <ul className="space-y-4">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-cyan-500/20 flex items-center justify-center mt-0.5">
                        <Check className="w-3 h-3 text-cyan-400" />
                      </div>
                      <span className="text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* FAQ Section */}
          <div className="mt-20 text-center">
            <h2 className="text-3xl font-bold text-white mb-4">Have questions?</h2>
            <p className="text-gray-400 mb-6">Contact our sales team for custom enterprise solutions</p>
            <Button
              data-testid="pricing-contact-btn"
              variant="outline"
              className="border-2 border-gray-700 text-white hover:bg-gray-800 px-8 py-6"
            >
              Contact Sales
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Pricing;