import axios from "axios";

export const API_BASE_URL = (import.meta.env.VITE_SERVER_URL || "http://localhost:3001").replace(/\/+$/, "");

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;
