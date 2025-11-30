import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Menu } from 'lucide-react';
import designTokens from '@/designTokens';
import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';

const ChatContainer = ({
  messages,
  onSubmit,
  onAction,
  isTyping,
  inputDisabled,
  placeholder,
  showMobileMenu,
  onMobileMenuClick,
}) => {
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden p-[2px]">
      {/* Animated Outer Border */}
      <motion.div
        className="absolute inset-0 rounded-2xl border-2 border-white/20"
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
      />

      {/* Inner Card */}
      <div className="relative flex flex-col w-full h-full rounded-xl border border-white/10 overflow-hidden bg-black/90 backdrop-blur-xl">
        {/* Inner Animated Background */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-gray-800 via-black to-gray-900"
          animate={{ backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          style={{ backgroundSize: '200% 200%' }}
        />

        {/* Floating Particles */}
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-white/10"
            animate={{
              y: ['0%', '-140%'],
              x: [Math.random() * 200 - 100, Math.random() * 200 - 100],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 5 + Math.random() * 3,
              repeat: Infinity,
              delay: i * 0.5,
              ease: 'easeInOut',
            }}
            style={{ left: `${Math.random() * 100}%`, bottom: '-10%' }}
          />
        ))}

        {/* Header */}
        <header className="px-4 py-3 border-b border-white/10 relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">AI Assistant</h2>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {showMobileMenu && (
                <button
                  type="button"
                  onClick={onMobileMenuClick}
                  className="lg:hidden h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition-all"
                  aria-label="Open navigation menu"
                >
                  <Menu className="h-4 w-4" />
                </button>
              )}
              <div className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs text-green-400 font-medium">Online</span>
              </div>
            </div>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 px-4 py-3 overflow-y-auto space-y-3 text-sm flex flex-col relative z-10 pb-32" ref={listRef}>
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onAction={onAction}
              disabled={inputDisabled}
            />
          ))}
          {isTyping ? (
            <div className="flex items-start">
              <TypingIndicator />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

// Re-export FloatingChatInput from separate file for reusability
export { FloatingChatInput } from './FloatingChatInput';

export default ChatContainer;

