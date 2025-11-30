import React from 'react';
import { motion } from 'framer-motion';
import { Paperclip, Mic, CornerDownLeft } from 'lucide-react';
import { ChatInput } from '@/components/ui/chat-input';
import { Button } from '@/components/ui/button';

/**
 * FloatingChatInput - A reusable floating chat input component
 * 
 * Can be used for:
 * - Post editing conversations
 * - Image editing conversations
 * - General AI chat interactions
 * 
 * @param {Function} onSubmit - Callback when message is submitted (message: string) => void
 * @param {boolean} inputDisabled - Whether input should be disabled
 * @param {string} placeholder - Placeholder text for input
 * @param {string} value - Current input value
 * @param {Function} setValue - Callback to update input value (value: string) => void
 */
export const FloatingChatInput = ({
  onSubmit,
  inputDisabled,
  placeholder,
  value,
  setValue,
  children
}) => {
  const handleSubmit = (e) => {
    e?.preventDefault();
    if (inputDisabled || !value.trim()) {
      return;
    }
    onSubmit(value.trim());
    setValue('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-3xl px-4 md:px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative rounded-2xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden"
      >
        {/* Custom Controls Area */}
        {children && (
          <div className="px-4 pt-3 pb-2 border-b border-border bg-muted/70">
            {children}
          </div>
        )}

        <form
          className="p-1 focus-within:ring-1 focus-within:ring-primary/30 rounded-b-2xl"
          onSubmit={handleSubmit}
        >
          <ChatInput
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || 'Type your message here...'}
            disabled={inputDisabled}
            className="min-h-[60px] resize-none rounded-xl bg-transparent border-0 p-3 shadow-none focus-visible:ring-0 text-foreground placeholder:text-muted-foreground"
          />
          <div className="flex items-center p-3 pt-0">
            <Button
              variant="ghost"
              size="icon"
              type="button"
              className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg"
              title="Attach file"
            >
              <Paperclip className="size-4" />
              <span className="sr-only">Attach file</span>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              type="button"
              className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg"
              title="Use microphone"
            >
              <Mic className="size-4" />
              <span className="sr-only">Use Microphone</span>
            </Button>

            <Button
              type="submit"
              size="sm"
              className="ml-auto gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg px-4"
              disabled={inputDisabled || !value.trim()}
            >
              Send Message
              <CornerDownLeft className="size-3.5" />
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default FloatingChatInput;



