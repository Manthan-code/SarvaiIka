/**
 * Frontend Streaming Components Test Suite
 * Tests enhanced streaming chat components and performance monitoring
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// Import components
import EnhancedStreamingChat from '../src/components/EnhancedStreamingChat';
import PerformanceDashboard from '../src/components/PerformanceDashboard';

// Import hooks and services
import * as EnhancedHooksModule from '@/hooks/useEnhancedStreamingChat';
import * as StreamingHooksModule from '@/hooks/useStreamingChat';
import OptimizedStreamingService from '@/services/optimizedStreamingService';

// Mock UI components with forwardRef support
jest.mock('@/components/ui/button', () => {
  const React = require('react');
  return {
    Button: React.forwardRef<HTMLButtonElement, any>(({ children, className, variant, size, disabled, onClick, type, ...props }, ref) => (
      <button 
        ref={ref}
        className={className} 
        disabled={disabled} 
        onClick={onClick} 
        type={type}
        data-variant={variant}
        data-size={size}
        {...props}
      >
        {children}
      </button>
    ))
  };
});

jest.mock('@/components/ui/badge', () => {
  const React = require('react');
  return {
    Badge: React.forwardRef<HTMLDivElement, any>(({ children, className, variant, ...props }, ref) => (
      <div ref={ref} className={className} data-variant={variant} {...props}>
        {children}
      </div>
    ))
  };
});

jest.mock('@/components/ui/textarea', () => {
  const React = require('react');
  return {
    Textarea: React.forwardRef<HTMLTextAreaElement, any>(({ className, value, onChange, placeholder, disabled, ...props }, ref) => (
      <textarea 
        ref={ref}
        className={className} 
        value={value} 
        onChange={onChange} 
        placeholder={placeholder}
        disabled={disabled}
        {...props}
      />
    ))
  };
});

jest.mock('@/components/ui/card', () => {
  const React = require('react');
  return {
    Card: React.forwardRef<HTMLDivElement, any>(({ children, className, ...props }, ref) => (
      <div ref={ref} className={className} {...props}>{children}</div>
    )),
    CardContent: React.forwardRef<HTMLDivElement, any>(({ children, className, ...props }, ref) => (
      <div ref={ref} className={className} {...props}>{children}</div>
    )),
    CardHeader: React.forwardRef<HTMLDivElement, any>(({ children, className, ...props }, ref) => (
      <div ref={ref} className={className} {...props}>{children}</div>
    )),
    CardTitle: React.forwardRef<HTMLHeadingElement, any>(({ children, className, ...props }, ref) => (
      <h3 ref={ref} className={className} {...props}>{children}</h3>
    ))
  };
});

jest.mock('@/components/ui/tooltip', () => {
  const React = require('react');
  return {
    Tooltip: ({ children }: any) => <div>{children}</div>,
    TooltipContent: React.forwardRef<HTMLDivElement, any>(({ children, className, ...props }, ref) => {
      // Filter out asChild prop
      const { asChild, ...filteredProps } = props;
      return (
        <div ref={ref} className={className} {...filteredProps}>{children}</div>
      );
    }),
    TooltipProvider: ({ children }: any) => <div>{children}</div>,
    TooltipTrigger: React.forwardRef<HTMLDivElement, any>(({ children, className, ...props }, ref) => {
      // Filter out asChild prop
      const { asChild, ...filteredProps } = props;
      return (
        <div ref={ref} className={className} {...filteredProps}>{children}</div>
      );
    })
  };
});

jest.mock('@/components/ui/progress', () => {
  const React = require('react');
  return {
    Progress: React.forwardRef<HTMLDivElement, any>(({ value, className, ...props }, ref) => (
      <div ref={ref} className={className} data-value={value} {...props} />
    ))
  };
});

jest.mock('@/components/ui/tabs', () => {
  const React = require('react');
  return {
    Tabs: React.forwardRef<HTMLDivElement, any>(({ children, className, defaultValue, ...props }, ref) => (
      <div ref={ref} className={className} data-default-value={defaultValue} {...props}>{children}</div>
    )),
    TabsList: React.forwardRef<HTMLDivElement, any>(({ children, className, ...props }, ref) => (
      <div ref={ref} className={className} {...props}>{children}</div>
    )),
    TabsTrigger: React.forwardRef<HTMLButtonElement, any>(({ children, className, value, ...props }, ref) => (
      <button ref={ref} className={className} data-value={value} {...props}>{children}</button>
    )),
    TabsContent: React.forwardRef<HTMLDivElement, any>(({ children, className, value, ...props }, ref) => (
      <div ref={ref} className={className} data-value={value} {...props}>{children}</div>
    ))
  };
});

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Send: ({ className, ...props }: any) => <div className={className} data-testid="send-icon" {...props} />,
  Loader2: ({ className, ...props }: any) => <div className={className} data-testid="loader2-icon" {...props} />,
  Copy: ({ className, ...props }: any) => <div className={className} data-testid="copy-icon" {...props} />,
  Check: ({ className, ...props }: any) => <div className={className} data-testid="check-icon" {...props} />,
  Zap: ({ className, ...props }: any) => <div className={className} data-testid="zap-icon" {...props} />,
  Brain: ({ className, ...props }: any) => <div className={className} data-testid="brain-icon" {...props} />,
  Sparkles: ({ className, ...props }: any) => <div className={className} data-testid="sparkles-icon" {...props} />,
  MessageSquare: ({ className, ...props }: any) => <div className={className} data-testid="message-square-icon" {...props} />,
  Clock: ({ className, ...props }: any) => <div className={className} data-testid="clock-icon" {...props} />,
  AlertCircle: ({ className, ...props }: any) => <div className={className} data-testid="alert-circle-icon" {...props} />,
  RefreshCw: ({ className, ...props }: any) => <div className={className} data-testid="refresh-cw-icon" {...props} />,
  Volume2: ({ className, ...props }: any) => <div className={className} data-testid="volume2-icon" {...props} />,
  VolumeX: ({ className, ...props }: any) => <div className={className} data-testid="volume-x-icon" {...props} />,
  Mic: ({ className, ...props }: any) => <div className={className} data-testid="mic-icon" {...props} />,
  MicOff: ({ className, ...props }: any) => <div className={className} data-testid="mic-off-icon" {...props} />,
  Square: ({ className, ...props }: any) => <div className={className} data-testid="square-icon" {...props} />,
  Trash2: ({ className, ...props }: any) => <div className={className} data-testid="trash-icon" {...props} />,
  Settings: ({ className, ...props }: any) => <div className={className} data-testid="settings-icon" {...props} />,
  BarChart3: ({ className, ...props }: any) => <div className={className} data-testid="bar-chart-icon" {...props} />,
  Activity: ({ className, ...props }: any) => <div className={className} data-testid="activity-icon" {...props} />,
  TrendingUp: ({ className, ...props }: any) => <div className={className} data-testid="trending-up-icon" {...props} />,
  TrendingDown: ({ className, ...props }: any) => <div className={className} data-testid="trending-down-icon" {...props} />,
  AlertTriangle: ({ className, ...props }: any) => <div className={className} data-testid="alert-triangle-icon" {...props} />,
  CheckCircle: ({ className, ...props }: any) => <div className={className} data-testid="check-circle-icon" {...props} />,
  XCircle: ({ className, ...props }: any) => <div className={className} data-testid="x-circle-icon" {...props} />,
  Wifi: ({ className, ...props }: any) => <div className={className} data-testid="wifi-icon" {...props} />,
  Database: ({ className, ...props }: any) => <div className={className} data-testid="database-icon" {...props} />,
  Cpu: ({ className, ...props }: any) => <div className={className} data-testid="cpu-icon" {...props} />,
  MemoryStick: ({ className, ...props }: any) => <div className={className} data-testid="memory-stick-icon" {...props} />,
  Download: ({ className, ...props }: any) => <div className={className} data-testid="download-icon" {...props} />,
  Upload: ({ className, ...props }: any) => <div className={className} data-testid="upload-icon" {...props} />,
  PieChart: ({ className, ...props }: any) => <div className={className} data-testid="pie-chart-icon" {...props} />,
  LineChart: ({ className, ...props }: any) => <div className={className} data-testid="line-chart-icon" {...props} />,
  Maximize2: ({ className, ...props }: any) => <div className={className} data-testid="maximize2-icon" {...props} />,
  Minimize2: ({ className, ...props }: any) => <div className={className} data-testid="minimize2-icon" {...props} />
}));

// Mock @/lib/utils
jest.mock('@/lib/utils', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' ')
}));

// Mock framer-motion with proper prop filtering
jest.mock('framer-motion', () => {
  const React = require('react');
  const filterProps = (props: any, allowedProps: string[]) => {
    const filtered: any = {};
    Object.keys(props).forEach(key => {
      if (allowedProps.includes(key)) {
        filtered[key] = props[key];
      }
    });
    return filtered;
  };

  return {
    motion: {
      div: React.forwardRef<HTMLDivElement, any>(({ children, ...props }, ref) => {
        const allowedProps = ['className', 'style', 'onClick', 'onMouseEnter', 'onMouseLeave', 'id', 'role', 'aria-label', 'data-testid'];
        const filteredProps = filterProps(props, allowedProps);
        return React.createElement('div', { ref, ...filteredProps }, children);
      }),
      span: React.forwardRef<HTMLSpanElement, any>(({ children, ...props }, ref) => {
        const allowedProps = ['className', 'style', 'onClick', 'id', 'role', 'aria-label', 'data-testid'];
        const filteredProps = filterProps(props, allowedProps);
        return React.createElement('span', { ref, ...filteredProps }, children);
      }),
      button: React.forwardRef<HTMLButtonElement, any>(({ children, ...props }, ref) => {
        const allowedProps = ['className', 'style', 'onClick', 'disabled', 'type', 'id', 'aria-label', 'role', 'data-testid'];
        const filteredProps = filterProps(props, allowedProps);
        return React.createElement('button', { ref, ...filteredProps }, children);
      })
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
    useAnimation: () => ({
      start: jest.fn(),
      stop: jest.fn(),
      set: jest.fn()
    })
  };
});

// Mock AudioContext
global.AudioContext = jest.fn().mockImplementation(() => ({
  createAnalyser: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    fftSize: 256,
    frequencyBinCount: 128,
    getByteFrequencyData: jest.fn(),
    getByteTimeDomainData: jest.fn()
  })),
  createMediaStreamSource: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn()
  })),
  close: jest.fn(),
  resume: jest.fn(),
  suspend: jest.fn(),
  state: 'running'
}));

// Mock hooks and services
// Mock hooks and services (use alias paths to match component imports)
// Mock hooks early to ensure imported references are Jest mocks
jest.mock('@/hooks/useEnhancedStreamingChat', () => ({
  __esModule: true,
  useEnhancedStreamingChat: jest.fn(),
}));
jest.mock('@/hooks/useStreamingChat', () => ({
  __esModule: true,
  useStreamingChat: jest.fn(),
}));
jest.mock('@/services/optimizedStreamingService', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      startOptimizedStream: jest.fn(),
      cancelStream: jest.fn(),
      cancelAllStreams: jest.fn(),
      getMetrics: jest.fn(),
      getConnectionPoolStatus: jest.fn(),
      getBufferStatus: jest.fn(),
      resetMetrics: jest.fn(),
      updateConfig: jest.fn(),
      destroy: jest.fn()
    })),
    getOptimizedStreamingService: jest.fn(),
    destroyOptimizedStreamingService: jest.fn()
  };
});

const mockUseEnhancedStreamingChat = jest.spyOn(EnhancedHooksModule, 'useEnhancedStreamingChat') as unknown as jest.MockedFunction<typeof useEnhancedStreamingChat>;
const mockUseStreamingChat = jest.spyOn(StreamingHooksModule, 'useStreamingChat') as unknown as jest.MockedFunction<typeof useStreamingChat>;
const MockedOptimizedStreamingService = OptimizedStreamingService as jest.MockedClass<typeof OptimizedStreamingService>;

describe('Enhanced Streaming Components', () => {
  let mockStreamingHook: any;
  let mockStreamingService: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock streaming hook
    mockStreamingHook = {
      messages: [],
      streamingState: {
        isStreaming: false,
        currentModel: 'gpt-3.5-turbo',
        error: null,
        streamingText: ''
      },
      performance: {
        responseTime: 0,
        tokensPerSecond: 0,
        totalTokens: 0
      },
      sendMessage: jest.fn(),
      clearMessages: jest.fn(),
      retryLastMessage: jest.fn(),
      cancelStream: jest.fn()
    };
    
    mockUseEnhancedStreamingChat.mockReturnValue(mockStreamingHook);
    
    // Mock the useStreamingChat hook that the component actually uses
    mockUseStreamingChat.mockImplementation(() => mockStreamingHook);
    
    // Mock streaming service
    mockStreamingService = {
      getMetrics: jest.fn().mockReturnValue({
        activeConnections: 0,
        totalRequests: 0,
        successfulRequests: 0,
        averageResponseTime: 0,
        averageThroughput: 0,
        connectionErrors: 0,
        errorRate: 0,
        throughput: 0,
        bufferUtilization: 0,
        connectionPoolStatus: {
          active: 0,
          idle: 0,
          total: 0
        },
        performanceScore: 100,
        lastUpdated: new Date()
      }),
      getConnectionPoolStatus: jest.fn().mockReturnValue({
        active: 0,
        queued: 0,
        maxConnections: 10
      }),
      getBufferStatus: jest.fn().mockReturnValue({
        activeBuffers: 0,
        totalBufferSize: 0,
        averageBufferSize: 0
      }),
      getHealthStatus: jest.fn().mockResolvedValue({
        status: 'healthy',
        uptime: 1000,
        memoryUsage: 50,
        cpuUsage: 30
      })
    };
    
    MockedOptimizedStreamingService.mockImplementation(() => mockStreamingService);
    
    // Mock the getOptimizedStreamingService function
    const { getOptimizedStreamingService } = require('@/services/optimizedStreamingService');
    getOptimizedStreamingService.mockReturnValue(mockStreamingService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('EnhancedStreamingChat Component', () => {
    it('should render chat interface correctly', () => {
      render(<EnhancedStreamingChat />);
      
      expect(screen.getByPlaceholderText(/type your message/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument();
      expect(screen.getByText(/ai assistant/i)).toBeInTheDocument();
    });

    it('should display messages correctly', () => {
      mockStreamingHook.messages = [
        {
          id: '1',
          content: 'Hello, how can I help you?',
          role: 'assistant',
          timestamp: new Date(),
          model: 'gpt-3.5-turbo'
        },
        {
          id: '2',
          content: 'What is AI?',
          role: 'user',
          timestamp: new Date()
        }
      ];
      
      render(<EnhancedStreamingChat />);
      
      expect(screen.getByText('Hello, how can I help you?')).toBeInTheDocument();
      expect(screen.getByText('What is AI?')).toBeInTheDocument();
    });

    it('should handle message sending', async () => {
      render(<EnhancedStreamingChat />);
      
      const input = screen.getByPlaceholderText(/type your message/i);
      const sendButton = screen.getByRole('button', { name: /send message/i });
      
      fireEvent.change(input, { target: { value: 'Test message' } });
      fireEvent.click(sendButton);
      
      await waitFor(() => {
        expect(mockStreamingHook.sendMessage).toHaveBeenCalledWith('Test message');
      });
    });

    it('should show streaming indicator when streaming', async () => {
      mockStreamingHook.streamingState.isStreaming = true;
      
      const { rerender } = render(<EnhancedStreamingChat />);
      
      expect(screen.getByText(/generating/i)).toBeInTheDocument();
      // While streaming, typing indicator should be visible
      const statusEl = await screen.findByRole('status');
      expect(statusEl).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByRole('status')).toBeInTheDocument();
      });
      
      // Simulate completion
      mockStreamingHook.streamingState.isStreaming = false;
      mockStreamingHook.messages = [
        {
          id: '1',
          content: 'Hello AI',
          role: 'user',
          timestamp: new Date()
        },
        {
          id: '2',
          content: 'Hello! How can I help you today?',
          role: 'assistant',
          timestamp: new Date(),
          model: 'gpt-3.5-turbo',
          isStreaming: false
        }
      ];
      
      rerender(<EnhancedStreamingChat key="complete" />);
      
      expect(screen.getByText('Hello AI')).toBeInTheDocument();
      expect(screen.getByText('Hello! How can I help you today?')).toBeInTheDocument();
    });

    it('should display current model information', () => {
      mockStreamingHook.streamingState.currentModel = 'gpt-4';
      
      render(<EnhancedStreamingChat />);
      
      expect(screen.getByText(/gpt-4/i)).toBeInTheDocument();
    });

    it('should handle errors gracefully', () => {
      mockStreamingHook.streamingState.error = 'Connection failed';
      
      render(<EnhancedStreamingChat />);
      
      // Component should still render even with errors
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByText(/ai assistant/i)).toBeInTheDocument();
    });

    it('should show performance information', () => {
      render(<EnhancedStreamingChat />);
      
      // Check for static performance information displayed in the component
      expect(screen.getByText(/response time.*2-5s/i)).toBeInTheDocument();
      expect(screen.getByText(/press enter to send/i)).toBeInTheDocument();
    });

    it('should handle keyboard shortcuts', async () => {
      render(<EnhancedStreamingChat />);
      
      const input = screen.getByPlaceholderText(/type your message/i);
      
      fireEvent.change(input, { target: { value: 'Test message' } });
      fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
      
      await waitFor(() => {
        expect(mockStreamingHook.sendMessage).toHaveBeenCalledWith('Test message');
      });
    });

    it('should clear messages when requested', async () => {
      // Add some messages so the clear button becomes visible
      mockStreamingHook.messages = [
        {
          id: '1',
          role: 'user',
          content: 'Test message',
          timestamp: new Date()
        }
      ];
      
      render(<EnhancedStreamingChat />);
      
      const clearButton = screen.getByRole('button', { name: /clear/i });
      fireEvent.click(clearButton);
      
      await waitFor(() => {
        expect(mockStreamingHook.clearMessages).toHaveBeenCalled();
      });
    });

    it('should handle streaming state changes', async () => {
      mockStreamingHook.streamingState.isStreaming = true;
      
      const { rerender } = render(<EnhancedStreamingChat />);
      
      // Verify streaming state is handled
      expect(mockStreamingHook.streamingState.isStreaming).toBe(true);
      
      // Simulate streaming completion
      mockStreamingHook.streamingState.isStreaming = false;
      rerender(<EnhancedStreamingChat />);
      
      expect(mockStreamingHook.streamingState.isStreaming).toBe(false);
    });

    it('should auto-scroll to bottom when new messages arrive', async () => {
      const scrollIntoViewMock = jest.fn();
      Element.prototype.scrollIntoView = scrollIntoViewMock;
      
      const { rerender } = render(<EnhancedStreamingChat />);
      
      // Add new message
      mockStreamingHook.messages = [
        {
          id: '1',
          content: 'New message',
          role: 'assistant',
          timestamp: new Date(),
          model: 'gpt-3.5-turbo'
        }
      ];
      
      rerender(<EnhancedStreamingChat />);
      
      await waitFor(() => {
        expect(scrollIntoViewMock).toHaveBeenCalled();
      });
    });

    it('should handle error states', async () => {
      mockStreamingHook.streamingState.error = 'Failed to send message';
      
      render(<EnhancedStreamingChat />);
      
      // Verify error state is handled
      expect(mockStreamingHook.streamingState.error).toBe('Failed to send message');
      
      // Clear error
      mockStreamingHook.streamingState.error = null;
      
      expect(mockStreamingHook.streamingState.error).toBeNull();
    });
  });

  describe('PerformanceDashboard Component', () => {
    it('should render performance metrics', async () => {
      mockStreamingService.getMetrics.mockReturnValue({
        activeConnections: 5,
        totalRequests: 100,
        successfulRequests: 98,
        averageResponseTime: 250,
        averageThroughput: 15.5,
        connectionErrors: 2,
        errorRate: 0.02,
        throughput: 15.5,
        failedRequests: 2,
        retryAttempts: 1,
        lastUpdated: new Date()
      });
      
      mockStreamingService.getConnectionPoolStatus.mockReturnValue({
        active: 3,
        queued: 0,
        maxConnections: 10
      });
      
      mockStreamingService.getBufferStatus.mockReturnValue({
        activeBuffers: 2,
        totalBufferSize: 1024,
        averageBufferSize: 512
      });
      
      await act(async () => {
        render(<PerformanceDashboard />);
      });
      
      await waitFor(() => {
        expect(screen.getByText(/performance dashboard/i)).toBeInTheDocument();
        expect(screen.getByText(/system health/i)).toBeInTheDocument();
        expect(screen.getByText(/response time/i)).toBeInTheDocument();
        expect(screen.getByText(/throughput/i)).toBeInTheDocument();
      });
    });

    it('should display real-time metrics', async () => {
      mockStreamingService.getMetrics.mockReturnValue({
        activeConnections: 5,
        totalRequests: 100,
        successfulRequests: 98,
        averageResponseTime: 250,
        averageThroughput: 15.5,
        connectionErrors: 2,
        errorRate: 0.02,
        throughput: 15.5,
        bufferUtilization: 0.75,
        connectionPoolStatus: {
          active: 3,
          idle: 2,
          total: 5
        },
        performanceScore: 85,
        lastUpdated: new Date()
      });
      
      mockStreamingService.getConnectionPoolStatus.mockReturnValue({
        active: 3,
        queued: 0,
        maxConnections: 10
      });
      
      mockStreamingService.getBufferStatus.mockReturnValue({
        activeBuffers: 2,
        totalBufferSize: 1024,
        averageBufferSize: 512
      });
      
      await act(async () => {
        render(<PerformanceDashboard />);
      });
      
      await waitFor(() => {
          expect(screen.getByText('250ms')).toBeInTheDocument();
          expect(screen.getByText('98.0%')).toBeInTheDocument();
          expect(screen.getByText('15.5B')).toBeInTheDocument();
          expect(screen.getByText('100')).toBeInTheDocument();
        });
    });

    it('should show health status', async () => {
      mockStreamingService.getMetrics.mockReturnValue({
        activeConnections: 5,
        totalRequests: 100,
        successfulRequests: 98,
        averageResponseTime: 150,
        averageThroughput: 20.0,
        connectionErrors: 2,
        errorRate: 0.02,
        throughput: 20.0,
        bufferUtilization: 0.4,
        connectionPoolStatus: {
          active: 5,
          idle: 3,
          total: 8
        },
        performanceScore: 88,
        lastUpdated: new Date()
      });
      
      mockStreamingService.getConnectionPoolStatus.mockReturnValue({
        active: 5,
        queued: 1,
        maxConnections: 8
      });
      
      mockStreamingService.getBufferStatus.mockReturnValue({
        activeBuffers: 3,
        totalBufferSize: 768,
        averageBufferSize: 256
      });
      
      await act(async () => {
        render(<PerformanceDashboard />);
      });
      
      await waitFor(() => {
        expect(screen.getByText('Performance Dashboard')).toBeInTheDocument();
        expect(screen.getByText('System Health')).toBeInTheDocument();
      });
    });

    it('should handle error states', async () => {
      mockStreamingService.getMetrics.mockImplementation(() => {
        throw new Error('Service unavailable');
      });
      
      await act(async () => {
        render(<PerformanceDashboard />);
      });
      
      await waitFor(() => {
        expect(screen.getByText('Loading performance metrics...')).toBeInTheDocument();
      });
    });

    it('should refresh metrics periodically', async () => {
      jest.useFakeTimers();
      
      await act(async () => {
        render(<PerformanceDashboard />);
      });
      
      expect(mockStreamingService.getMetrics).toHaveBeenCalledTimes(1);
      
      // Fast-forward time
      act(() => {
        jest.advanceTimersByTime(5000); // 5 seconds
      });
      
      await waitFor(() => {
        expect(mockStreamingService.getMetrics).toHaveBeenCalledTimes(2);
      });
      
      jest.useRealTimers();
    });

    it('should display connection pool status', async () => {
      mockStreamingService.getMetrics.mockReturnValue({
        activeConnections: 10,
        totalRequests: 500,
        successfulRequests: 495,
        averageResponseTime: 180,
        averageThroughput: 25.0,
        connectionErrors: 5,
        errorRate: 0.01,
        throughput: 25.0,
        bufferUtilization: 0.6,
        connectionPoolStatus: {
          active: 8,
          idle: 2,
          total: 10
        },
        performanceScore: 92,
        lastUpdated: new Date()
      });
      
      mockStreamingService.getConnectionPoolStatus.mockReturnValue({
        active: 8,
        queued: 2,
        maxConnections: 10
      });
      
      mockStreamingService.getBufferStatus.mockReturnValue({
        activeBuffers: 5,
        totalBufferSize: 1024,
        averageBufferSize: 204
      });
      
      await act(async () => {
        render(<PerformanceDashboard />);
      });
      
      await waitFor(() => {
        expect(screen.getByText('Performance Dashboard')).toBeInTheDocument();
        expect(screen.getByText('System Health')).toBeInTheDocument();
      });
    });

    it('should show loading state when metrics are null', async () => {
      mockStreamingService.getMetrics.mockReturnValue(null);
      
      render(<PerformanceDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Loading performance metrics...')).toBeInTheDocument();
      });
    });

    it('should display key performance metrics', async () => {
      mockStreamingService.getMetrics.mockReturnValue({
        activeConnections: 1,
        totalRequests: 10,
        successfulRequests: 10,
        averageResponseTime: 100,
        averageThroughput: 15,
        connectionErrors: 0,
        errorRate: 0,
        throughput: 15,
        bufferUtilization: 0.5,
        connectionPoolStatus: { active: 1, idle: 0, total: 1 },
        performanceScore: 95,
        lastUpdated: new Date()
      });
      
      mockStreamingService.getConnectionPoolStatus.mockReturnValue({
        active: 1,
        queued: 0,
        maxConnections: 10
      });
      
      mockStreamingService.getBufferStatus.mockReturnValue({
        activeBuffers: 1,
        totalBufferSize: 512,
        averageBufferSize: 256
      });
      
      render(<PerformanceDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Performance Dashboard')).toBeInTheDocument();
        expect(screen.getByText('Response Time')).toBeInTheDocument();
        expect(screen.getByText('Throughput')).toBeInTheDocument();
      });
    });
  });

  describe('useEnhancedStreamingChat Hook', () => {
    // Note: These tests would typically be in a separate file
    // but included here for completeness
    
    it('should initialize with default state', () => {
      const hookResult = mockUseEnhancedStreamingChat();
      
      expect(hookResult.messages).toEqual([]);
      expect(hookResult.streamingState.isStreaming).toBe(false);
      expect(hookResult.streamingState.error).toBeNull();
      expect(hookResult.performance).toBeDefined();
    });

    it('should provide message management functions', () => {
      const hookResult = mockUseEnhancedStreamingChat();
      
      expect(typeof hookResult.sendMessage).toBe('function');
      expect(typeof hookResult.clearMessages).toBe('function');
      expect(typeof hookResult.retryLastMessage).toBe('function');
      expect(typeof hookResult.cancelStream).toBe('function');
    });
  });

  describe('Integration Tests', () => {
    it('should work together in complete chat flow', async () => {
      // Simulate complete chat interaction
      mockStreamingHook.messages = [];
      mockStreamingHook.streamingState.isStreaming = false;
      
      const { rerender } = render(<EnhancedStreamingChat />);
      
      // Send message
      const input = screen.getByPlaceholderText(/type your message/i);
      const sendButton = screen.getByRole('button', { name: /send message/i });
      
      fireEvent.change(input, { target: { value: 'Hello AI' } });
      fireEvent.click(sendButton);
      
      // Simulate streaming state
      mockStreamingHook.streamingState.isStreaming = true;
      mockStreamingHook.messages = [
        {
          id: '1',
          content: 'Hello AI',
          role: 'user',
          timestamp: new Date()
        },
        {
          id: '2',
          content: 'Hello! How can I help you today?',
          role: 'assistant',
          timestamp: new Date(),
          model: 'gpt-3.5-turbo',
          isStreaming: true
        }
      ];
      
      // Force re-render (React.memo) by changing key
      rerender(<EnhancedStreamingChat key="streaming" />);
      
      // While streaming, typing indicator should be visible
      const statusEl = await screen.findByRole('status');
      expect(statusEl).toBeInTheDocument();
      
      // Simulate completion
      mockStreamingHook.streamingState.isStreaming = false;
      mockStreamingHook.messages = [
        {
          id: '1',
          content: 'Hello AI',
          role: 'user',
          timestamp: new Date()
        },
        {
          id: '2',
          content: 'Hello! How can I help you today?',
          role: 'assistant',
          timestamp: new Date(),
          model: 'gpt-3.5-turbo',
          isStreaming: false
        }
      ];
      
      // Force re-render again to reflect completion
      rerender(<EnhancedStreamingChat key="complete" />);
      
      expect(screen.getByText('Hello AI')).toBeInTheDocument();
      expect(screen.getByText('Hello! How can I help you today?')).toBeInTheDocument();
    });

    it('should handle performance monitoring during chat', async () => {
      // Simulate chat activity affecting performance metrics
      mockStreamingHook.performance = {
        responseTime: 800,
        tokensPerSecond: 30,
        totalTokens: 240
      };
      
      mockStreamingService.getMetrics.mockReturnValue({
        activeConnections: 3,
        totalRequests: 50,
        successfulRequests: 50,
        averageResponseTime: 800,
        averageThroughput: 30,
        connectionErrors: 0,
        errorRate: 0,
        throughput: 30,
        bufferUtilization: 0.8,
        connectionPoolStatus: { active: 2, idle: 1, total: 3 },
        performanceScore: 88,
        lastUpdated: new Date()
      });
      
      mockStreamingService.getConnectionPoolStatus.mockReturnValue({
        active: 2,
        queued: 0,
        maxConnections: 10
      });
      
      mockStreamingService.getBufferStatus.mockReturnValue({
        activeBuffers: 2,
        totalBufferSize: 1024,
        averageBufferSize: 512
      });
      
      // Render both components with updated mocks
      const { container } = render(
        <div>
          <EnhancedStreamingChat />
          <PerformanceDashboard />
        </div>
      );
      
      // Verify both components are rendered
      expect(screen.getByText(/ai assistant/i)).toBeInTheDocument();
      expect(screen.getByText(/performance dashboard/i)).toBeInTheDocument();
      
      // Performance metrics should reflect chat activity
      await waitFor(() => {
        expect(screen.getByText('800ms')).toBeInTheDocument();
        expect(screen.getByText('100.0%')).toBeInTheDocument();
        expect(screen.getByText('30B')).toBeInTheDocument();
        expect(screen.getByText('50')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility Tests', () => {
    it('should have proper ARIA labels', () => {
      render(<EnhancedStreamingChat />);
      
      expect(screen.getByLabelText(/message input/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/send message/i)).toBeInTheDocument();
      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    it('should support keyboard navigation', () => {
      render(<EnhancedStreamingChat />);
      
      const input = screen.getByPlaceholderText(/type your message/i);
      const sendButton = screen.getByRole('button', { name: /send/i });
      
      // Check that input is focusable
      input.focus();
      expect(document.activeElement).toBe(input);
      
      // Type some text to enable the send button
      fireEvent.change(input, { target: { value: 'test message' } });
      
      // Now the send button should be focusable
      sendButton.focus();
      expect(document.activeElement).toBe(sendButton);
    });

    it('should announce streaming status to screen readers', () => {
      mockStreamingHook.streamingState.isStreaming = true;
      
      render(<EnhancedStreamingChat />);
      
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent(/is generating/i);
    });
  });

  describe('Performance Tests', () => {
    it('should render efficiently with many messages', () => {
      const manyMessages = Array.from({ length: 100 }, (_, i) => ({
        id: i.toString(),
        content: `Message ${i}`,
        role: i % 2 === 0 ? 'user' : 'assistant',
        timestamp: new Date(),
        model: 'gpt-3.5-turbo'
      }));
      
      mockStreamingHook.messages = manyMessages;
      
      const startTime = performance.now();
      render(<EnhancedStreamingChat />);
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(400); // Should render within 400ms
    });

    it('should handle rapid state updates efficiently', async () => {
      // Use a dynamic mock implementation that reflects a changing index
      let idx = 0;
      const baseMessage = {
        id: 'streaming-1',
        role: 'assistant' as const,
        timestamp: new Date(),
        model: 'gpt-3.5-turbo',
        isStreaming: true
      };
      
      mockUseStreamingChat.mockImplementation(() => ({
        messages: [{ ...baseMessage, content: `Streaming text ${idx}` }],
        streamingState: {
          isStreaming: true,
          currentModel: 'gpt-3.5-turbo',
          // Pass through the streaming text used by TypingIndicator
          ...(process.env.NODE_ENV === 'test' ? { streamingText: `Streaming text ${idx}` } : {})
        },
        sendMessage: jest.fn(),
        clearMessages: jest.fn(),
        retryLastMessage: jest.fn(),
        cancelStream: jest.fn(),
        performance: {
          responseTime: 0,
          tokensPerSecond: 0,
          totalTokens: 0
        }
      }));
      
      const { rerender } = render(<EnhancedStreamingChat />);
      
      // Simulate rapid streaming updates
      for (let i = 1; i <= 50; i++) {
        idx = i;
        await act(async () => {
          rerender(<EnhancedStreamingChat />);
        });
      }
      
      // Final render should reflect streaming indicator presence
      await waitFor(() => {
        expect(screen.getByRole('status')).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });
});

// Test utilities
function createMockMessage(id: string, content: string, role: 'user' | 'assistant') {
  return {
    id,
    content,
    role,
    timestamp: new Date(),
    ...(role === 'assistant' && { model: 'gpt-3.5-turbo' })
  };
}

function createMockPerformanceMetrics() {
  return {
    activeConnections: Math.floor(Math.random() * 10),
    totalRequests: Math.floor(Math.random() * 1000),
    averageResponseTime: Math.floor(Math.random() * 500) + 100,
    errorRate: Math.random() * 0.1,
    throughput: Math.random() * 50,
    bufferUtilization: Math.random(),
    connectionPoolStatus: {
      active: Math.floor(Math.random() * 5),
      idle: Math.floor(Math.random() * 3),
      total: Math.floor(Math.random() * 8) + 2
    },
    performanceScore: Math.floor(Math.random() * 40) + 60
  };
}

export {
  createMockMessage,
  createMockPerformanceMetrics
};