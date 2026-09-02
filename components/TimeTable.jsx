'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Check, 
  Trash2, 
  Clock, 
  Plus, 
  Sparkles, 
  Tag 
} from 'lucide-react';

export default function TimeTable({ selectedDate = new Date().toISOString().split('T')[0] }) {
  const [items, setItems] = useState([
    { id: '1', startTime: '05:00', endTime: '06:30', task: 'Wake up & Morning Routine + Workout', completed: true, category: 'Health' },
    { id: '2', startTime: '07:00', endTime: '08:30', task: 'Market Prep & Order Flow Analysis', completed: true, category: 'Trading' },
    { id: '3', startTime: '09:15', endTime: '11:30', task: 'Live Trading Session (London/NY overlap)', completed: false, category: 'Trading' },
    { id: '4', startTime: '12:00', endTime: '01:00', task: 'Healthy Lunch & Rest', completed: false, category: 'Health' },
    { id: '5', startTime: '02:00', endTime: '04:00', task: 'Backtesting & Journaling Trades', completed: false, category: 'Study' },
    { id: '6', startTime: '09:30', endTime: '10:30', task: 'Read 20 pages & Plan Tomorrow', completed: false, category: 'Routine' }
  ]);

  const [startTime, setStartTime] = useState('06:00');
  const [endTime, setEndTime] = useState('07:00');
  const [taskText, setTaskText] = useState('');
  const [category, setCategory] = useState('Routine');
  const [filter, setFilter] = useState('all');

  const storageKey = `btl_timetable_${selectedDate}`;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setItems(JSON.parse(saved));
      }
    } catch (e) {
      console.error(e);
    }
  }, [storageKey]);

  const saveItems = (newItems) => {
    setItems(newItems);
    try {
      localStorage.setItem(storageKey, JSON.stringify(newItems));
    } catch (e) {
      console.error(e);
    }
  };

  const toggleComplete = (id) => {
    const updated = items.map(item => 
      item.id === id ? { ...item, completed: !item.completed } : item
    );
    saveItems(updated);
  };

  const deleteItem = (id, e) => {
    e.stopPropagation();
    const updated = items.filter(item => item.id !== id);
    saveItems(updated);
  };

  const handleAddItem = (e) => {
    e?.preventDefault();
    if (!taskText.trim()) return;

    const newItem = {
      id: Date.now().toString(),
      startTime: startTime || '00:00',
      endTime: endTime || '00:00',
      task: taskText.trim(),
      completed: false,
      category: category || 'General'
    };

    const updated = [...items, newItem].sort((a, b) => a.startTime.localeCompare(b.startTime));
    saveItems(updated);
    setTaskText('');
  };

  const totalCount = items.length;
  const completedCount = items.filter(i => i.completed).length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const filteredItems = items.filter(item => {
    if (filter === 'pending') return !item.completed;
    if (filter === 'completed') return item.completed;
    return true;
  });

  const isCurrentSlot = (start, end) => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [sh, sm] = start.split(':').map(Number);
    const startMinutes = sh * 60 + sm;

    const [eh, em] = end.split(':').map(Number);
    const endMinutes = eh * 60 + em;

    if (endMinutes >= startMinutes) {
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    } else {
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="relative flex flex-col justify-between rounded-3xl bg-[#e3eceb] p-5 shadow-sm border border-[#ccd8d7] w-full min-h-[460px]"
    >
      {/* Top Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="bg-[#1f2222] text-white text-xs md:text-sm font-semibold px-4 py-1.5 rounded-full shadow-sm tracking-wide flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            Time Table
          </span>
          <span className="text-xs text-gray-600 font-medium">
            {completedCount}/{totalCount} Done
          </span>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 bg-[#d3dfde] p-1 rounded-full text-[11px]">
          {['all', 'pending', 'completed'].map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-2.5 py-0.5 rounded-full font-medium capitalize transition-all ${
                filter === type ? 'bg-[#1f2222] text-white shadow-xs' : 'text-gray-600 hover:text-black'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-[#cbdad8] h-2 rounded-full mb-3 overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          className="h-full bg-emerald-500 rounded-full"
        />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto max-h-[290px] pr-1 space-y-2.5">
        <AnimatePresence mode="popLayout">
          {filteredItems.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="flex flex-col items-center justify-center h-48 text-gray-400 text-xs"
            >
              <Sparkles className="w-6 h-6 mb-2 text-gray-300" />
              Koi time slot nahi mila
            </motion.div>
          ) : (
            filteredItems.map((item) => {
              const active = isCurrentSlot(item.startTime, item.endTime);
              return (
                <motion.div
                  layout
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.2 } }}
                  whileHover={{ scale: 1.01 }}
                  onClick={() => toggleComplete(item.id)}
                  className={`group relative flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all border ${
                    item.completed
                      ? 'bg-[#d8e3e1]/60 border-transparent text-gray-400'
                      : active
                      ? 'bg-white border-amber-300 shadow-sm ring-2 ring-amber-300/40'
                      : 'bg-[#edf4f3] border-white/60 hover:bg-white text-gray-800'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <motion.div 
                      whileTap={{ scale: 0.85 }}
                      className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                        item.completed 
                          ? 'bg-emerald-500 border-emerald-500 text-white' 
                          : 'border-gray-400 bg-white group-hover:border-black'
                      }`}
                    >
                      {item.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </motion.div>

                    <div className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold tracking-wider flex items-center gap-1 ${
                      active 
                        ? 'bg-amber-100 text-amber-900 font-bold animate-pulse' 
                        : 'bg-[#dbe7e5] text-gray-700'
                    }`}>
                      <Clock className="w-3 h-3" />
                      {item.startTime} - {item.endTime}
                    </div>

                    <span className={`text-xs md:text-sm font-medium truncate ${
                      item.completed ? 'line-through text-gray-400' : 'text-gray-800'
                    }`}>
                      {item.task}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pl-2 shrink-0">
                    {active && !item.completed && (
                      <span className="hidden sm:inline-block bg-amber-400 text-black text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">
                        Now
                      </span>
                    )}

                    <span className="text-[10px] bg-white/70 px-2 py-0.5 rounded-lg text-gray-600 font-medium">
                      {item.category}
                    </span>

                    <button
                      onClick={(e) => deleteItem(item.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity rounded-md"
                      title="Delete Slot"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Bar */}
      <form 
        onSubmit={handleAddItem}
        className="mt-4 flex flex-wrap items-center gap-2 bg-white p-2 rounded-2xl shadow-sm border border-[#ccd8d7]"
      >
        <div className="flex items-center gap-1 bg-[#f0f5f4] px-2 py-1 rounded-xl border border-gray-200">
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="text-xs bg-transparent text-gray-700 font-semibold focus:outline-none cursor-pointer"
          />
          <span className="text-gray-400 text-xs">-</span>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="text-xs bg-transparent text-gray-700 font-semibold focus:outline-none cursor-pointer"
          />
        </div>

        <input
          type="text"
          placeholder="Is time par kya karna hai..."
          value={taskText}
          onChange={(e) => setTaskText(e.target.value)}
          className="flex-1 min-w-[130px] bg-transparent text-xs text-gray-800 placeholder-gray-400 px-2 focus:outline-none"
        />

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="bg-[#f0f5f4] text-gray-700 text-[11px] font-medium py-1 px-2 rounded-xl border border-gray-200 focus:outline-none cursor-pointer"
        >
          <option value="Routine">Routine</option>
          <option value="Trading">Trading</option>
          <option value="Health">Health</option>
          <option value="Study">Study</option>
          <option value="Work">Work</option>
        </select>

        <motion.button
          type="submit"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.92 }}
          className="w-8 h-8 rounded-xl bg-[#f97316] hover:bg-[#ea580c] flex items-center justify-center text-white shadow-sm transition-colors shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
        </motion.button>
      </form>
    </motion.div>
  );
}
