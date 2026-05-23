import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/api',
  timeout: 60000,
});

apiClient.interceptors.request.use(
  (config) => {
    console.log(`[HematoX] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 503) {
      error.isServiceUnavailable = true;
      error.message = "AI service unavailable — check your Gemini API key in Settings.";
    }
    return Promise.reject(error);
  }
);

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.style.display = "none";
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default apiClient;
