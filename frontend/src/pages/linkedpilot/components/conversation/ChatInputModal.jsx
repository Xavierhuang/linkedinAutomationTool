import React, { useState, useEffect, useRef } from 'react';
import { X, SendHorizontal, Mic } from 'lucide-react';
import { useThemeTokens } from '@/hooks/useThemeTokens';

const ChatInputModal = ({ isOpen, onClose, onSubmit, placeholder, disabled }) => {
  const tokens = useThemeTokens();
  const [draft, setDraft] = useState('');
  const textareaRef = useRef(null);

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setDraft('');
    }
  }, [isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!draft.trim() || disabled) {
      return;
    }
    onSubmit(draft.trim());
    setDraft('');
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit(e);
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={onClose}
        style={{
          animation: 'fadeIn 0.2s ease-out',
        }}
      />

      {/* Modal */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 lg:inset-x-auto lg:bottom-auto lg:left-1/2 lg:top-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2"
        style={{
          animation: 'slideUp 0.3s ease-out',
        }}
      >
        <div
          className="w-full lg:w-[600px] max-h-[80vh] lg:max-h-[500px] rounded-t-3xl lg:rounded-3xl overflow-hidden flex flex-col"
          style={{
            backgroundColor: tokens.colors.background.layer2,
            border: `1px solid ${tokens.colors.border.default}`,
            borderRadius: tokens.radius.xl,
            boxShadow: tokens.shadow.floating,
          }}
        >
          {/* Header */}
          <div 
            className="px-6 py-4 flex items-center justify-between"
            style={{ borderBottom: `1px solid ${tokens.colors.border.default}` }}
          >
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: tokens.colors.text.primary, fontFamily: tokens.typography.fontFamily.sans }}>
              Type your message
            </h3>
            <button
              type="button"
              onClick={onClose}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: tokens.radius.full,
                backgroundColor: tokens.colors.background.input,
                border: `1px solid ${tokens.colors.border.default}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: tokens.colors.text.secondary
              }}
              className="hover:opacity-70 transition-opacity"
              onMouseEnter={(e) => e.currentTarget.style.color = tokens.colors.text.primary}
              onMouseLeave={(e) => e.currentTarget.style.color = tokens.colors.text.secondary}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto p-6">
              <textarea
                ref={textareaRef}
                className="w-full bg-transparent resize-none outline-none text-base leading-relaxed"
                rows={6}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder || 'Type your message...'}
                disabled={disabled}
                style={{
                  minHeight: '120px',
                  color: tokens.colors.text.primary,
                  fontFamily: tokens.typography.fontFamily.sans
                }}
              />
            </div>

            {/* Footer */}
            <div 
              className="px-6 py-4 flex items-center justify-between gap-3"
              style={{ borderTop: `1px solid ${tokens.colors.border.default}` }}
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: tokens.radius.full,
                    border: `1px solid ${tokens.colors.border.default}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: tokens.colors.text.tertiary,
                    backgroundColor: tokens.colors.background.input
                  }}
                  className="hover:opacity-70 transition-opacity disabled:opacity-40"
                  disabled
                  title="Voice capture coming soon"
                >
                  <Mic className="h-4 w-4" />
                </button>
                <p style={{ fontSize: '12px', color: tokens.colors.text.tertiary }} className="hidden sm:block">
                  Press <kbd style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: tokens.colors.background.input, color: tokens.colors.text.secondary, fontSize: '12px' }}>Ctrl+Enter</kbd> or <kbd style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: tokens.colors.background.input, color: tokens.colors.text.secondary, fontSize: '12px' }}>Cmd+Enter</kbd> to send
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '8px 16px',
                    borderRadius: tokens.radius.full,
                    border: `1px solid ${tokens.colors.border.default}`,
                    fontSize: '14px',
                    color: tokens.colors.text.secondary,
                    backgroundColor: tokens.colors.background.input,
                    fontFamily: tokens.typography.fontFamily.sans
                  }}
                  className="hover:opacity-80 transition-opacity"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 24px',
                    borderRadius: tokens.radius.full,
                    backgroundColor: tokens.colors.accent.lime,
                    color: tokens.colors.text.inverse,
                    fontSize: '14px',
                    fontWeight: 500,
                    fontFamily: tokens.typography.fontFamily.sans,
                    boxShadow: tokens.shadow.subtle
                  }}
                  className="hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                  disabled={disabled || draft.trim().length === 0}
                  onMouseEnter={(e) => !disabled && draft.trim().length > 0 && (e.currentTarget.style.backgroundColor = tokens.colors.accent.limeHover)}
                  onMouseLeave={(e) => !disabled && draft.trim().length > 0 && (e.currentTarget.style.backgroundColor = tokens.colors.accent.lime)}
                >
                  <span>Send</span>
                  <SendHorizontal className="h-4 w-4" />
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }

        @media (min-width: 1024px) {
          @keyframes slideUp {
            from {
              transform: translate(-50%, -40%);
              opacity: 0;
            }
            to {
              transform: translate(-50%, -50%);
              opacity: 1;
            }
          }
        }
      `}</style>
    </>
  );
};

export default ChatInputModal;





