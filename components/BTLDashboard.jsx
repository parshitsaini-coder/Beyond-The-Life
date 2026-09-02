'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Check, 
  Plus, 
  Calendar as CalendarIcon, 
  Smile, 
  Tag, 
  Repeat, 
  ChevronLeft, 
  ChevronRight,
  TrendingUp,
  Flame,
  Clock
} from 'lucide-react';
import TimeTable from './TimeTable';

export default function BTLDashboard() {
  const [selectedDate, setSelectedDate] = useState('2026-09-02');
  const [dailyGoals, setDailyGoals] = useState([
    { id: 1, text: '+ Workout', priority: 'M', completed: false },
    { id: 2, text: '+ Meditate 10 min', priority: 'M', completed: false },
    { id: 3, text: '+ Read', priority: 'M', completed: false },
    { id: 4, text: '+ Drink 3L water', priority: 'M', completed: false },
    { id: 5, text: '+ Plan tomorrow', priority: 'M', completed: false },
    { id: 6, text: '+ No junk food', priority: 'M', completed: false },
    { id: 7, text: '+ Sleep by 11 PM', priority: 'M', completed: false },
    { id: 8, text: '+ Gratitude note', priority: 'M', completed: false },
  ]);

  const [newGoalText, setNewGoalText] = useState('');
  const [extryGoals, setExtryGoals] = useState([]);
  const [newExtryText, setNewExtryText] = useState('');

  const toggleGoal = (id) => {
    setDailyGoals(goals => goals.map(g => g.id === id ? { ...g, completed: !g.completed } : g));
  };

  const addGoal = (e) => {
    e.preventDefault();
    if (!newGoalText.trim()) return;
    setDailyGoals([...dailyGoals, { id: Date.now(), text: '+ ' + newGoalText.trim(), priority: 'M', completed: false }]);
    setNewGoalText('');
  };

  const addExtryGoal = (e) => {
    e.preventDefault();
    if (!newExtryText.trim()) return;
    setExtryGoals([...extryGoals, { id: Date.now(), text: newExtryText.trim(), completed: false }]);
    setNewExtryText('');
  };

  return (
    <div className="min-h-screen bg-[#9ea9ab] p-4 md:p-6 text-gray-800 font-sans">
      {/* Top Header Info Bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="border border-red-400 bg-red-50/70 text-red-600 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide">
          Total Spend Money life :- ₹0
        </div>
        <div className="flex items-center gap-6 text-xs font-medium text-gray-700">
          <span>Streak: <strong className="text-black">0</strong></span>
          <span>Daily Goal Status</span>
          <span>Extry Goal Status</span>
          <span>Goal</span>
          <div className="w-8 h-8 rounded-full bg-orange-400 text-white flex items-center justify-center font-bold">L</div>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        
        {/* Column 1: Life Big Goals */}
        <div className="space-y-4">
          <div className="rounded-3xl bg-[#edf3f4] p-5 shadow-sm border border-[#ccd8d7] min-h-[220px]">
            <div className="flex justify-center mb-4">
              <span className="bg-[#1f2222] text-white text-xs font-semibold px-4 py-1.5 rounded-full">
                Life Big Goals
              </span>
            </div>
            <ul className="space-y-3 text-xs md:text-sm font-semibold text-gray-800">
              <li className="p-2 rounded-xl bg-white/60">Become financially free</li>
              <li className="p-2 rounded-xl bg-white/60">Build a strong, healthy body</li>
              <li className="p-2 rounded-xl bg-white/60">Travel to 20 countries</li>
            </ul>
          </div>

          {/* Life Rules */}
          <div className="rounded-3xl bg-[#eaf4ea] p-5 shadow-sm border border-[#cbe0cb] min-h-[200px]">
            <div className="flex justify-center mb-4">
              <span className="bg-[#1f2222] text-white text-xs font-semibold px-4 py-1.5 rounded-full">
                Life Rules
              </span>
            </div>
            <ul className="space-y-2 text-xs md:text-sm font-semibold text-gray-800">
              <li className="p-2 rounded-xl bg-white/60">Wake up at 5 AM</li>
              <li className="p-2 rounded-xl bg-white/60">No phone before 9 AM</li>
              <li className="p-2 rounded-xl bg-white/60">Read 20 pages every day</li>
            </ul>
          </div>
        </div>

        {/* Column 2: Calendar & Finance/Mood */}
        <div className="space-y-4">
          {/* Calendar Widget */}
          <div className="rounded-3xl bg-[#fcf9f4] p-5 shadow-sm border border-[#e4dcce]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 font-bold text-xs">
                <CalendarIcon className="w-3.5 h-3.5" />
                Calendar
              </div>
              <div className="text-xs font-semibold">September 2026</div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-gray-500 mb-1">
              <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium">
              <span className="text-gray-300">30</span><span className="text-gray-300">31</span>
              <span className="p-1">1</span>
              <span className="p-1 bg-black text-white rounded-full font-bold">2</span>
              <span className="p-1">3</span><span className="p-1">4</span><span className="p-1">5</span>
              <span className="p-1">6</span><span className="p-1">7</span><span className="p-1">8</span><span className="p-1">9</span><span className="p-1">10</span><span className="p-1">11</span><span className="p-1">12</span>
              <span className="p-1">13</span><span className="p-1">14</span><span className="p-1">15</span><span className="p-1">16</span><span className="p-1">17</span><span className="p-1">18</span><span className="p-1">19</span>
              <span className="p-1">20</span><span className="p-1">21</span><span className="p-1">22</span><span className="p-1">23</span><span className="p-1">24</span><span className="p-1">25</span><span className="p-1">26</span>
              <span className="p-1">27</span><span className="p-1">28</span><span className="p-1">29</span><span className="p-1">30</span>
            </div>
            <div className="flex justify-center gap-3 mt-3 text-gray-400">
              <ChevronLeft className="w-4 h-4 cursor-pointer hover:text-black" />
              <ChevronRight className="w-4 h-4 cursor-pointer hover:text-black" />
            </div>
          </div>

          {/* Earn / Spend Money Today */}
          <div className="rounded-3xl bg-[#fefefe] p-4 shadow-sm border border-[#ccd8d7] space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-[11px] font-bold text-emerald-600 mb-1">Earn Money Today :-</div>
                <div className="flex gap-1">
                  <input type="text" placeholder="₹ amount" className="w-full text-xs p-1.5 rounded-xl border border-gray-200" />
                  <button className="bg-emerald-600 text-white text-[10px] font-bold px-2 rounded-xl">Add</button>
                </div>
              </div>
              <div>
                <div className="text-[11px] font-bold text-red-600 mb-1">Spend Money Today :-</div>
                <div className="flex gap-1">
                  <input type="text" placeholder="₹ amount" className="w-full text-xs p-1.5 rounded-xl border border-gray-200" />
                  <button className="bg-red-600 text-white text-[10px] font-bold px-2 rounded-xl">Add</button>
                </div>
              </div>
            </div>
            <textarea placeholder="notes" className="w-full text-xs p-2 rounded-xl border border-gray-200 resize-none h-14" />
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="font-semibold text-gray-700">Today's Mood :-</span>
              <div className="flex gap-2 text-base cursor-pointer">
                <span>😐</span><span>🙂</span><span>😄</span>
              </div>
            </div>
          </div>
        </div>

        {/* Column 3: Time Table & Analytics */}
        <div className="space-y-4">
          {/* NEW TIME TABLE LAYOUT */}
          <TimeTable selectedDate={selectedDate} />

          {/* Analytics Summary */}
          <div className="rounded-3xl bg-[#faefe0] p-4 shadow-sm border border-[#e4d4be]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1 font-bold text-xs">
                <TrendingUp className="w-3.5 h-3.5" />
                Analytics Summary
              </div>
              <button className="text-[10px] font-semibold bg-[#1f2222] text-white px-2.5 py-1 rounded-full">
                Open full &gt;
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center my-2">
              <div className="bg-white/70 p-2 rounded-2xl">
                <div className="text-base font-bold">0%</div>
                <div className="text-[10px] text-gray-500">Daily</div>
              </div>
              <div className="bg-white/70 p-2 rounded-2xl">
                <div className="text-base font-bold">0%</div>
                <div className="text-[10px] text-gray-500">Extry</div>
              </div>
              <div className="bg-white/70 p-2 rounded-2xl">
                <div className="text-base font-bold">0%</div>
                <div className="text-[10px] text-gray-500">Overall</div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-center">
              <div className="bg-[#1f2222] text-white text-xs px-4 py-1.5 rounded-full flex items-center gap-1 font-bold">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                000 Day Streak
              </div>
            </div>
          </div>
        </div>

        {/* Column 4: Daily Goals & Extry Goals */}
        <div className="space-y-4">
          {/* Daily Goals */}
          <div className="rounded-3xl bg-[#dbe6db] p-5 shadow-sm border border-[#c1d3c1] flex flex-col justify-between min-h-[440px]">
            <div>
              <div className="flex justify-center mb-4">
                <span className="bg-[#1f2222] text-white text-xs font-semibold px-4 py-1.5 rounded-full">
                  Daily Goals
                </span>
              </div>
              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                {dailyGoals.map(goal => (
                  <div 
                    key={goal.id} 
                    onClick={() => toggleGoal(goal.id)}
                    className="flex items-center justify-between p-2 rounded-xl bg-white/70 hover:bg-white cursor-pointer transition-all border border-white/50"
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${goal.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-400 bg-white'}`}>
                        {goal.completed && <Check className="w-3 h-3" />}
                      </div>
                      <span className={`text-xs font-medium ${goal.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                        {goal.text}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-4 h-4 rounded bg-amber-400 text-black text-[9px] font-bold flex items-center justify-center">
                        {goal.priority}
                      </span>
                      <Repeat className="w-3 h-3 text-gray-400" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Add Bar */}
            <form onSubmit={addGoal} className="mt-3 flex items-center gap-1.5 bg-white p-1.5 rounded-2xl shadow-sm border border-gray-200">
              <Smile className="w-4 h-4 text-amber-500 ml-1 cursor-pointer" />
              <input 
                type="text" 
                placeholder="Add item..." 
                value={newGoalText} 
                onChange={(e) => setNewGoalText(e.target.value)}
                className="flex-1 bg-transparent text-xs px-1 focus:outline-none" 
              />
              <Tag className="w-3.5 h-3.5 text-gray-400 cursor-pointer" />
              <button type="submit" className="w-6 h-6 rounded-xl bg-[#f97316] text-white flex items-center justify-center">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>

          {/* Extry Goals */}
          <div className="rounded-3xl bg-[#d4e4e7] p-5 shadow-sm border border-[#b8d2d6] flex flex-col justify-between min-h-[220px]">
            <div>
              <div className="flex justify-center mb-4">
                <span className="bg-[#1f2222] text-white text-xs font-semibold px-4 py-1.5 rounded-full">
                  Extry Goals
                </span>
              </div>
              <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
                {extryGoals.length === 0 ? (
                  <div className="text-center text-xs text-gray-400 py-6">No extra goals yet</div>
                ) : (
                  extryGoals.map(eg => (
                    <div key={eg.id} className="text-xs p-2 bg-white/70 rounded-xl">
                      {eg.text}
                    </div>
                  ))
                )}
              </div>
            </div>
            <form onSubmit={addExtryGoal} className="mt-3 flex items-center gap-1.5 bg-white p-1.5 rounded-2xl shadow-sm border border-gray-200">
              <Smile className="w-4 h-4 text-amber-500 ml-1 cursor-pointer" />
              <input 
                type="text" 
                placeholder="Add item..." 
                value={newExtryText} 
                onChange={(e) => setNewExtryText(e.target.value)}
                className="flex-1 bg-transparent text-xs px-1 focus:outline-none" 
              />
              <Tag className="w-3.5 h-3.5 text-gray-400 cursor-pointer" />
              <button type="submit" className="w-6 h-6 rounded-xl bg-[#f97316] text-white flex items-center justify-center">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
