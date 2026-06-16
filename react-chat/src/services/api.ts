import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_SERVER_URL || "http://localhost:3001",
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;
