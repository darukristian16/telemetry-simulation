import { createContext, useState, useContext, ReactNode } from 'react';

interface LogStats {
    packetsSent: number;
    packetsReceived: number;
    bytesReceived: number;
    latencies: number[];
}

interface LoggingContextType {
    logStats: LogStats;
    resetLogs: () => void;
    logPacketSent: () => void;
    logPacketReceived: (bytes: number, latency: number) => void;
}

const LoggingContext = createContext<LoggingContextType | undefined>(undefined);

export const LoggingProvider = ({ children }: { children: ReactNode }) => {
    const [logStats, setLogStats] = useState<LogStats>({
        packetsSent: 0,
        packetsReceived: 0,
        bytesReceived: 0,
        latencies: [],
    });

    const resetLogs = () => {
        setLogStats({ packetsSent: 0, packetsReceived: 0, bytesReceived: 0, latencies: [] });
    };

    const logPacketSent = () => {
        setLogStats(prev => ({ ...prev, packetsSent: prev.packetsSent + 1 }));
    };

    const logPacketReceived = (bytes: number, latency: number) => {
        setLogStats(prev => ({
            ...prev,
            packetsReceived: prev.packetsReceived + 1,
            bytesReceived: prev.bytesReceived + bytes,
            latencies: [...prev.latencies, latency],
        }));
    };

    return (
        <LoggingContext.Provider value={{ logStats, resetLogs, logPacketSent, logPacketReceived }}>
            {children}
        </LoggingContext.Provider>
    );
};

export const useLogger = () => {
    const context = useContext(LoggingContext);
    if (!context) {
        throw new Error('useLogger must be used within a LoggingProvider');
    }
    return context;
};
