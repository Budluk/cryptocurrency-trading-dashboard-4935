// Vitest setup file
import type { SVGProps } from 'react';
import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
    },
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}));

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/' }),
    useParams: () => ({}),
  };
});

// Mock lucide-react icons (only the ones used by the components under test)
vi.mock('lucide-react', () => {
  const icons = [
    'Zap', 'TrendingUp', 'Clock', 'Search', 'Activity', 'BarChart3', 'Settings',
    'BrainIcon', 'TrendingUpIcon', 'TrendingDownIcon', 'AlertTriangleIcon',
    'RefreshCwIcon', 'NewspaperIcon', 'BarChartIcon', 'Shield', 'ShieldAlert',
    'ShieldCheck', 'TrendingDown', 'ChevronDown', 'ChevronUp', 'XCircle',
  ];
  const mockComponents: Record<string, (props: SVGProps<SVGSVGElement>) => JSX.Element> = {};
  for (const icon of icons) {
    mockComponents[icon] = (props: SVGProps<SVGSVGElement>) => <svg data-testid={icon} {...props} />;
  }
  return mockComponents;
});

// Mock sonner toast
vi.mock('sonner', () => ({
  Toaster: () => <div data-testid="sonner-toaster" />,
  toast: vi.fn(),
  toastPromise: vi.fn(),
  dismiss: vi.fn(),
}));

// Browser APIs missing in jsdom
globalThis.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

globalThis.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

export {};
