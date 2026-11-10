import axiosClient from '../api/axiosClient';

export const authService = {
  // Standard Password Auth
  login: async (email, password) => {
    const response = await axiosClient.post('/auth/login', {
      email,
      password,
    });
    return response.data;
  },

  register: async (name, email, password) => {
    const response = await axiosClient.post('/auth/register', {
      name,
      email,
      password,
    });
    return response.data;
  },

  // Gmail OTP Auth
  sendLoginOtp: async (email) => {
    const response = await axiosClient.post('/auth/send-login-otp', { email });
    return response.data;
  },

  verifyLoginOtp: async (email, otp) => {
    const response = await axiosClient.post('/auth/verify-login-otp', { email, otp });
    return response.data;
  },

  sendRegisterOtp: async (name, email, password) => {
    const response = await axiosClient.post('/auth/send-register-otp', { name, email, password });
    return response.data;
  },

  verifyRegisterOtp: async (email, otp) => {
    const response = await axiosClient.post('/auth/verify-register-otp', { email, otp });
    return response.data;
  },

  getCurrentProfile: async () => {
    const response = await axiosClient.get('/auth/me');
    return response.data;
  },
};
