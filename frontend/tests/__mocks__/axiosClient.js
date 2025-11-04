// Mock axios client for tests
const mockAxiosClient = {
  create: jest.fn(() => mockAxiosClient),
  get: jest.fn(() => Promise.resolve({ data: {} })),
  post: jest.fn(() => Promise.resolve({ data: {} })),
  put: jest.fn(() => Promise.resolve({ data: {} })),
  delete: jest.fn(() => Promise.resolve({ data: {} })),
  patch: jest.fn(() => Promise.resolve({ data: {} })),
  interceptors: {
    request: {
      use: jest.fn(),
      eject: jest.fn()
    },
    response: {
      use: jest.fn(),
      eject: jest.fn()
    }
  },
  defaults: {
    headers: {
      common: {},
      delete: {},
      get: {},
      head: {},
      post: {},
      put: {},
      patch: {}
    },
    timeout: 30000,
    baseURL: 'http://localhost:8080'
  }
};

export default mockAxiosClient;