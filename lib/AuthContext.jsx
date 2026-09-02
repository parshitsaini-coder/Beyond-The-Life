'use client';

import React, { createContext, useContext, useState } from 'react';

const AuthContext = createContext({ user: null });

export function AuthProvider({ children }) {
  const [user] = useState({ uid: 'user_1', displayName: 'Lakshit' });
  return <AuthContext.Provider value={{ user }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
