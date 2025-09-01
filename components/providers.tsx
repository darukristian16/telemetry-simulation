"use client";

import React from 'react';
import { ThemeProvider } from 'next-themes';
import { TelemetryProvider } from '@/context/TelemetryContext';
import { TerminalDashboardProvider } from '@/context/TerminalDashboardContext';
import { ProcessedDataProvider } from '@/context/ProcessedDataContext';
import SessionProviderWrapper from './SessionProviderWrapper';
import { SerialTelemetryBridge } from './SerialTelemetryBridge';
import { SimulationProvider } from '@/context/SimulationContext';
import { LoggingProvider } from '@/context/LoggingContext';

interface ProvidersProps {
  children: React.ReactNode;
}

// Use a React component to ensure we have a singleton provider
export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <SessionProviderWrapper>
        <LoggingProvider>
          <SimulationProvider>
            <TelemetryProvider>
              <ProcessedDataProvider>
                <TerminalDashboardProvider>
                  {/* SerialTelemetryBridge is mounted globally to ensure continuous data processing */}
                  <SerialTelemetryBridge />
                  {children}
                </TerminalDashboardProvider>
              </ProcessedDataProvider>
            </TelemetryProvider>
          </SimulationProvider>
        </LoggingProvider>
      </SessionProviderWrapper>
    </ThemeProvider>
  );
}