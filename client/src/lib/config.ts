const API_URL_KEY = 'buzz_api_url';
const API_KEY_KEY = 'buzz_api_key';
const USER_ID_KEY = 'buzz_user_id';

const DEFAULT_API_URL = 'http://localhost:8080';
const DEFAULT_API_KEY = 'buzz_test_key_123';
const DEFAULT_USER_ID = 'user-123';

export const getApiUrl = (): string => {
  if (typeof window === 'undefined') return DEFAULT_API_URL;
  return localStorage.getItem(API_URL_KEY) || DEFAULT_API_URL;
};

export const setApiUrl = (url: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(API_URL_KEY, url);
};

export const getApiKey = (): string => {
  if (typeof window === 'undefined') return DEFAULT_API_KEY;
  return localStorage.getItem(API_KEY_KEY) || DEFAULT_API_KEY;
};

export const setApiKey = (key: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(API_KEY_KEY, key);
};

export const getUserId = (): string => {
  if (typeof window === 'undefined') return DEFAULT_USER_ID;
  return localStorage.getItem(USER_ID_KEY) || DEFAULT_USER_ID;
};

export const setUserId = (id: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(USER_ID_KEY, id);
};

export const getConfig = () => ({
  apiUrl: getApiUrl(),
  apiKey: getApiKey(),
  userId: getUserId(),
});

export const setConfig = (apiUrl?: string, apiKey?: string, userId?: string) => {
  if (apiUrl) setApiUrl(apiUrl);
  if (apiKey) setApiKey(apiKey);
  if (userId) setUserId(userId);
};
