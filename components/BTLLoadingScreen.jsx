'use client';

import React from 'react';
import { motion } from 'framer-motion';

export default function BTLLoadingScreen() {
  return (
    <div className="fixed inset-0 bg-[#9ea9ab] flex flex-col items-center justify-center z-50">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
        className="w-12 h-12 rounded-full border-4 border-white/30 border-t-[#f97316]"
      />
      <p className="mt-4 text-sm font-semibold text-[#1f2222] tracking-wider">
        Loading BTL Dashboard...
      </p>
    </div>
  );
}
