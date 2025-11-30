import React from 'react';
import { motion } from 'framer-motion';

const TypingIndicator = () => (
  <motion.div
    className="flex items-center gap-1 px-3 py-2 rounded-xl max-w-[30%] bg-white/10 self-start"
    initial={{ opacity: 0 }}
    animate={{ opacity: [0, 1, 0.6, 1] }}
    transition={{ repeat: Infinity, duration: 1.2 }}
  >
    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
    <span className="w-2 h-2 rounded-full bg-white animate-pulse" style={{ animationDelay: '200ms' }} />
    <span className="w-2 h-2 rounded-full bg-white animate-pulse" style={{ animationDelay: '400ms' }} />
  </motion.div>
);

export default TypingIndicator;



