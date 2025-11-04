import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';

import { Alert, AlertDescription } from './ui/alert';
import { MessageSquare, Send, CheckCircle, X } from 'lucide-react';
import { errorTrackingService } from '../services/errorTrackingService';
import { errorApiService, type FeedbackReport } from '../services/errorApiService';

interface ErrorFeedbackFormProps {
  errorId?: string;
  onClose?: () => void;
  onSubmit?: (feedback: FeedbackData) => void;
  className?: string;
}

interface FeedbackData {
  errorId?: string;
  description: string;
  severity: 'minor' | 'moderate' | 'severe' | 'critical';
  frequency: 'first-time' | 'occasional' | 'frequent' | 'always';
  impact: 'no-impact' | 'minor-inconvenience' | 'workflow-disruption' | 'blocking';
  expectedBehavior: string;
  stepsToReproduce: string;
  additionalContext: string;
  contactForFollowup: boolean;
  email?: string;
}

const ErrorFeedbackForm: React.FC<ErrorFeedbackFormProps> = ({
  errorId,
  onClose,
  onSubmit,
  className = ''
}) => {
  const [feedback, setFeedback] = useState<FeedbackData>({
    errorId,
    description: '',
    severity: 'moderate',
    frequency: 'first-time',
    impact: 'minor-inconvenience',
    expectedBehavior: '',
    stepsToReproduce: '',
    additionalContext: '',
    contactForFollowup: false,
    email: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Validate required fields
      if (!feedback.description.trim()) {
        throw new Error('Please provide a description of the issue.');
      }

      if (feedback.contactForFollowup && !feedback.email?.trim()) {
        throw new Error('Please provide an email address for follow-up.');
      }

      // Submit feedback to error tracking service
      if (errorId) {
        errorTrackingService.addUserFeedback(errorId, JSON.stringify(feedback));
      }

      // Send to backend
      await submitFeedbackToBackend(feedback);

      // Call parent callback
      onSubmit?.(feedback);

      setIsSubmitted(true);

      // Auto-close after success
      setTimeout(() => {
        onClose?.();
      }, 2000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitFeedbackToBackend = async (feedbackData: FeedbackData) => {
    try {
      const feedbackReport: FeedbackReport = {
        description: feedbackData.description,
        severity: feedbackData.severity,
        frequency: feedbackData.frequency,
        impact: feedbackData.impact,
        expectedBehavior: feedbackData.expectedBehavior,
        actualBehavior: feedbackData.stepsToReproduce,
        stepsToReproduce: feedbackData.stepsToReproduce,
        contactEmail: feedbackData.contactForFollowup ? feedbackData.email : undefined,
        browserInfo: navigator.userAgent,
        errorId: feedbackData.errorId
      };

      const response = await errorApiService.submitFeedback(feedbackReport);
      
      if (!response.success) {
        throw new Error('Failed to submit feedback to server');
      }
      
      return response;
    } catch (err) {
      console.warn('Failed to submit feedback to backend:', err);
      // Don't throw here - we still want to save locally
    }
  };

  const updateFeedback = (field: keyof FeedbackData, value: string | number | boolean) => {
    setFeedback(prev => ({ ...prev, [field]: value }));
  };

  if (isSubmitted) {
    return (
      <Card className={className}>
        <CardContent className="text-center py-8">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Thank you for your feedback!</h3>
          <p className="text-gray-600 mb-4">
            Your report helps us improve the application. We'll investigate this issue.
          </p>
          {feedback.contactForFollowup && (
            <p className="text-sm text-gray-500">
              We'll contact you at {feedback.email} if we need more information.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            <CardTitle>Report Issue</CardTitle>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <CardDescription>
          Help us understand what went wrong so we can fix it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Error Description */}
          <div className="space-y-2">
            <Label htmlFor="description">What happened? *</Label>
            <Textarea
              id="description"
              placeholder="Describe the issue you encountered..."
              value={feedback.description}
              onChange={(e) => updateFeedback('description', e.target.value)}
              className="min-h-[80px]"
              required
            />
          </div>

          {/* Severity */}
          <div className="space-y-2">
            <Label htmlFor="severity">How severe is this issue?</Label>
            <select
              id="severity"
              value={feedback.severity}
              onChange={(e) => updateFeedback('severity', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="minor">Minor - Small inconvenience</option>
              <option value="moderate">Moderate - Noticeable issue</option>
              <option value="severe">Severe - Major problem</option>
              <option value="critical">Critical - App unusable</option>
            </select>
          </div>

          {/* Frequency */}
          <div className="space-y-2">
            <Label htmlFor="frequency">How often does this happen?</Label>
            <select
              id="frequency"
              value={feedback.frequency}
              onChange={(e) => updateFeedback('frequency', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="first-time">First time seeing this</option>
              <option value="occasional">Occasionally</option>
              <option value="frequent">Frequently</option>
              <option value="always">Every time I try</option>
            </select>
          </div>

          {/* Expected Behavior */}
          <div className="space-y-2">
            <Label htmlFor="expected">What did you expect to happen?</Label>
            <Textarea
              id="expected"
              placeholder="Describe what you expected to happen instead..."
              value={feedback.expectedBehavior}
              onChange={(e) => updateFeedback('expectedBehavior', e.target.value)}
              className="min-h-[60px]"
            />
          </div>

          {/* Steps to Reproduce */}
          <div className="space-y-2">
            <Label htmlFor="steps">Steps to reproduce (optional)</Label>
            <Textarea
              id="steps"
              placeholder="1. Go to...&#10;2. Click on...&#10;3. See error"
              value={feedback.stepsToReproduce}
              onChange={(e) => updateFeedback('stepsToReproduce', e.target.value)}
              className="min-h-[80px]"
            />
          </div>

          {/* Additional Context */}
          <div className="space-y-2">
            <Label htmlFor="context">Additional context (optional)</Label>
            <Textarea
              id="context"
              placeholder="Any other details that might help us understand the issue..."
              value={feedback.additionalContext}
              onChange={(e) => updateFeedback('additionalContext', e.target.value)}
              className="min-h-[60px]"
            />
          </div>

          {/* Contact for Follow-up */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="contact"
                checked={feedback.contactForFollowup}
                onChange={(e) => updateFeedback('contactForFollowup', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <Label htmlFor="contact">Contact me for follow-up questions</Label>
            </div>
            
            {feedback.contactForFollowup && (
              <div className="ml-6 space-y-2">
                <Label htmlFor="email">Email address *</Label>
                <input
                  type="email"
                  id="email"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="your.email@example.com"
                  value={feedback.email}
                  onChange={(e) => updateFeedback('email', e.target.value)}
                  required={feedback.contactForFollowup}
                />
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Submit Button */}
          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={isSubmitting || !feedback.description.trim()}
              className="flex-1"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Submit Feedback
                </>
              )}
            </Button>
            {onClose && (
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default ErrorFeedbackForm;
export type { FeedbackData };