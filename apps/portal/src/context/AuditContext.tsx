import React, { createContext, useContext, useEffect, useCallback, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface AuditStatusUpdate {
  auditId: string;
  status: string;
  updatedAt: string;
}

interface AuditContextValue {
  /** Map of auditId → latest status */
  statusUpdates: Map<string, string>;
  /** Subscribe to status changes for a specific audit */
  subscribe: (auditId: string, callback: (status: string) => void) => () => void;
  /** Check if connected to real-time server */
  isConnected: boolean;
}

const AuditContext = createContext<AuditContextValue | null>(null);

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const AuditProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const statusUpdatesRef = useRef(new Map<string, string>());
  const listenersRef = useRef(new Map<string, Set<(status: string) => void>>());
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(SOCKET_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('audit_update', (data: AuditStatusUpdate) => {
      statusUpdatesRef.current.set(data.auditId, data.status);

      // Notify all listeners for this audit
      const listeners = listenersRef.current.get(data.auditId);
      if (listeners) {
        listeners.forEach((cb) => cb(data.status));
      }

      // Also emit global event for backward compat
      window.dispatchEvent(
        new CustomEvent('audit_status_change', { detail: data }),
      );
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const subscribe = useCallback(
    (auditId: string, callback: (status: string) => void) => {
      if (!listenersRef.current.has(auditId)) {
        listenersRef.current.set(auditId, new Set());
      }
      listenersRef.current.get(auditId)!.add(callback);

      // Return unsubscribe function
      return () => {
        const listeners = listenersRef.current.get(auditId);
        if (listeners) {
          listeners.delete(callback);
          if (listeners.size === 0) {
            listenersRef.current.delete(auditId);
          }
        }
      };
    },
    [],
  );

  const value: AuditContextValue = {
    statusUpdates: statusUpdatesRef.current,
    subscribe,
    isConnected,
  };

  return <AuditContext.Provider value={value}>{children}</AuditContext.Provider>;
};

export function useAuditContext() {
  const ctx = useContext(AuditContext);
  if (!ctx) {
    throw new Error('useAuditContext must be used within AuditProvider');
  }
  return ctx;
}
