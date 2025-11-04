const useQuery = jest.fn((key, fn) => {
  // Default mock behavior: return loading=false, no error, and undefined data
  return { data: undefined, isLoading: false, error: null };
});

module.exports = { useQuery };